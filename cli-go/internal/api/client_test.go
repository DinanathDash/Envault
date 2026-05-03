package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestIsFallbackEligible(t *testing.T) {
	testCases := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "api error is not fallback eligible",
			err:  &APIError{StatusCode: 401, Body: "unauthorized"},
			want: false,
		},
		{
			name: "deadline exceeded is fallback eligible",
			err:  context.DeadlineExceeded,
			want: true,
		},
		{
			name: "dns error is fallback eligible",
			err: &url.Error{
				Op:  "Get",
				URL: "https://envault.tech",
				Err: &net.DNSError{Err: "lookup failed", Name: "envault.tech"},
			},
			want: true,
		},
		{
			name: "random error is not fallback eligible",
			err:  errors.New("bad request body"),
			want: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsFallbackEligible(tc.err)
			if got != tc.want {
				t.Fatalf("expected %v, got %v", tc.want, got)
			}
		})
	}
}

func TestGetWithTimeout(t *testing.T) {
	origSleep := sleepWithContextFn
	origNow := nowFn
	current := time.Now()
	nowFn = func() time.Time { return current }
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error {
		current = current.Add(d)
		return nil
	}
	t.Setenv("ENVAULT_RETRY_MAX_DURATION", "50ms")
	defer func() {
		sleepWithContextFn = origSleep
		nowFn = origNow
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	client := &Client{
		BaseURL: server.URL,
		HTTP:    &http.Client{},
	}

	_, err := client.GetWithTimeout("/slow", 25*time.Millisecond)
	if err == nil {
		t.Fatalf("expected timeout error")
	}
	if !IsFallbackEligible(err) {
		t.Fatalf("timeout error should be fallback eligible, got: %v", err)
	}
}

func TestGetWithContext_CancelledContext(t *testing.T) {
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		w.WriteHeader(http.StatusOK)
	}))
	defer slow.Close()

	client := &Client{BaseURL: slow.URL, HTTP: &http.Client{}}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // pre-cancel

	_, err := client.GetWithContext(ctx, "/")
	if err == nil {
		t.Fatal("expected error when context is already cancelled")
	}
}

func TestGetWithContextAndTimeout_TimesOut(t *testing.T) {
	origSleep := sleepWithContextFn
	origNow := nowFn
	current := time.Now()
	nowFn = func() time.Time { return current }
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error {
		current = current.Add(d)
		return nil
	}
	t.Setenv("ENVAULT_RETRY_MAX_DURATION", "50ms")
	defer func() {
		sleepWithContextFn = origSleep
		nowFn = origNow
	}()

	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer slow.Close()

	client := &Client{BaseURL: slow.URL, HTTP: &http.Client{}}

	_, err := client.GetWithContextAndTimeout(context.Background(), "/", 20*time.Millisecond)
	if err == nil {
		t.Fatal("expected timeout error")
	}
	if !IsFallbackEligible(err) {
		t.Fatalf("timeout from GetWithContextAndTimeout should be fallback eligible, got: %v", err)
	}
}

func TestPostWithContext_CancelledContext(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTP: &http.Client{}}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := client.PostWithContext(ctx, "/", nil)
	if err == nil {
		t.Fatal("expected error when context is already cancelled")
	}
}

func TestDoReqCtx_ContextCancelledMidRequest(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cancel() // cancel mid-flight from the server handler
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTP: &http.Client{}}
	// Should not panic; may return either a context error or a transport error.
	_, _ = client.GetWithContext(ctx, "/")
}

func TestGetWithContext_SuccessfulRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTP: &http.Client{}}
	body, err := client.GetWithContext(context.Background(), "/")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestGetWithContext_RetriesOn5xxThenSucceeds(t *testing.T) {
	origSleep := sleepWithContextFn
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error { return nil }
	defer func() { sleepWithContextFn = origSleep }()

	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"temporary outage"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTP: &http.Client{}}
	body, err := client.GetWithContext(context.Background(), "/")
	if err != nil {
		t.Fatalf("expected success after retries, got error: %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", string(body))
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("expected 3 attempts (2 retries), got %d", got)
	}
}

func TestGetWithContext_DoesNotRetryOn4xx(t *testing.T) {
	origSleep := sleepWithContextFn
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error {
		t.Fatalf("sleep/retry should not be called for 4xx")
		return nil
	}
	defer func() { sleepWithContextFn = origSleep }()

	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, Token: "envault_svc_test", HTTP: &http.Client{}}
	_, err := client.GetWithContext(context.Background(), "/")
	if err == nil {
		t.Fatal("expected error")
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("expected 1 attempt for 4xx response, got %d", got)
	}
}

type flakyRoundTripper struct {
	remainingFailures int32
}

func (f *flakyRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if atomic.AddInt32(&f.remainingFailures, -1) >= 0 {
		return nil, &url.Error{
			Op:  req.Method,
			URL: req.URL.String(),
			Err: &net.OpError{Op: "dial", Net: "tcp", Err: fmt.Errorf("connection reset by peer")},
		}
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
		Header:     make(http.Header),
		Request:    req,
	}, nil
}

func TestGet_RetriesTransientNetworkError(t *testing.T) {
	origSleep := sleepWithContextFn
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error { return nil }
	defer func() { sleepWithContextFn = origSleep }()

	rt := &flakyRoundTripper{remainingFailures: 1}
	client := &Client{
		BaseURL: "https://example.com",
		HTTP:    &http.Client{Transport: rt},
	}

	body, err := client.Get("/")
	if err != nil {
		t.Fatalf("expected success after retry, got %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", string(body))
	}
}

func TestDoReqCtx_401Then503(t *testing.T) {
	origSleep := sleepWithContextFn
	origRefresh := refreshTokenFn
	sleepCalls := 0
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error {
		sleepCalls++
		return nil
	}
	refreshTokenFn = func(c *Client, httpClient *http.Client) error {
		c.Token = "refreshed-token"
		return nil
	}
	defer func() {
		sleepWithContextFn = origSleep
		refreshTokenFn = origRefresh
	}()

	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		switch n {
		case 1:
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"expired"}`))
		case 2, 3:
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"temporary"}`))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok":true}`))
		}
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, Token: "oauth_token", HTTP: &http.Client{}}
	body, err := client.GetWithContext(context.Background(), "/")
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", body)
	}
	if got := atomic.LoadInt32(&calls); got != 4 {
		t.Fatalf("expected 4 attempts, got %d", got)
	}
	if sleepCalls != 2 {
		t.Fatalf("expected 2 backoff waits for 503 responses, got %d", sleepCalls)
	}
}

func TestComputeRetryWait_FinalAttemptOptimization(t *testing.T) {
	origBase := retryBaseBackoff
	defer func() { retryBaseBackoff = origBase }()
	retryBaseBackoff = 30 * time.Second

	start := time.Now().Add(-(4*time.Minute + 50*time.Second))
	wait, ok := computeRetryWait(start, 1, 5*time.Minute)
	if !ok {
		t.Fatal("expected final clipped retry attempt to be allowed")
	}
	if wait <= 9*time.Second || wait > 10*time.Second {
		t.Fatalf("expected wait clipped to remaining time (~10s), got %s", wait)
	}
}

func TestConfigurableTimeoutEnvVar(t *testing.T) {
	origSleep := sleepWithContextFn
	origNow := nowFn
	origBase := retryBaseBackoff
	origMul := retryMultiplier
	t.Setenv("ENVAULT_RETRY_MAX_DURATION", "5s")

	current := time.Now()
	nowFn = func() time.Time { return current }
	sleepWithContextFn = func(ctx context.Context, d time.Duration) error {
		current = current.Add(d)
		return nil
	}
	retryBaseBackoff = 2 * time.Second
	retryMultiplier = 2.0
	defer func() {
		sleepWithContextFn = origSleep
		nowFn = origNow
		retryBaseBackoff = origBase
		retryMultiplier = origMul
	}()

	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":"bad gateway"}`))
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTP: &http.Client{}}
	_, err := client.GetWithContext(context.Background(), "/")
	if err == nil {
		t.Fatal("expected error after retry max duration")
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected 502 APIError, got %v", err)
	}
	if atomic.LoadInt32(&calls) < 2 {
		t.Fatalf("expected retries before giving up, got %d calls", calls)
	}
}
