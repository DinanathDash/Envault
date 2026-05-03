package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/spf13/viper"
	"github.com/zalando/go-keyring"
)

type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("api error %d: %s", e.StatusCode, e.Body)
}

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

var (
	defaultRetryMaxDuration = 5 * time.Minute
	retryBaseBackoff        = 2 * time.Second
	retryMultiplier         = 2.0
	sleepWithContextFn      = sleepWithContext
	refreshTokenFn          = func(c *Client, httpClient *http.Client) error { return c.refreshToken(httpClient) }
	nowFn                   = time.Now
)

func NewClient() *Client {
	baseURL := os.Getenv("ENVAULT_CLI_URL")
	if baseURL == "" {
		if rootBase := strings.TrimSpace(os.Getenv("ENVAULT_BASE_URL")); rootBase != "" {
			baseURL = strings.TrimSuffix(rootBase, "/") + "/api/cli"
		} else {
			baseURL = "https://envault.tech/api/cli"
		}
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		fmt.Printf("Error: Invalid API URL: %v\n", err)
		os.Exit(1)
	}

	if u.Scheme != "https" && os.Getenv("ENVAULT_ALLOW_INSECURE_HTTP") != "1" {
		fmt.Println("Error: Insecure connection (HTTP) is not allowed.")
		fmt.Println("       Please use an HTTPS URL for ENVAULT_CLI_URL.")
		os.Exit(1)
	}

	// 1. Check for Service Tokens via Envar
	token := os.Getenv("ENVAULT_TOKEN")
	if token == "" {
		token = os.Getenv("ENVAULT_SERVICE_TOKEN")
	}

	if token != "" {
		if !strings.HasPrefix(token, "envault_svc_") && !strings.HasPrefix(token, "envault_agt_") {
			log.Fatalf("Security Error: ENVAULT_TOKEN detected, but it is not a valid Service Token or Agent Token. Personal OAuth tokens cannot be used via environment variables.")
		}
	} else {
		// Fallback to local session token
		token = viper.GetString("auth.token")
	}

	return &Client{
		BaseURL: baseURL,
		Token:   token,
		HTTP:    &http.Client{},
	}
}

func (c *Client) refreshToken(httpClient *http.Client) error {
	if httpClient == nil {
		httpClient = c.HTTP
	}
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	rt, err := keyring.Get("envault", "cli")
	if err != nil || rt == "" {
		return fmt.Errorf("no refresh token found")
	}

	payload := map[string]interface{}{
		"refresh_token": rt,
	}
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", c.BaseURL+"/auth/refresh", bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
	}

	var parsed map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return err
	}

	newToken, ok := parsed["access_token"].(string)
	if !ok || newToken == "" {
		return fmt.Errorf("invalid token response")
	}

	// Save new access token
	c.Token = newToken
	viper.Set("auth.token", newToken)
	_ = viper.WriteConfig()
	return nil
}

func (c *Client) Post(path string, body interface{}) ([]byte, error) {
	return c.doReqWithHTTP("POST", path, body, true, c.HTTP)
}

func (c *Client) Get(path string) ([]byte, error) {
	return c.doReqWithHTTP("GET", path, nil, true, c.HTTP)
}

func (c *Client) GetWithTimeout(path string, timeout time.Duration) ([]byte, error) {
	if timeout <= 0 {
		return c.Get(path)
	}

	return c.doReqWithHTTP("GET", path, nil, true, clientWithTimeout(c.HTTP, timeout))
}

func (c *Client) GetWithContext(ctx context.Context, path string) ([]byte, error) {
	return c.doReqCtx(ctx, "GET", path, nil, true, c.HTTP)
}

func (c *Client) GetWithContextAndTimeout(ctx context.Context, path string, timeout time.Duration) ([]byte, error) {
	if timeout <= 0 {
		return c.GetWithContext(ctx, path)
	}
	return c.doReqCtx(ctx, "GET", path, nil, true, clientWithTimeout(c.HTTP, timeout))
}

func (c *Client) PostWithContext(ctx context.Context, path string, body interface{}) ([]byte, error) {
	return c.doReqCtx(ctx, "POST", path, body, true, c.HTTP)
}

func clientWithTimeout(base *http.Client, timeout time.Duration) *http.Client {
	if base == nil {
		return &http.Client{Timeout: timeout}
	}

	return &http.Client{
		Transport:     base.Transport,
		CheckRedirect: base.CheckRedirect,
		Jar:           base.Jar,
		Timeout:       timeout,
	}
}

func (c *Client) doReqWithHTTP(method, path string, body interface{}, canRetry bool, httpClient *http.Client) ([]byte, error) {
	return c.doReqCtx(context.Background(), method, path, body, canRetry, httpClient)
}

func (c *Client) doReqCtx(ctx context.Context, method, path string, body interface{}, canRetry bool, httpClient *http.Client) ([]byte, error) {
	if httpClient == nil {
		httpClient = c.HTTP
	}
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	var reqBody []byte
	var err error
	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			return nil, err
		}
	}

	start := nowFn()
	attempt := 1
	tokenRefreshTried := false
	maxDuration := resolveRetryMaxDuration()

	for {
		var bodyReader io.Reader
		if reqBody != nil {
			bodyReader = bytes.NewReader(reqBody)
		}

		req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bodyReader)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Content-Type", "application/json")
		if c.Token != "" {
			req.Header.Set("Authorization", "Bearer "+c.Token)
		}
		if actorSource := strings.TrimSpace(os.Getenv("ENVAULT_CLI_ACTOR_SOURCE")); actorSource != "" {
			req.Header.Set("X-Envault-Actor-Source", actorSource)
		}

		resp, reqErr := httpClient.Do(req)
		if reqErr != nil {
			if !canRetry || !isRetryableRequestError(reqErr) {
				return nil, reqErr
			}
			wait, ok := computeRetryWait(start, attempt, maxDuration)
			if !ok {
				return nil, reqErr
			}
			logRetryWarning(method, path, attempt, reqErr, wait)
			if err := sleepWithContextFn(ctx, wait); err != nil {
				return nil, err
			}
			attempt++
			continue
		}

		bodyBytes, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, readErr
		}

		if resp.StatusCode == 401 && canRetry && !tokenRefreshTried {
			if c.Token != "" && !strings.HasPrefix(c.Token, "envault_svc_") {
				errRefresh := refreshTokenFn(c, httpClient)
				if errRefresh == nil {
					tokenRefreshTried = true
					continue
				}
				return nil, fmt.Errorf("Refresh Token Exchange Failed: %v | (Original Auth Error: %s)", errRefresh, string(bodyBytes))
			}
		}

		if isRetryableStatusCode(resp.StatusCode) && canRetry {
			wait, ok := computeRetryWait(start, attempt, maxDuration)
			if !ok {
				return nil, &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
			}
			logRetryWarning(method, path, attempt, fmt.Errorf("server returned %s", resp.Status), wait)
			if err := sleepWithContextFn(ctx, wait); err != nil {
				return nil, err
			}
			attempt++
			continue
		}

		if resp.StatusCode >= 400 {
			bodyStr := string(bodyBytes)
			contentType := resp.Header.Get("Content-Type")
			if strings.Contains(contentType, "text/html") {
				bodyStr = "Server returned an HTML page (" + resp.Status + "). Ensure the API server is running."
			}
			return nil, &APIError{StatusCode: resp.StatusCode, Body: bodyStr}
		}

		contentType := resp.Header.Get("Content-Type")
		if strings.Contains(contentType, "text/html") {
			return nil, &APIError{StatusCode: resp.StatusCode, Body: "Server returned HTML instead of expected JSON API response. Ensure the API server is running."}
		}

		return bodyBytes, nil
	}
}

func isRetryableStatusCode(statusCode int) bool {
	return statusCode >= 500 && statusCode <= 599
}

func isRetryableRequestError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	return IsFallbackEligible(err)
}

func computeRetryWait(start time.Time, attempt int, maxDuration time.Duration) (time.Duration, bool) {
	if attempt < 1 {
		attempt = 1
	}
	exp := retryBaseBackoff
	for i := 1; i < attempt; i++ {
		next := time.Duration(float64(exp) * retryMultiplier)
		if next <= exp {
			break
		}
		exp = next
	}
	wait := jitterDuration(exp)
	if wait <= 0 {
		wait = retryBaseBackoff
	}

	elapsed := nowFn().Sub(start)
	if elapsed >= maxDuration {
		return 0, false
	}
	if elapsed+wait > maxDuration {
		remaining := maxDuration - elapsed
		if remaining > time.Second {
			wait = remaining
			return wait, true
		}
		return 0, false
	}
	return wait, true
}

func resolveRetryMaxDuration() time.Duration {
	raw := strings.TrimSpace(os.Getenv("ENVAULT_RETRY_MAX_DURATION"))
	if raw == "" {
		return defaultRetryMaxDuration
	}

	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return defaultRetryMaxDuration
	}

	return d
}

func jitterDuration(base time.Duration) time.Duration {
	// Full-jitter style randomization in [base/2, base) to spread retries.
	half := base / 2
	if half <= 0 {
		return base
	}
	return half + time.Duration(rand.Int63n(int64(half)))
}

func logRetryWarning(method, path string, attempt int, cause error, wait time.Duration) {
	fmt.Fprintf(os.Stderr, "Warning: Envault API transient failure (%s %s, attempt %d). Retrying in %s. Cause: %v\n",
		method, path, attempt, wait.Round(time.Millisecond), cause)
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func IsFallbackEligible(err error) bool {
	if err == nil {
		return false
	}

	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return false
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		if urlErr.Timeout() {
			return true
		}
		return IsFallbackEligible(urlErr.Err)
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return true
	}

	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return true
	}

	return false
}
