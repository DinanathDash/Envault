package cmd

import (
	"os"
	"strings"
	"time"
)

const defaultCLINetworkTimeout = 5 * time.Minute

func resolveCLINetworkTimeout(flagTimeout time.Duration) time.Duration {
	if flagTimeout > 0 {
		return flagTimeout
	}

	raw := strings.TrimSpace(os.Getenv("ENVAULT_RETRY_MAX_DURATION"))
	if raw == "" {
		return defaultCLINetworkTimeout
	}

	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return defaultCLINetworkTimeout
	}

	return d
}
