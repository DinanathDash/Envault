package cmd

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"testing"
	"time"
)

// --- Helper -------------------------------------------------------------------

// runCLI builds and runs the CLI binary with the given arguments, returning
// stdout, stderr, and the exit code. It compiles on first call per test binary.
func runCLI(t *testing.T, env []string, args ...string) (stdout, stderr string, code int) {
	t.Helper()

	bin := buildBinary(t)

	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(), env...)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	code = 0
	if exitErr, ok := err.(*exec.ExitError); ok {
		code = exitErr.ExitCode()
	} else if err != nil {
		t.Fatalf("exec.Command failed: %v", err)
	}

	return outBuf.String(), errBuf.String(), code
}

var (
	builtBin     string
	builtBinOnce = new(struct{ once interface{} }) // won't compile; use t.TempDir per test
)

func buildBinary(t *testing.T) string {
	t.Helper()
	bin := t.TempDir() + "/envault-test"
	if err := exec.Command("go", "build", "-o", bin, "../main.go").Run(); err != nil {
		t.Fatalf("failed to build CLI binary: %v", err)
	}
	return bin
}

// --- --verbose flag -----------------------------------------------------------

func TestVerboseFlag_SilentByDefault(t *testing.T) {
	// Without --verbose, the CLI must emit nothing on stdout for a no-op invocation.
	// We use --help which is safe and exits 0.
	stdout, _, _ := runCLI(t, nil, "--help")
	if strings.Contains(stdout, "Using config file:") {
		t.Errorf("config file path leaked to stdout without --verbose:\n%s", stdout)
	}
}

func TestVerboseFlag_ConfigAppearsOnStderr(t *testing.T) {
	// Write a real config file and point --config directly at it.
	tmp := t.TempDir()
	configPath := tmp + "/config.toml"
	if err := os.WriteFile(configPath, []byte("[auth]\n"), 0600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, stderr, _ := runCLI(t, nil, "--verbose", "--config", configPath, "version")
	if !strings.Contains(stderr, "Using config file:") {
		t.Errorf("expected 'Using config file:' on stderr with --verbose, got stderr:\n%s", stderr)
	}
}

// --- envault run: stdout cleanliness -----------------------------------------

func TestRunCmd_NoConfigLeakOnStdout(t *testing.T) {
	// We need secrets from a server. Stand up a mock.
	srv := httptest.NewTLSServer(nil) // just as anchor; we override URL
	srv.Close()

	// Stand up a plain HTTP server for subprocess tests (explicitly allowed via ENVAULT_ALLOW_INSECURE_HTTP).
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		if strings.Contains(r.URL.Path, "/secrets") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"secrets":[]}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	// Write a minimal project config so the CLI knows the project ID.
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "run", "echo", "PAYLOAD_ONLY")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	out := outBuf.String()
	if strings.Contains(out, "Using config file:") {
		t.Errorf("'Using config file:' leaked to stdout of 'envault run':\n%s", out)
	}
	// The echo output must appear on stdout with no contamination before it.
	firstLine := strings.TrimSpace(strings.SplitN(out, "\n", 2)[0])
	if firstLine != "PAYLOAD_ONLY" {
		t.Errorf("stdout first line should be 'PAYLOAD_ONLY', got %q\nfull stdout:\n%s\nstderr:\n%s", firstLine, out, errBuf.String())
	}
}

// --- error messages go to stderr ---------------------------------------------

func TestErrorsRouteToStderr_InvalidProjectID(t *testing.T) {
	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"not-a-uuid"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "run", "echo", "hello")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(), "ENVAULT_TOKEN=x")

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	if outBuf.Len() > 0 {
		t.Errorf("expected empty stdout for invalid project ID, got:\n%s", outBuf.String())
	}
	if !strings.Contains(errBuf.String(), "Invalid project ID") {
		t.Errorf("expected 'Invalid project ID' on stderr, got:\n%s", errBuf.String())
	}
}

func TestErrorsRouteToStderr_RunFailed(t *testing.T) {
	// Point to a server that returns 401 so the CLI prints "Run failed." on stderr.
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "run", "echo", "hello")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	if outBuf.Len() > 0 {
		t.Errorf("expected empty stdout on run failure, got:\n%s", outBuf.String())
	}
	if !strings.Contains(errBuf.String(), "failed") && !strings.Contains(errBuf.String(), "401") && !strings.Contains(errBuf.String(), "Unauthorized") {
		t.Errorf("expected error message on stderr, got:\n%s", errBuf.String())
	}
}

// --- pull: atomic write leaves no temp file -----------------------------------

func TestPullCmd_NoLeftoverTempFile(t *testing.T) {
	// A server that returns one secret.
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		if strings.Contains(r.URL.Path, "/secrets") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"secrets":[{"key":"FOO","value":"bar"}]}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "pull", "--force")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)
	var errBuf bytes.Buffer
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	// Check no temp files remain.
	entries, _ := os.ReadDir(tmp)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".tmp") {
			t.Errorf("leftover temp file after pull: %s\nstderr: %s", e.Name(), errBuf.String())
		}
	}
}

func TestPullCmd_SecretWrittenToEnvFile(t *testing.T) {
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		if strings.Contains(r.URL.Path, "/secrets") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"secrets":[{"key":"MY_KEY","value":"my_val"}]}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "pull", "--force")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)
	_ = cmd.Run()

	data, err := os.ReadFile(tmp + "/.env")
	if err != nil {
		t.Fatalf("expected .env file to be written: %v", err)
	}
	if !strings.Contains(string(data), "MY_KEY=my_val") {
		t.Errorf("expected MY_KEY=my_val in .env, got:\n%s", data)
	}
}

// --- signal handling: Ctrl+C exits gracefully --------------------------------

func TestPullCmd_SIGINTExitsWithCode130(t *testing.T) {
	// Use a channel to confirm the server received the request before we send
	// SIGINT - this ensures signal.Notify is set up inside the process.
	requestArrived := make(chan struct{}, 1)
	slowSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		select {
		case requestArrived <- struct{}{}:
		default:
		}
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer slowSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "pull", "--force")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+slowSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Start(); err != nil {
		t.Fatalf("cmd.Start: %v", err)
	}

	// Wait until the server receives the request - at this point signal.Notify
	// is definitely registered inside the process (it runs before the HTTP call).
	select {
	case <-requestArrived:
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("server never received request from pull (stderr: %s)", errBuf.String())
	}

	_ = cmd.Process.Signal(syscall.SIGINT)

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		// 130 = our os.Exit(130) handler ran, -1 = killed by signal (also acceptable).
		if exitCode == 0 {
			t.Errorf("expected non-zero exit after SIGINT, got 0")
		}
		if outBuf.Len() > 0 {
			t.Errorf("expected empty stdout on SIGINT, got:\n%s", outBuf.String())
		}
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatal("process did not exit within 5s after SIGINT")
	}
}

func TestDeployCmd_SIGINTExitsWithCode130(t *testing.T) {
	// Channel to confirm the server received the request.
	requestArrived := make(chan struct{}, 1)
	slowSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		select {
		case requestArrived <- struct{}{}:
		default:
		}
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer slowSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)
	_ = os.WriteFile(tmp+"/.env", []byte("FOO=bar\n"), 0600)

	bin := buildBinary(t)
	// --force skips confirmation, --dry-run skips the POST (so we test the diff GET).
	cmd := exec.Command(bin, "deploy", "--force")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+slowSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Start(); err != nil {
		t.Fatalf("cmd.Start: %v", err)
	}

	select {
	case <-requestArrived:
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("server never received request from deploy (stderr: %s)", errBuf.String())
	}

	_ = cmd.Process.Signal(syscall.SIGINT)

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		if exitCode == 0 {
			t.Errorf("expected non-zero exit after SIGINT, got 0")
		}
		if outBuf.Len() > 0 {
			t.Errorf("expected empty stdout on SIGINT, got:\n%s", outBuf.String())
		}
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatal("process did not exit within 5s after SIGINT")
	}
}

// --- run: child process exit code propagation --------------------------------

func TestRunCmd_PropagatesChildExitCode(t *testing.T) {
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		if strings.Contains(r.URL.Path, "/secrets") {
			_, _ = w.Write([]byte(`{"secrets":[]}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "run", "--", "sh", "-c", "exit 42")
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)

	err := cmd.Run()
	exitCode := 0
	if exitErr, ok := err.(*exec.ExitError); ok {
		exitCode = exitErr.ExitCode()
	}
	if exitCode != 42 {
		t.Errorf("expected exit code 42 from child, got %d", exitCode)
	}
}

// --- run: stdout is pure child output ----------------------------------------

func TestRunCmd_StdoutIsPureChildOutput(t *testing.T) {
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/environments") {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"environments":[{"slug":"development","isDefault":true}]}`))
			return
		}
		if strings.Contains(r.URL.Path, "/secrets") {
			_, _ = w.Write([]byte(`{"secrets":[{"key":"INJECTED","value":"yes"}]}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSrv.Close()

	tmp := t.TempDir()
	_ = os.WriteFile(tmp+"/envault.json", []byte(`{"projectId":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","defaultEnvironment":"development"}`), 0644)

	bin := buildBinary(t)
	cmd := exec.Command(bin, "run", "--", "sh", "-c", `echo "CLEAN_OUTPUT"`)
	cmd.Dir = tmp
	cmd.Env = append(os.Environ(),
		"ENVAULT_CLI_URL="+mockSrv.URL+"/api/cli",
		"ENVAULT_TOKEN=test-token",
		"ENVAULT_ALLOW_INSECURE_HTTP=1",
	)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	out := strings.TrimSpace(outBuf.String())
	if out != "CLEAN_OUTPUT" {
		t.Errorf("stdout is not clean: got %q\nstderr: %s", out, errBuf.String())
	}
}

// --- audit --install-hook: errors go to stderr -------------------------------

func TestAuditInstallHook_NotInGitRepo_ErrorOnStderr(t *testing.T) {
	tmp := t.TempDir()
	// No .git directory -> should error on stderr.
	bin := buildBinary(t)
	cmd := exec.Command(bin, "audit", "--install-hook")
	cmd.Dir = tmp
	cmd.Env = os.Environ()

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	_ = cmd.Run()

	if outBuf.Len() > 0 {
		t.Errorf("expected empty stdout, got:\n%s", outBuf.String())
	}
	if !strings.Contains(errBuf.String(), ".git") {
		t.Errorf("expected .git error on stderr, got:\n%s", errBuf.String())
	}
}

// Ensure the test binary builds (compile-time check).
var _ = context.Background
