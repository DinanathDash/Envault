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

	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
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

		resp, err := (&http.Client{}).Do(req)
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
