package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/AlecAivazis/survey/v2"
	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

var forceDeploy bool
var dryRun bool

var deployCmd = &cobra.Command{
	Use:     "deploy",
	Aliases: []string{"push"},
	Short:   "Push secrets from .env to Envault",
	Run: func(cmd *cobra.Command, args []string) {
		// Graceful cancellation: cancel context on Ctrl+C / SIGTERM so that
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
			fmt.Fprintln(os.Stderr, ui.ColorRed("Deploy failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(err.Error()))
			os.Exit(1)
		}
		targetFile := resolveEnvFile(targetEnv, fileFlag)

		// Hard gate: if the source file is tracked by git, the secrets are
		// already (or will be) in git history. Block the deploy and tell the
		// user exactly how to fix it - there is no safe way to proceed silently.
		if isTrackedByGit(targetFile) {
			fmt.Fprintln(os.Stderr)
			fmt.Fprintln(os.Stderr, ui.ColorRed("  [X]  BLOCKED: "+targetFile+" is tracked in your git repository."))
			fmt.Fprintln(os.Stderr, ui.ColorRed("     Your secrets may already be exposed in your git history."))
			fmt.Fprintln(os.Stderr, ui.ColorYellow("     You must stop tracking this file before using Envault:"))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       git rm --cached "+targetFile))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       echo '"+targetFile+"' >> .gitignore"))
			fmt.Fprintln(os.Stderr, ui.ColorCyan("       git commit -m 'stop tracking "+targetFile+"'"))
			fmt.Fprintln(os.Stderr)
			fmt.Fprintln(os.Stderr, ui.ColorYellow("     If secrets have already been committed, consider rotating them in Envault."))
			fmt.Fprintln(os.Stderr)
			os.Exit(1)
		}

		// 2. Read .env manually to be lenient
		content, err := os.ReadFile(targetFile)
		if err != nil {
			if os.IsNotExist(err) {
				fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Local env file not found: %s", targetFile)))
				fmt.Fprintln(os.Stderr, ui.ColorYellow("Provide a file explicitly with --file, or map one with `envault env map --env <name> --file <path>`."))
			} else {
				fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error reading %s: %v", targetFile, err)))
			}
			os.Exit(1)
		}

		// Filter invalid lines
		var validLines []string
		lines := strings.Split(string(content), "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" {
				continue
			}
			// It's a comment
			if strings.HasPrefix(trimmed, "#") {
				continue
			}
			// It has a key=value pair
			if strings.Contains(trimmed, "=") {
				validLines = append(validLines, line)
			}
		}

		envMap, err := godotenv.Unmarshal(strings.Join(validLines, "\n"))
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Error parsing .env file"))
			os.Exit(1)
		}

		if len(envMap) == 0 {
			fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("No secrets found in %s", targetFile)))
			return
		}

		secrets := []Secret{}
		for k, v := range envMap {
			secrets = append(secrets, Secret{Key: k, Value: v})
		}

		if diff, err := computeDiff(ctx, projectId, targetEnv, targetFile); err == nil {
			fmt.Printf(
				"%s %d additions, %d deletions, %d modifications, %d unchanged\n",
				ui.ColorBold("Diff Summary:"),
				len(diff.Additions),
				len(diff.Deletions),
				len(diff.Modifications),
				diff.Unchanged,
			)
			for _, k := range diff.Additions {
				fmt.Println(ui.ColorGreen("+ " + k))
			}
			for _, k := range diff.Deletions {
				fmt.Println(ui.ColorRed("- " + k))
			}
			for _, k := range diff.Modifications {
				fmt.Println(ui.ColorYellow("~ " + k))
			}
		}

		if dryRun {
			fmt.Println(ui.ColorBlue(fmt.Sprintf("Dry Run: Would deploy %d secrets to %s (%s)", len(secrets), projectId, targetEnv)))
			for _, s := range secrets {
				fmt.Printf("- %s\n", s.Key)
			}
			return
		}

		// 3. Confirmation
		if !forceDeploy {
			// Fetch project name for warning
			client := api.NewClient()
			projectName := "Envault"

			projectsBytes, err := client.GetWithContext(ctx, "/projects")
			if ctx.Err() != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled."))
				os.Exit(130)
			}
			if err == nil {
				var pResp ProjectResponse
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
				"%s\n\n%s%s%s%s\n\n%s%s%s\n\n%s\n%s",
				ui.ColorRed("WARNING: OVERWRITING REMOTE SECRETS"),
				"You are about to ", ui.ColorRed("DEPLOY"), fmt.Sprintf(" local variables from %s to your project: ", targetFile),
				ui.ColorCyan(projectName),
				"Existing secrets in the project will be ", ui.ColorRed("OVERWRITTEN"), " by values in your .env.",
				ui.ColorDim("We recommend checking the dashboard for differences:"),
				ui.ColorCyan(fmt.Sprintf("%s/project/%s", appUrl, projectId)),
			)

			fmt.Fprintln(os.Stderr, ui.WarningBoxStyle.Render(warningMsg))

			confirm := false
			prompt := &survey.Confirm{
				Message: fmt.Sprintf("Deploy %d secrets to %s environment?", len(secrets), targetEnv),
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

		// 4. Push Secrets
		client := api.NewClient()
		s := ui.NewSpinner(fmt.Sprintf("Encrypting and deploying secrets (%s)...", targetEnv))
		s.Start()

		payload := map[string]interface{}{
			"secrets": secrets,
		}

		path := fmt.Sprintf("/projects/%s/secrets?environment=%s", projectId, url.QueryEscape(targetEnv))
		_, err = client.PostWithContext(ctx, path, payload)
		if err != nil {
			s.Stop()
			if ctx.Err() != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("\nOperation cancelled. Verify the Envault dashboard to confirm whether secrets were updated."))
				os.Exit(130)
			}
			if handleEnvironmentAccessDenied(err, targetEnv) {
				os.Exit(1)
			}
			fmt.Fprintln(os.Stderr, ui.ColorRed("Deploy failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(classifyAPIError(err)))
			os.Exit(1)
		}

		s.Stop()
		fmt.Println(ui.ColorGreen(fmt.Sprintf("[OK] Successfully deployed %d secrets to %s!", len(secrets), targetEnv)))
	},
}

func init() {
	rootCmd.AddCommand(deployCmd)
	deployCmd.Flags().BoolVarP(&forceDeploy, "force", "f", false, "Deploy without confirmation")
	deployCmd.Flags().BoolVar(&dryRun, "dry-run", false, "Show what would be deployed without actually deploying")
	deployCmd.Flags().StringVarP(&projectFlag, "project", "p", "", "Project ID")
	deployCmd.Flags().StringVar(&fileFlag, "file", "", "Local .env file path override")
}
