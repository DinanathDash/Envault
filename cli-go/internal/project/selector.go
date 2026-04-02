package project

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/AlecAivazis/survey/v2"
	"github.com/AlecAivazis/survey/v2/terminal"
	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
)

// ErrUserCancelled is returned when the user cancels an operation (Ctrl+C)
var ErrUserCancelled = fmt.Errorf("operation cancelled by user")

func isInterrupt(err error) bool {
	return err == terminal.InterruptErr
}

type Project struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	IsOwner bool   `json:"isOwner"`
	UserId  string `json:"user_id"`
}

type ProjectsResponse struct {
	Projects []Project `json:"projects"`
	Owned    []Project `json:"owned"`
	Shared   []Project `json:"shared"`
	Data     []Project `json:"data"` // Fallback
}

// SelectProject handles the interactive flow to select or create a project.
// Returns the selected Project ID.
func SelectProject() (string, error) {
	client := api.NewClient()
	s := ui.NewSpinner("Fetching your projects...")
	s.Start()

	respBytes, err := client.Get("/projects")
	if err != nil {
		s.Stop()
		return "", fmt.Errorf("failed to fetch projects: %w", err)
	}
	s.Stop()

	var data ProjectsResponse
	if err := json.Unmarshal(respBytes, &data); err != nil {
		return "", fmt.Errorf("failed to parse projects response: %w", err)
	}

	// Normalize data
	var all, owned, shared []Project

	if len(data.Owned) > 0 || len(data.Shared) > 0 {
		owned = data.Owned
		shared = data.Shared
		all = append(all, owned...)
		all = append(all, shared...)
	} else {
		// Fallback if API returns flat list
		list := data.Projects
		if len(list) == 0 {
			list = data.Data
		}

		all = list
		// specific logic to split if isOwner present, else just put all in all?
		// Node logic:
		// projectsData.owned = data.projects.filter(p => p.isOwner);
		// projectsData.shared = data.projects.filter(p => !p.isOwner);
		for _, p := range list {
			if p.IsOwner {
				owned = append(owned, p)
			} else {
				shared = append(shared, p)
			}
		}
	}

	// 1. Category Selection
	category := ""
	catPrompt := &survey.Select{
		Message: "Where do you want to select the project from?",
		Options: []string{"All Projects", "My Projects", "Shared With Me"},
	}
	if err := survey.AskOne(catPrompt, &category); err != nil {
		if isInterrupt(err) {
			return "", ErrUserCancelled
		}
		return "", err
	}

	var choices []Project
	allowCreate := true

	switch category {
	case "My Projects":
		choices = owned
	case "Shared With Me":
		choices = shared
		allowCreate = false
	default:
		choices = all
	}

	// Deduplicate by ID
	unique := make(map[string]Project)
	for _, p := range choices {
		unique[p.ID] = p
	}
	choices = make([]Project, 0, len(unique))
	for _, p := range unique {
		choices = append(choices, p)
	}

	// Sort by name
	sort.Slice(choices, func(i, j int) bool {
		return choices[i].Name < choices[j].Name
	})

	if len(choices) == 0 && !allowCreate {
		fmt.Println(ui.ColorYellow("No projects found in this category."))
		return "", nil
	}

	// Build Survey Options
	var options []string
	projectMap := make(map[string]string) // "Name (Role)" -> ID

	if allowCreate {
		options = append(options, "+ Create New Project")
	}

	for _, p := range choices {
		label := p.Name
		if p.Role != "" {
			label += fmt.Sprintf(" (%s)", p.Role)
		}
		options = append(options, label)
		projectMap[label] = p.ID
	}

	if len(options) == 0 {
		fmt.Println(ui.ColorYellow("No projects available to select."))
		return "", nil
	}

	selectedLabel := ""
	selPrompt := &survey.Select{
		Message:  "Select the project to link:",
		Options:  options,
		PageSize: 10,
	}
	if err := survey.AskOne(selPrompt, &selectedLabel, survey.WithPageSize(10)); err != nil {
		if isInterrupt(err) {
			return "", ErrUserCancelled
		}
		return "", err
	}

	if selectedLabel == "+ Create New Project" {
		return createNewProject(client)
	}

	return projectMap[selectedLabel], nil
}

func createNewProject(client *api.Client) (string, error) {
	name := ""
	prompt := &survey.Input{
		Message: "Enter name for the new project:",
	}
	if err := survey.AskOne(prompt, &name, survey.WithValidator(survey.Required)); err != nil {
		if isInterrupt(err) {
			return "", ErrUserCancelled
		}
		return "", err
	}

	uiModeChoice := "Simple (single environment view)"
	modePrompt := &survey.Select{
		Message: "Choose workspace mode:",
		Options: []string{
			"Simple (single environment view)",
			"Advanced (multi-environment ready)",
		},
		Default: "Simple (single environment view)",
	}
	if err := survey.AskOne(modePrompt, &uiModeChoice); err != nil {
		if isInterrupt(err) {
			return "", ErrUserCancelled
		}
		return "", err
	}

	defaultEnvChoice := "Development"
	envPrompt := &survey.Select{
		Message: "Choose default environment:",
		Options: []string{"Development", "Preview", "Production"},
		Default: "Development",
	}
	if err := survey.AskOne(envPrompt, &defaultEnvChoice); err != nil {
		if isInterrupt(err) {
			return "", ErrUserCancelled
		}
		return "", err
	}

	uiMode := "simple"
	if uiModeChoice == "Advanced (multi-environment ready)" {
		uiMode = "advanced"
	}

	defaultEnvironment := "development"
	switch defaultEnvChoice {
	case "Preview":
		defaultEnvironment = "preview"
	case "Production":
		defaultEnvironment = "production"
	}

	s := ui.NewSpinner("Creating project...")
	s.Start()

	payload := map[string]interface{}{
		"name":                     name,
		"ui_mode":                  uiMode,
		"default_environment_slug": defaultEnvironment,
	}
	respBytes, err := client.Post("/projects", payload)
	if err != nil {
		s.Stop()
		return "", fmt.Errorf("failed to create project: %w", err)
	}

	var resp struct {
		Project Project `json:"project"`
	}
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		s.Stop()
		return "", fmt.Errorf("failed to parse create response: %w", err)
	}

	s.Stop()
	fmt.Println(ui.ColorGreen(fmt.Sprintf("[OK] Project \"%s\" created!", resp.Project.Name)))

	// Keep local CLI defaults in sync with project creation choices.
	cfg, err := ReadConfig()
	if err == nil {
		cfg.DefaultEnvironment = defaultEnvironment
		if cfg.EnvironmentFiles == nil {
			cfg.EnvironmentFiles = map[string]string{}
		}
		_ = WriteConfig(cfg)
	}

	return resp.Project.ID, nil
}
