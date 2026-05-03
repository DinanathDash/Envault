package cmd

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestComputeDiffFromMap(t *testing.T) {
	mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
                        "secrets": [
                                {"key": "UNCHANGED", "ciphertext": "<<DECRYPTION_FAILED>>", "dek": ""},
                                {"key": "MODIFIED", "ciphertext": "<<DECRYPTION_FAILED>>", "dek": ""},
                                {"key": "DELETED", "ciphertext": "<<DECRYPTION_FAILED>>", "dek": ""}
                        ]
                }`))
	}))
	defer mockSrv.Close()

	oldURL := os.Getenv("ENVAULT_CLI_URL")
	os.Setenv("ENVAULT_CLI_URL", mockSrv.URL)
	os.Setenv("ENVAULT_ALLOW_INSECURE_HTTP", "1")
	defer func() {
		os.Setenv("ENVAULT_CLI_URL", oldURL)
		os.Unsetenv("ENVAULT_ALLOW_INSECURE_HTTP")
	}()

	localEnv := map[string]string{
		"UNCHANGED": "<<DECRYPTION_FAILED>>", // Match the plaintext resulting from crypto failure
		"MODIFIED":  "new-value",
		"ADDED":     "brand-new",
	}

	res, err := computeDiffFromMap(context.Background(), "test-proj", "test-env", localEnv)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Unchanged != 1 {
		t.Errorf("expected 1 unchanged, got %d", res.Unchanged)
	}
	if len(res.Additions) != 1 || res.Additions[0] != "ADDED" {
		t.Errorf("expected 1 addition (ADDED), got %v", res.Additions)
	}
	if len(res.Modifications) != 1 || res.Modifications[0] != "MODIFIED" {
		t.Errorf("expected 1 modification (MODIFIED), got %v", res.Modifications)
	}
	if len(res.Deletions) != 1 || res.Deletions[0] != "DELETED" {
		t.Errorf("expected 1 deletion (DELETED), got %v", res.Deletions)
	}
}
