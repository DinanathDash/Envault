package cmd

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func filterEnv(env []string) []string {
	filtered := []string{}
	for _, e := range env {
		if !strings.HasPrefix(e, "ENVAULT_TOKEN=") && !strings.HasPrefix(e, "ENVAULT_SERVICE_TOKEN=") && !strings.HasPrefix(e, "ENVAULT_TEST_FORCE_TTY=") {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

func buildMockServer(t *testing.T, calls *int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/api/approve/") {
			*calls++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
                                "project_id": "proj-123",
                                "payload_data": {
                                        "environment": "staging",
                                        "mutations": [
                                                {"key": "NEW_KEY", "value": "123", "action": "upsert"}
                                        ]
                                }
                        }`))
			return
		}

		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/projects/proj-123/secrets") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"secrets": []}`))
			return
		}

		if r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/api/approve/") {
			*calls++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"success":true,"message":"Request has been approved"}`))
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
}

func setupHome(t *testing.T) string {
	tmp := t.TempDir()
	home := filepath.Join(tmp, "home")
	if err := os.MkdirAll(filepath.Join(home, ".envault"), 0o700); err != nil {
		t.Fatalf("mkdir home/.envault: %v", err)
	}
	config := "[auth]\ntoken = \"envault_at_test-token\"\n"
	if err := os.WriteFile(filepath.Join(home, ".envault", "config.toml"), []byte(config), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	return home
}

func TestApproveCmd_Success_Interactive(t *testing.T) {
	calls := 0
	mockSrv := buildMockServer(t, &calls)
	defer mockSrv.Close()
	home := setupHome(t)
	bin := buildBinary(t)

	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(filterEnv(os.Environ()),
		"HOME="+home,
		"NEXT_PUBLIC_APP_URL="+mockSrv.URL,
		"ENVAULT_CLI_URL="+mockSrv.URL,
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
		"ENVAULT_TEST_FORCE_NON_INTERACTIVE=1",
		"ENVAULT_TEST_FORCE_TTY=1",
	)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	cmd.Stdin = strings.NewReader("y\n")

	if err := cmd.Run(); err != nil {
		t.Fatalf("approve command failed: %v\nstderr:\n%s\nstdout:\n%s", err, errBuf.String(), outBuf.String())
	}

	if !strings.Contains(outBuf.String(), "Request has been approved") {
		t.Fatalf("expected success output, got stdout:\n%s", outBuf.String())
	}
}

func TestApproveCmd_Abort_Interactive(t *testing.T) {
	calls := 0
	mockSrv := buildMockServer(t, &calls)
	defer mockSrv.Close()
	home := setupHome(t)
	bin := buildBinary(t)

	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(filterEnv(os.Environ()),
		"HOME="+home,
		"NEXT_PUBLIC_APP_URL="+mockSrv.URL,
		"ENVAULT_CLI_URL="+mockSrv.URL,
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
		"ENVAULT_TEST_FORCE_NON_INTERACTIVE=1",
		"ENVAULT_TEST_FORCE_TTY=1",
	)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	cmd.Stdin = strings.NewReader("N\n")

	_ = cmd.Run()

	if !strings.Contains(outBuf.String(), "Approval cancelled.") {
		t.Fatalf("expected abort output, got stdout:\n%s", outBuf.String())
	}
}

func TestApproveCmd_NonInteractive(t *testing.T) {
	calls := 0
	mockSrv := buildMockServer(t, &calls)
	defer mockSrv.Close()
	home := setupHome(t)
	bin := buildBinary(t)

	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(filterEnv(os.Environ()),
		"HOME="+home,
		"NEXT_PUBLIC_APP_URL="+mockSrv.URL,
		"ENVAULT_CLI_URL="+mockSrv.URL,
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
		"ENVAULT_TEST_FORCE_NON_INTERACTIVE=1",
	)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	pr, pw, _ := os.Pipe()
	pw.Close()
	cmd.Stdin = pr

	err := cmd.Run()

	t.Logf("stdout: %s\nstderr: %s", outBuf.String(), errBuf.String())
	if err == nil {
		t.Fatalf("expected error due to non-interactive environment")
	}

	if !strings.Contains(errBuf.String(), "Visual diff requires an interactive terminal") {
		t.Fatalf("expected visual diff error, got stderr:\n%s", errBuf.String())
	}
}

func TestApproveCmd_RejectsNonAccessToken(t *testing.T) {
	bin := buildBinary(t)
	tmp := t.TempDir()
	home := filepath.Join(tmp, "home")
	os.MkdirAll(filepath.Join(home, ".envault"), 0o700)
	os.WriteFile(filepath.Join(home, ".envault", "config.toml"), []byte("[auth]\ntoken = \"envault_rt_refresh-only\"\n"), 0o600)

	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(os.Environ(), "HOME="+home)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err == nil {
		t.Fatalf("expected failure")
	}
}
