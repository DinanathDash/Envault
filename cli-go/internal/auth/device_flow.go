package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/DinanathDash/Envault/cli-go/internal/api"
	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/atotto/clipboard"
	"github.com/pkg/browser"
	"github.com/spf13/viper"
	"github.com/zalando/go-keyring"
)

type DeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	Interval        int    `json:"interval"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
}

type UserResponse struct {
	Email string `json:"email"`
}

func Login() error {
	client := api.NewClient()

	fmt.Println(ui.ColorBlue("  Starting Device Authentication Flow...\n"))

	// Spinner
	s := ui.NewSpinner("Contacting Envault servers...")
	s.Start()

	hostname, _ := os.Hostname()
	deviceInfo := map[string]string{
		"hostname": hostname,
		"platform": "cli-go",
	}

	payload := map[string]interface{}{
		"device_info": deviceInfo,
	}

	respBytes, err := client.Post("/auth/device/code", payload)
	if err != nil {
		s.Stop()
		fmt.Println(ui.ColorRed("Failed to initiate login."))
		return fmt.Errorf("failed to initiate login: %w", err)
	}

	var codeResp DeviceCodeResponse
	if err := json.Unmarshal(respBytes, &codeResp); err != nil {
		s.Stop()
		return fmt.Errorf("failed to parse device code response: %w", err)
	}
	s.Stop()
	fmt.Println(ui.ColorGreen("[OK] Device code generated."))

	fmt.Printf("\nPlease visit: %s\n", ui.ColorCyanUnderline(codeResp.VerificationURI))

	// Box for User Code
	boxContent := fmt.Sprintf("Authentication Code\n\n%s", ui.ColorGreenBold(codeResp.UserCode))
	fmt.Println(ui.BoxStyle.Render(boxContent))

	if err := clipboard.WriteAll(codeResp.UserCode); err == nil {
		fmt.Println(ui.ColorDim("(Code copied to clipboard)"))
	}

	_ = browser.OpenURL(codeResp.VerificationURI)

	// Poll Spinner
	s = ui.NewSpinner("Waiting for browser approval...")
	s.Start()

	interval := time.Duration(codeResp.Interval) * time.Second
	if interval == 0 {
		interval = 2 * time.Second
	}

	// Handle Ctrl+C
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)
	defer signal.Stop(sigChan)

	for {
		select {

		case <-sigChan:
			s.Stop()
			fmt.Println("\nCancelling login...")

			// Attempt to notify server of cancellation
			_, _ = client.Post("/auth/device/cancel", map[string]string{
				"device_code": codeResp.DeviceCode,
			})

			return fmt.Errorf("login cancelled")
		case <-time.After(interval):
			// Continue polling
		}

		tokenBytes, err := client.Post("/auth/device/token", map[string]string{
			"device_code": codeResp.DeviceCode,
		})

		if err != nil {
			errStr := err.Error()
			if strings.Contains(errStr, "authorization_pending") {
				continue
			}
			if strings.Contains(errStr, "access_denied") {
				s.Stop()
				return fmt.Errorf("access denied by user")
			}
			if strings.Contains(errStr, "expired_token") {
				s.Stop()
				return fmt.Errorf("code expired, please try again")
			}
			continue
		}

		var tokenResp TokenResponse
		if err := json.Unmarshal(tokenBytes, &tokenResp); err != nil {
			continue
		}

		if tokenResp.AccessToken != "" {
			viper.Set("auth.token", tokenResp.AccessToken)
			if err := viper.WriteConfig(); err != nil {
				if err := viper.SafeWriteConfig(); err != nil {
					s.Stop()
					return fmt.Errorf("failed to save config: %w", err)
				}
			}

			if tokenResp.RefreshToken != "" {
				if err := keyring.Set("envault", "cli", tokenResp.RefreshToken); err != nil {
					fmt.Println(ui.ColorYellow("\nWarning: Failed to save refresh token to system keyring. You may need to login again sooner."))
				}
			}

			// Fetch User Info to show email
			// Update client with new token first?
			// The client struct reads from viper on NewClient, or we can update it manually.
			// Let's just make a new client since token is now in viper?
			// Wait, viper.Get reads from memory if set? Yes.
			// But NewClient reads once.
			// Re-instantiate client.
			clientWithAuth := api.NewClient()
			userBytes, err := clientWithAuth.Get("/me")
			email := ""
			if err == nil {
				var userResp UserResponse
				if err := json.Unmarshal(userBytes, &userResp); err == nil {
					email = userResp.Email
				}
			}

			s.Stop()
			fmt.Println(ui.ColorGreen("[OK] Successfully authenticated! Token saved."))
			if email != "" {
				fmt.Printf("Logged in as: %s\n", ui.ColorBold(email))
			}
			return nil
		}

		if tokenResp.Error != "" {
			if tokenResp.Error == "authorization_pending" {
				continue
			}
			s.Stop()
			return fmt.Errorf("login failed: %s", tokenResp.Error)
		}
	}
}
