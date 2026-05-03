package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"bufio"
	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/crypto"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"net/url"
)

type approveResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error"`
}

var approveCmd = &cobra.Command{
	Use:   "approve <approval_id>",
	Short: "Approve a pending agent request without opening the browser",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		approvalID := strings.TrimSpace(args[0])
		if approvalID == "" {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Approval ID is required."))
			os.Exit(1)
		}

		token := strings.TrimSpace(viper.GetString("auth.token"))
		if token == "" {
			fmt.Fprintln(os.Stderr, ui.ColorRed("No local access token found in config.toml."))
			fmt.Fprintln(os.Stderr, ui.ColorYellow("Run `envault login` and retry."))
			os.Exit(1)
		}
		if !strings.HasPrefix(token, "envault_at_") {
			fmt.Fprintln(os.Stderr, ui.ColorRed("The stored token is not a local CLI access token (envault_at_)."))
			fmt.Fprintln(os.Stderr, ui.ColorYellow("Run `envault login` to refresh your local access token and retry."))
			os.Exit(1)
		}

		baseURL := strings.TrimSpace(os.Getenv("NEXT_PUBLIC_APP_URL"))
		if baseURL == "" {
			baseURL = "https://envault.tech"
		}
		baseURL = strings.TrimRight(baseURL, "/")

		payloadBytes, err := json.Marshal(map[string]string{"action": "approve"})
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to encode approval payload: %v", err)))
			os.Exit(1)
		}

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

		getReq, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/approve/%s", baseURL, approvalID), nil)
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to create request: %v", err)))
			os.Exit(1)
		}
		getReq.Header.Set("Content-Type", "application/json")
		getReq.Header.Set("Authorization", "Bearer "+token)

		getLoader := ui.NewLoader(ui.LoaderThemeSync, "Fetching pending mutations...")
		getLoader.Start()
		getResp, err := (&http.Client{}).Do(getReq)
		getLoader.Stop()
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to fetch pending approval: %v", err)))
			os.Exit(1)
		}

		if getResp.StatusCode >= 400 {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to fetch pending approval (status %d).", getResp.StatusCode)))
			os.Exit(1)
		}

		type PayloadMutation struct {
			Key    string `json:"key"`
			Value  string `json:"value"`
			Action string `json:"action"`
		}
		type PendingApprovalData struct {
			ProjectID   string `json:"project_id"`
			PayloadData struct {
				Environment     string            `json:"environment"`
				EnvironmentSlug string            `json:"environmentSlug"`
				Mutations       []PayloadMutation `json:"mutations"`
			} `json:"payload_data"`
		}

		var pendingData PendingApprovalData
		if err := json.NewDecoder(getResp.Body).Decode(&pendingData); err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Failed to parse pending approval data."))
			os.Exit(1)
		}
		getResp.Body.Close()

		targetEnv := pendingData.PayloadData.Environment
		if targetEnv == "" {
			targetEnv = pendingData.PayloadData.EnvironmentSlug
		}
		if targetEnv == "" || pendingData.ProjectID == "" {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Pending approval is missing environment or project context."))
			os.Exit(1)
		}

		diffLoader := ui.NewLoader(ui.LoaderThemeCheck, "Preparing visual diff...")
		diffLoader.Start()

		client := api.NewClient()
		path := fmt.Sprintf("/projects/%s/secrets?environment=%s", pendingData.ProjectID, url.QueryEscape(targetEnv))
		respBytes, err := client.GetWithContext(ctx, path)
		diffLoader.Stop()

		var remote SecretsResponse
		if err == nil {
			_ = json.Unmarshal(respBytes, &remote)
		}

		localEnv := make(map[string]string)
		for _, s := range remote.Secrets {
			plaintext := "<<DECRYPTION_FAILED>>"
			if s.Ciphertext != "<<DECRYPTION_FAILED>>" && s.Dek != "" {
				if p, err := crypto.DecryptAESGCM(s.Ciphertext, s.Dek); err == nil {
					plaintext = p
				}
			}
			localEnv[s.Key] = plaintext
		}

		for _, m := range pendingData.PayloadData.Mutations {
			if m.Action == "delete" {
				delete(localEnv, m.Key)
			} else {
				localEnv[m.Key] = "<<PENDING_VALUE_" + m.Key + ">>"
			}
		}

		result, err := computeDiffFromMap(ctx, pendingData.ProjectID, targetEnv, localEnv)
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed("Failed to generate diff."))
			os.Exit(1)
		}

		fmt.Printf("\n%s %s (%s)\n", ui.ColorBold("Environment:"), targetEnv, pendingData.ProjectID)
		fmt.Println(ui.ColorBold("Pending Changes:"))

		for _, k := range result.Additions {
			fmt.Println(ui.ColorGreen("+ " + k))
		}
		for _, k := range result.Deletions {
			fmt.Println(ui.ColorRed("- " + k))
		}
		for _, k := range result.Modifications {
			fmt.Println(ui.ColorYellow("~ " + k))
		}

		if len(result.Additions) == 0 && len(result.Deletions) == 0 && len(result.Modifications) == 0 {
			fmt.Println(ui.ColorGreen("No differences. (Empty mutation)"))
		} else {
			if !isInteractive() {
				fmt.Fprintln(os.Stderr, ui.ColorRed("Error: Visual diff requires an interactive terminal."))
				os.Exit(1)
			}
			fmt.Printf("\nReview the changes above. Approve this mutation? (y/N): ")
			reader := bufio.NewReader(os.Stdin)
			response, _ := reader.ReadString('\n')
			if strings.ToLower(strings.TrimSpace(response)) != "y" {
				fmt.Println(ui.ColorYellow("Approval cancelled."))
				os.Exit(0)
			}
		}

		req, err := http.NewRequestWithContext(
			ctx,
			http.MethodPost,
			fmt.Sprintf("%s/api/approve/%s", baseURL, approvalID),
			bytes.NewReader(payloadBytes),
		)
		if err != nil {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Failed to create request: %v", err)))
			os.Exit(1)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		loader := ui.NewLoader(ui.LoaderThemeSync, "Submitting approval...")
		loader.Start()
		resp, err := (&http.Client{}).Do(req)
		loader.Stop()
		if err != nil {
			if ctx.Err() != nil {
				fmt.Fprintln(os.Stderr, ui.ColorYellow("Operation cancelled."))
				os.Exit(130)
			}
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("Approval failed: %v", err)))
			os.Exit(1)
		}
		defer resp.Body.Close()

		var out approveResponse
		_ = json.NewDecoder(resp.Body).Decode(&out)

		if resp.StatusCode >= 400 {
			errMessage := strings.TrimSpace(out.Error)
			if errMessage == "" {
				errMessage = fmt.Sprintf("request failed with status %d", resp.StatusCode)
			}
			fmt.Fprintln(os.Stderr, ui.ColorRed("Approval failed."))
			fmt.Fprintln(os.Stderr, ui.ColorRed(errMessage))
			os.Exit(1)
		}

		successMessage := strings.TrimSpace(out.Message)
		if successMessage == "" {
			successMessage = "Request has been approved"
		}

		fmt.Println(ui.ColorGreen("[OK] " + successMessage))
	},
}

func init() {
	rootCmd.AddCommand(approveCmd)
}

func isInteractive() bool {
	if os.Getenv("ENVAULT_TEST_FORCE_TTY") == "1" {
		return true
	}
	if os.Getenv("ENVAULT_TEST_FORCE_NON_INTERACTIVE") == "1" {
		return false
	}
	stat, _ := os.Stdin.Stat()
	return (stat.Mode() & os.ModeCharDevice) != 0
}
