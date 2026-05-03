package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/crypto"
	"github.com/DinanathDash/Envault/cli-go/internal/offlinecache"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/spf13/cobra"
)

var runTimeoutFlag time.Duration

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
		runTarget := args[0]
		runArgs := args[1:]

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
		ctx, cancel := context.WithTimeout(context.Background(), resolveCLINetworkTimeout(runTimeoutFlag))
		defer cancel()

		var secretsResp SecretsResponse
		var envSecrets []offlinecache.Secret
		loader := ui.NewLoader(ui.LoaderThemeFetch, fmt.Sprintf("VaultPulse preparing runtime secrets (%s)...", targetEnv))
		loader.Start()
		respBytes, err := client.GetWithContext(ctx, path)
		loader.Stop()

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
					if isLocalBaseURL(client.BaseURL) {
						fmt.Fprintln(os.Stderr, ui.ColorYellow("Hint: ENVAULT_BASE_URL/ENVAULT_CLI_URL points to a local server."))
						if isLikelyDevCommand(runTarget, runArgs) {
							fmt.Fprintln(os.Stderr, ui.ColorYellow("      This command starts a dev server, so secrets cannot be injected into an already-running process."))
							fmt.Fprintln(os.Stderr, ui.ColorYellow("      Use hosted API URL for true one-command dev, or start local server in another terminal first."))
						}
					}
					os.Exit(1)
				}

				envSecrets = cachedSecrets
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

			envSecrets = make([]offlinecache.Secret, len(secretsResp.Secrets))
			for i, s := range secretsResp.Secrets {
				plaintext := "<<DECRYPTION_FAILED>>"
				if s.Ciphertext != "" && s.Ciphertext != "<<DECRYPTION_FAILED>>" && s.Dek != "" {
					decrypted, err := crypto.DecryptAESGCM(s.Ciphertext, s.Dek)
					if err == nil {
						plaintext = decrypted
					} else {
						fmt.Fprintln(os.Stderr, ui.ColorYellow(fmt.Sprintf("Warning: failed to decrypt secret '%s': %v", s.Key, err)))
					}
				} else if s.Value != "" || (s.Ciphertext == "" && s.Dek == "") {
					plaintext = s.Value
				}
				envSecrets[i] = offlinecache.Secret{Key: s.Key, Value: plaintext}
			}
			if cacheErr := offlinecache.Save(projectID, targetEnv, envSecrets); cacheErr != nil {
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

		var command *exec.Cmd
		if runtime.GOOS == "windows" {
			allArgs := append([]string{"/c", runTarget}, runArgs...)
			command = exec.Command("cmd", allArgs...)
		} else {
			binPath, err := exec.LookPath(runTarget)
			if err != nil {
				fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Error locating executable '%s': %v", runTarget, err)))
				os.Exit(1)
			}
			command = exec.Command(binPath, runArgs...)
		}

		command.Env = os.Environ()
		for _, s := range envSecrets {
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

func isLocalBaseURL(baseURL string) bool {
	u, err := url.Parse(baseURL)
	if err != nil {
		return strings.Contains(strings.ToLower(baseURL), "localhost")
	}

	host := strings.ToLower(u.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	if strings.HasPrefix(host, "127.") || host == "::1" {
		return true
	}

	return false
}

func isLikelyDevCommand(runTarget string, runArgs []string) bool {
	t := strings.ToLower(strings.TrimSpace(runTarget))
	if t == "next" && len(runArgs) > 0 && strings.EqualFold(strings.TrimSpace(runArgs[0]), "dev") {
		return true
	}

	if (t == "npm" || t == "pnpm" || t == "bun") && len(runArgs) >= 2 {
		return strings.EqualFold(strings.TrimSpace(runArgs[0]), "run") && strings.EqualFold(strings.TrimSpace(runArgs[1]), "dev")
	}

	if t == "yarn" && len(runArgs) > 0 {
		return strings.EqualFold(strings.TrimSpace(runArgs[0]), "dev")
	}

	return false
}

func init() {
	rootCmd.AddCommand(runCmd)
	runCmd.Flags().StringVarP(&projectFlag, "project", "p", "", "Project ID")
	runCmd.Flags().DurationVar(&runTimeoutFlag, "timeout", 0, "Maximum duration for API retry/wait behavior (e.g. 30s, 2m). Overrides ENVAULT_RETRY_MAX_DURATION.")
}
