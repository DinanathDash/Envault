package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/AlecAivazis/survey/v2"
	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/spf13/cobra"
)

type Secret struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type SecretsResponse struct {
	Secrets []Secret `json:"secrets"`
}

type ProjectResponse struct {
	Projects []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"projects"`
}

var forcePull bool
var projectFlag string
var fileFlag string

var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Fetch secrets and write to .env",
	Run: func(cmd *cobra.Command, args []string) {
		// Graceful cancellation: cancel the context on Ctrl+C / SIGTERM so that
		// in-flight HTTP requests are aborted cleanly.
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		defer signal.Stop(sigCh)
		go func() {
			select {
			case <-sigCh:
				cancel()
			case <-ctx.Done():
			}
		}()

		// 1. Get Project ID
		projectId := ensureProjectID()

		if projectId == "" {
			fmt.Fprintln(os.Stderr, ui.ColorYellow("No project linked."))
			projectId = selectProjectAndPersistOrExit()
			fmt.Fprintln(os.Stderr, ui.ColorGreen(fmt.Sprintf("[OK] Project linked! (ID: %s)\n", projectId)))
		}
		if !isValidProjectID(projectId) {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Invalid project ID. Expected a UUID."))
			os.Exit(1)
		}
		targetEnv, err := resolveTargetEnvironmentForProject(projectId)
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Pull failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(err.Error()))
			os.Exit(1)
		}
		targetFile := resolveEnvFile(targetEnv, fileFlag)

		// 2. Check for existing .env
		if _, err := os.Stat(targetFile); err == nil && !forcePull {
			// Fetch project name for better warning
			client := api.NewClient()
			projectName := "Envault"

			// Try to get project name (best effort, ignore errors)
			projectsBytes, err := client.GetWithContext(ctx, "/projects")
			if ctx.Err() != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled."))
				os.Exit(130)
			}
			if err == nil {
				var pResp ProjectResponse
				// API might return {data: []} or just [] or {projects: []} depending on endpoint
				// The deploy.js says: data.projects || data.data || []
				// Let's try flexible parsing if needed, but for now struct matches common pattern
				if err := json.Unmarshal(projectsBytes, &pResp); err == nil {
					for _, p := range pResp.Projects {
						if p.ID == projectId {
							projectName = p.Name
							break
						}
					}
				}
			}

			appUrl := os.Getenv("NEXT_PUBLIC_APP_URL")
			if appUrl == "" {
				appUrl = "https://envault.tech"
			}

			warningMsg := fmt.Sprintf(
				"%s\n\n%s%s%s%s%s\n\n%s%s%s%s\n\n%s\n%s",
				ui.ColorRed("WARNING: POTENTIAL DATA LOSS"),
				"You are about to ", ui.ColorRed("OVERWRITE"), " your local ", ui.ColorYellow(targetFile), " file.",
				"Any local changes not synced to ", ui.ColorCyan(projectName), " will be ", ui.ColorRed("PERMANENTLY LOST."),
				ui.ColorDim("We recommend checking the dashboard for differences:"),
				ui.ColorCyan(fmt.Sprintf("%s/project/%s", appUrl, projectId)),
			)

			fmt.Fprintln(os.Stderr, ui.WarningBoxStyle.Render(warningMsg))

			confirm := false
			prompt := &survey.Confirm{
				Message: fmt.Sprintf("Are you sure you want to overwrite %s for %s?", targetFile, targetEnv),
			}
			if err := survey.AskOne(prompt, &confirm); err != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled."))
				return
			}

			if !confirm {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("Operation cancelled."))
				return
			}
		}

		// 3. Fetch Secrets
		client := api.NewClient()
		s := ui.NewSpinner(fmt.Sprintf("Fetching secrets (%s)...", targetEnv))
		s.Start()

		path := fmt.Sprintf("/projects/%s/secrets?environment=%s", projectId, url.QueryEscape(targetEnv))
		respBytes, err := client.GetWithContext(ctx, path)
		if err != nil {
			s.Stop()
			if ctx.Err() != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled."))
				os.Exit(130)
			}
			if handleEnvironmentAccessDenied(err, targetEnv) {
				os.Exit(1)
			}
			// Check specifically for the ACCESS_REQUIRED JIT error
			var apiErr *api.APIError
			if errors.As(err, &apiErr) && apiErr.StatusCode == 403 {
				var errBody struct {
					Error   string `json:"error"`
					Message string `json:"message"`
				}
				if jsonErr := json.Unmarshal([]byte(apiErr.Body), &errBody); jsonErr == nil && errBody.Error == "ACCESS_REQUIRED" {
					handleAccessRequired(ctx, client, projectId)
					return
				}
			}
			fmt.Fprintln(os.Stderr, ui.ColorRed("Pull failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(classifyAPIError(err)))
			os.Exit(1)
		}

		var secretsResp SecretsResponse
		if err := json.Unmarshal(respBytes, &secretsResp); err != nil {
			s.Stop()
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error parsing response: %v", err)))
			os.Exit(1)
		}

		if len(secretsResp.Secrets) == 0 {
			s.Stop()
			fmt.Fprintln(os.Stderr, ui.ColorBlue("[i] No secrets found for this project."))
			return
		}

		// 4. Hard gate: refuse to write if the target file is already tracked by git.
		// Writing secrets into a tracked file would silently include them in the next commit.
		if isTrackedByGit(targetFile) {
			s.Stop()
			fmt.Fprintln(os.Stderr)
			fmt.Fprintln(os.Stderr, ui.ColorRed("  [X]  BLOCKED: "+targetFile+" is tracked in your git repository."))
			fmt.Fprintln(os.Stderr, ui.ColorYellow("     Writing secrets into a tracked file would expose them in your git history."))
			fmt.Fprintln(os.Stderr, ui.ColorYellow("     Fix this before pulling:"))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       git rm --cached "+targetFile))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       echo '"+targetFile+"' >> .gitignore"))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       git commit -m 'stop tracking "+targetFile+"'"))
			fmt.Fprintln(os.Stderr)
			os.Exit(1)
		}

		// 5. Write to .env atomically via a temp file so that a crash or
		// Ctrl+C mid-write never leaves the target file half-written.
		dir := filepath.Dir(targetFile)
		if dir == "" {
			dir = "."
		}
		tmpFile, err := os.CreateTemp(dir, ".envault-pull-*.tmp")
		if err != nil {
			s.Stop()
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error creating temp file: %v", err)))
			os.Exit(1)
		}
		tmpPath := tmpFile.Name()

		for _, secret := range secretsResp.Secrets {
			if _, err := fmt.Fprintf(tmpFile, "%s=%s\n", secret.Key, secret.Value); err != nil {
				_ = tmpFile.Close()
				_ = os.Remove(tmpPath)
				s.Stop()
				fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error writing secrets: %v", err)))
				os.Exit(1)
			}
		}
		if err := tmpFile.Close(); err != nil {
			_ = os.Remove(tmpPath)
			s.Stop()
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error finalizing temp file: %v", err)))
			os.Exit(1)
		}
		_ = os.Chmod(tmpPath, 0600) // .env files: readable by owner only
		if err := os.Rename(tmpPath, targetFile); err != nil {
			_ = os.Remove(tmpPath)
			s.Stop()
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error writing to %s: %v", targetFile, err)))
			os.Exit(1)
		}

		s.Stop()
		fmt.Println(ui.ColorGreen(fmt.Sprintf("[OK] Pulled %d secrets from %s into %s.", len(secretsResp.Secrets), targetEnv, targetFile)))

		// Safety checkpoint: real secrets are now on disk.
		// 1. Ensure .gitignore covers the written file - create/update it automatically.
		giAdded, giErr := ensureGitignoreEntry(targetFile)
		if giErr != nil {
			fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("  [!] Could not update .gitignore: %v", giErr)))
		} else if giAdded {
			fmt.Println(ui.ColorGreen("  [OK] Added '" + targetFile + "' to .gitignore - it will not be committed."))
		}

		// 2. Attempt to install the pre-commit hook.
		alreadyInstalled, _, hookErr := installPreCommitHook()
		switch {
		case hookErr != nil && strings.Contains(hookErr.Error(), "no .git directory"):
			// No git repo yet - warn the user to run the hook installer after git init.
			fmt.Fprintln(os.Stderr, ui.ColorYellow("  [!] No git repository detected. After git init, run:"))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("      envault audit --install-hook"))
		case hookErr != nil:
			fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("  [!] Could not install pre-commit hook: %v", hookErr)))
		case !alreadyInstalled:
			fmt.Println(ui.ColorGreen("  [OK] Pre-commit hook installed - secrets are protected from accidental commits."))
		}
	},
}

// handleAccessRequired prompts the user to request access to the project
// when the server returns ACCESS_REQUIRED (no existing membership + GitHub check failed/skipped).
func handleAccessRequired(ctx context.Context, client *api.Client, projectId string) {
	fmt.Fprintln(os.Stderr, ui.ColorYellow("\n[!]  You do not have access to this project."))

	confirm := false
	prompt := &survey.Confirm{
		Message: "Would you like to send an access request to the project owner?",
		Default: false,
	}
	if err := survey.AskOne(prompt, &confirm); err != nil || !confirm {
		fmt.Fprintln(os.Stderr, ui.ColorYellow("Access request cancelled."))
		return
	}

	s := ui.NewSpinner("Sending access request...")
	s.Start()

	path := fmt.Sprintf("/projects/%s/request-access", projectId)
	_, err := client.PostWithContext(ctx, path, nil)
	s.Stop()

	if err != nil {
		if ctx.Err() != nil {
			fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled."))
			os.Exit(130)
		}
		var apiErr *api.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode == 409 {
			fmt.Fprintln(os.Stderr, ui.ColorBlue("[i]  You already have a pending access request for this project."))
			return
		}
		fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to send access request: %v", err)))
		return
	}

	fmt.Println(ui.ColorGreen("[OK] Access request sent! The project owner will be notified via email and in-app notification."))
}

func init() {
	rootCmd.AddCommand(pullCmd)
	pullCmd.Flags().BoolVarP(&forcePull, "force", "f", false, "Overwrite .env without confirmation")
	pullCmd.Flags().StringVarP(&projectFlag, "project", "p", "", "Project ID")
	pullCmd.Flags().StringVar(&fileFlag, "file", "", "Local .env file path override")
}
