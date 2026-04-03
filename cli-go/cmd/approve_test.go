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

func TestApproveCmd_Success(t *testing.T) {
	called := false
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.HasPrefix(r.URL.Path, "/api/approve/") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		called = true
		if got := r.Header.Get("Authorization"); got != "Bearer envault_at_test-token" {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"message":"Request has been approved"}`))
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	home := filepath.Join(tmp, "home")
	if err := os.MkdirAll(filepath.Join(home, ".envault"), 0o700); err != nil {
		t.Fatalf("mkdir home/.envault: %v", err)
	}
	config := "[auth]\ntoken = \"envault_at_test-token\"\n"
	if err := os.WriteFile(filepath.Join(home, ".envault", "config.toml"), []byte(config), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	bin := buildBinary(t)
	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"NEXT_PUBLIC_APP_URL="+mockSrv.URL,
	)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		t.Fatalf("approve command failed: %v\nstderr:\n%s", err, errBuf.String())
	}

	if !called {
		t.Fatal("expected /api/approve endpoint to be called")
	}
	if !strings.Contains(outBuf.String(), "Request has been approved") {
		t.Fatalf("expected success output, got stdout:\n%s\nstderr:\n%s", outBuf.String(), errBuf.String())
	}
}

func TestApproveCmd_RejectsNonAccessToken(t *testing.T) {
	tmp := t.TempDir()
	home := filepath.Join(tmp, "home")
	if err := os.MkdirAll(filepath.Join(home, ".envault"), 0o700); err != nil {
		t.Fatalf("mkdir home/.envault: %v", err)
	}
	config := "[auth]\ntoken = \"envault_rt_refresh-only\"\n"
	if err := os.WriteFile(filepath.Join(home, ".envault", "config.toml"), []byte(config), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	bin := buildBinary(t)
	cmd := exec.Command(bin, "approve", "approval-123")
	cmd.Env = append(os.Environ(), "HOME="+home)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	if err == nil {
		t.Fatalf("expected approve command to fail with non envault_at_ token")
	}
	if !strings.Contains(errBuf.String(), "envault_at_") {
		t.Fatalf("expected token-format validation error, got stderr:\n%s", errBuf.String())
	}
}
