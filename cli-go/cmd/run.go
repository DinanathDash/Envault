package cmd

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/offlinecache"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run -- <command>",
	Short: "Run a command with secrets injected from Envault",
	Args: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return fmt.Errorf("missing command to run")
		}
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		projectID := ensureProjectID()
		if projectID == "" {
			fmt.Fprintln(os.Stderr, ui.ColorYellow("No project linked."))
			projectID = selectProjectAndPersistOrExit()
			fmt.Fprintln(os.Stderr, ui.ColorGreen(fmt.Sprintf("[OK] Project linked! (ID: %s)\n", projectID)))
		}
		if !isValidProjectID(projectID) {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Invalid project ID. Expected a UUID."))
			os.Exit(1)
		}

		targetEnv, err := resolveTargetEnvironmentForProject(projectID)
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Run failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(err.Error()))
			os.Exit(1)
		}
		client := api.NewClient()
		path := fmt.Sprintf("/projects/%s/secrets?environment=%s", projectID, url.QueryEscape(targetEnv))

		var secretsResp SecretsResponse
		respBytes, err := client.GetWithTimeout(path, resolveRunTimeout())
		usedOfflineCache := false
		cachedAt := time.Time{}
		if err != nil {
			if handleEnvironmentAccessDenied(err, targetEnv) {
				os.Exit(1)
			}
			if api.IsFallbackEligible(err) {
				cachedSecrets, loadedAt, cacheErr := offlinecache.Load(projectID, targetEnv)
				if cacheErr != nil {
					fmt.Fprintln(os.Stderr, ui.ColorRed("Run failed."))
					fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Network error: %v", err)))
					fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Offline cache unavailable: %v", cacheErr)))
					os.Exit(1)
				}

				secretsResp.Secrets = make([]Secret, len(cachedSecrets))
				for i, s := range cachedSecrets {
					secretsResp.Secrets[i] = Secret{Key: s.Key, Value: s.Value}
				}
				usedOfflineCache = true
				cachedAt = loadedAt
			} else {
				fmt.Fprintln(os.Stderr, ui.ColorRed("Run failed."))
				fmt.Fprintln(os.Stderr, ui.ColorRed(classifyAPIError(err)))
				os.Exit(1)
			}
		} else {
			if err := json.Unmarshal(respBytes, &secretsResp); err != nil {
				fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error parsing response: %v", err)))
				os.Exit(1)
			}

			offlineSecrets := make([]offlinecache.Secret, len(secretsResp.Secrets))
			for i, s := range secretsResp.Secrets {
				offlineSecrets[i] = offlinecache.Secret{Key: s.Key, Value: s.Value}
			}
			if cacheErr := offlinecache.Save(projectID, targetEnv, offlineSecrets); cacheErr != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("Warning: failed to update offline cache: %v", cacheErr)))
			}
		}

		if usedOfflineCache {
			cacheTime := "unknown"
			cacheAge := "unknown"
			if !cachedAt.IsZero() {
				cacheTime = cachedAt.Format(time.RFC3339)
				cacheAge = humanizeDuration(time.Since(cachedAt))
			}
			fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("Using offline cache for %s (%s). Cached at %s (%s ago).", projectID, targetEnv, cacheTime, cacheAge)))
		}

		runTarget := args[0]
		runArgs := args[1:]

		var command *exec.Cmd
		if runtime.GOOS == "windows" {
			allArgs := append([]string{"/c", runTarget}, runArgs...)
			command = exec.Command("cmd", allArgs...)
		} else {
			command = exec.Command(runTarget, runArgs...)
		}

		command.Env = os.Environ()
		for _, s := range secretsResp.Secrets {
			command.Env = append(command.Env, fmt.Sprintf("%s=%s", s.Key, s.Value))
		}
		command.Stdout = os.Stdout
		command.Stderr = os.Stderr
		command.Stdin = os.Stdin

		if err := command.Run(); err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				os.Exit(exitErr.ExitCode())
			}
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to execute command: %v", err)))
			os.Exit(1)
		}
	},
}

func humanizeDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	if d < time.Minute {
		return d.Round(time.Second).String()
	}
	return d.Round(time.Minute).String()
}

func resolveRunTimeout() time.Duration {
	const defaultSeconds = 3

	raw := strings.TrimSpace(os.Getenv("ENVAULT_RUN_TIMEOUT_SECONDS"))
	if raw == "" {
		return defaultSeconds * time.Second
	}

	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return defaultSeconds * time.Second
	}

	return time.Duration(seconds) * time.Second
}

func init() {
	rootCmd.AddCommand(runCmd)
	runCmd.Flags().StringVarP(&projectFlag, "project", "p", "", "Project ID")
}
