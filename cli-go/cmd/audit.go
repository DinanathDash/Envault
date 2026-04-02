package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/DinanathDash/Envault/cli-go/internal/ui"
	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

// AuditIssue represents a single finding from the audit.
type AuditIssue struct {
	Level   string   `json:"level"`          // "error" | "warning"
	Code    string   `json:"code"`           // machine-readable identifier
	Message string   `json:"message"`        // human-readable description
	Keys    []string `json:"keys,omitempty"` // affected env keys, if applicable
}

// AuditSummary holds counts of errors and warnings.
type AuditSummary struct {
	Errors   int `json:"errors"`
	Warnings int `json:"warnings"`
}

// AuditResult is the top-level result structure, used for both text and JSON output.
type AuditResult struct {
	Passed  bool         `json:"passed"`
	Issues  []AuditIssue `json:"issues"`
	Summary AuditSummary `json:"summary"`
}

// Flags
var (
	auditStrict      bool
	auditFormat      string
	auditInstallHook bool
	auditTemplate    string
	auditEnvFile     string
)

// placeholderRe matches common placeholder / unfilled values.
var placeholderRe = regexp.MustCompile(
	`(?i)^(your[_\-].*|todo|change[_\-]?me|replace[_\-]?me|<[^>]+>|\[[^\]]+\]|xxx+|placeholder|example[_\-].*|changeme|fixme|insert[_\- ].*here|add[_\- ].*here|put[_\- ].*here|n/?a|none|null|undefined|secret|password|token)$`,
)

var auditCmd = &cobra.Command{
	Use:   "audit",
	Short: "Audit environment files for structural integrity and git safety",
	Long: `Validate the structural integrity and git status of local environment files.

Checks performed:
  - .gitignore contains patterns that exclude .env files
  - No .env files (non-templates) are tracked in the git tree
  - Local .env keys match the template (.env.example by default)
  - No keys have empty or placeholder values

Use --install-hook to embed this audit into the local git pre-commit hook.`,
	Run: func(cmd *cobra.Command, args []string) {
		if auditInstallHook {
			runInstallHook()
			return
		}
		runAudit()
	},
}

func init() {
	rootCmd.AddCommand(auditCmd)
	auditCmd.Flags().BoolVar(&auditStrict, "strict", false, "Treat warnings as errors (non-zero exit if any warnings)")
	auditCmd.Flags().StringVar(&auditFormat, "format", "text", "Output format: text or json")
	auditCmd.Flags().BoolVar(&auditInstallHook, "install-hook", false, "Install envault audit as a git pre-commit hook")
	auditCmd.Flags().StringVar(&auditTemplate, "template", ".env.example", "Template file to validate parity against")
	auditCmd.Flags().StringVar(&auditEnvFile, "file", ".env", "Local env file to audit")
}

// --- Hook Installation --------------------------------------------------------

const hookMarker = "# envault-audit-hook"

// installPreCommitHook is the shared, error-returning implementation used by
// both `envault audit --install-hook` and `envault init` (automatic install).
//
// Returns:
//   - alreadyInstalled: true when the marker was already present (no-op)
//   - binPath: absolute path of the binary embedded in the hook
//   - err: non-nil on any filesystem or binary-resolution failure
func installPreCommitHook() (alreadyInstalled bool, binPath string, err error) {
	// Not inside a git repo - silently skip rather than error during init.
	if _, statErr := os.Stat(".git"); os.IsNotExist(statErr) {
		return false, "", fmt.Errorf("no .git directory found")
	}

	// Prefer the PATH-based lookup so the hook embeds the stable symlink
	// (e.g. /opt/homebrew/bin/envault) rather than the versioned Cellar path
	// (/opt/homebrew/Cellar/envault/1.20.0/bin/envault).  Using the symlink
	// means the hook survives `brew upgrade --formula envault` without needing
	// re-installation.  Fall back to os.Executable() when not on PATH.
	execPath, lookErr := exec.LookPath("envault")
	if lookErr != nil {
		var execErr error
		execPath, execErr = os.Executable()
		if execErr != nil {
			return false, "", fmt.Errorf("could not determine executable path: %w", execErr)
		}
	}
	execPath, _ = filepath.Abs(execPath)

	hooksDir := ".git/hooks"
	hookPath := hooksDir + "/pre-commit"

	if mkErr := os.MkdirAll(hooksDir, 0755); mkErr != nil {
		return false, execPath, fmt.Errorf("could not create hooks directory: %w", mkErr)
	}

	var existing string
	if data, readErr := os.ReadFile(hookPath); readErr == nil {
		existing = string(data)
	}

	// Idempotency guard.
	if strings.Contains(existing, hookMarker) {
		return true, execPath, nil
	}

	var sb strings.Builder
	if existing == "" {
		sb.WriteString("#!/bin/sh\n")
	} else {
		sb.WriteString(existing)
		if !strings.HasSuffix(existing, "\n") {
			sb.WriteByte('\n')
		}
	}
	sb.WriteString("\n")
	sb.WriteString(hookMarker + "\n")
	sb.WriteString(fmt.Sprintf("ENVAULT_BIN=%q\n", execPath))
	sb.WriteString("if [ ! -x \"$ENVAULT_BIN\" ]; then\n")
	sb.WriteString("  echo \"\"\n")
	sb.WriteString("  echo \"envault pre-commit hook: Envault audit could not run.\"\n")
	sb.WriteString("  echo \"Reason: binary not found at: $ENVAULT_BIN\"\n")
	sb.WriteString("  echo \"Fix:    re-install the hook by running: envault audit --install-hook\"\n")
	sb.WriteString("  echo \"\"\n")
	sb.WriteString("  exit 1\n")
	sb.WriteString("fi\n")
	sb.WriteString("\"$ENVAULT_BIN\" audit --strict\n")

	if writeErr := os.WriteFile(hookPath, []byte(sb.String()), 0755); writeErr != nil {
		return false, execPath, fmt.Errorf("failed to write pre-commit hook: %w", writeErr)
	}

	return false, execPath, nil
}

// runInstallHook is the CLI-facing wrapper for `envault audit --install-hook`.
// It calls installPreCommitHook and handles printing / os.Exit behaviour.
func runInstallHook() {
	alreadyInstalled, binPath, err := installPreCommitHook()
	if err != nil {
		if strings.Contains(err.Error(), "no .git directory") {
			fmt.Fprintln(os.Stderr, ui.ColorRed("[X] No .git directory found. Run this command from the root of a git repository."))
		} else {
			fmt.Fprintln(os.Stderr, ui.ColorRed(fmt.Sprintf("[X] %v", err)))
		}
		os.Exit(1)
	}
	if alreadyInstalled {
		fmt.Println(ui.ColorYellow("[i] envault audit hook is already installed in .git/hooks/pre-commit"))
		return
	}
	fmt.Println(ui.ColorGreen("[OK] Pre-commit hook installed at .git/hooks/pre-commit"))
	fmt.Printf("%s  %s\n", ui.ColorDim("  Binary:"), ui.ColorCyan(binPath))
	fmt.Println(ui.ColorDim("  envault audit --strict will run automatically before each commit."))
}

// --- Audit Runner -------------------------------------------------------------

func runAudit() {
	var issues []AuditIssue

	issues = append(issues, checkGitignore()...)
	issues = append(issues, checkTrackedEnvFiles()...)
	issues = append(issues, checkParity()...)

	// Strict mode: promote all warnings to errors.
	if auditStrict {
		for i := range issues {
			if issues[i].Level == "warning" {
				issues[i].Level = "error"
			}
		}
	}

	// Tally results.
	errCount := 0
	warnCount := 0
	for _, issue := range issues {
		switch issue.Level {
		case "error":
			errCount++
		case "warning":
			warnCount++
		}
	}

	result := AuditResult{
		Passed:  errCount == 0,
		Issues:  issues,
		Summary: AuditSummary{Errors: errCount, Warnings: warnCount},
	}

	switch auditFormat {
	case "json":
		data, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(data))
	default:
		printAuditResult(result)
	}

	if !result.Passed {
		os.Exit(1)
	}
}

// --- Check: .gitignore --------------------------------------------------------

func checkGitignore() []AuditIssue {
	f, err := os.Open(".gitignore")
	if err != nil {
		return []AuditIssue{{
			Level:   "warning",
			Code:    "GITIGNORE_MISSING",
			Message: ".gitignore file not found. Environment files may be accidentally committed.",
		}}
	}
	defer f.Close()

	// Patterns that adequately protect .env files.
	sufficient := []string{".env", "*.env", ".env.*", "**/.env"}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		for _, pat := range sufficient {
			if line == pat {
				return nil // at least one protective pattern found
			}
		}
	}

	return []AuditIssue{{
		Level:   "error",
		Code:    "GITIGNORE_ENV_MISSING",
		Message: "No environment file pattern (e.g., .env, *.env, .env.*) found in .gitignore. Environment files may be accidentally committed.",
	}}
}

// --- Check: tracked .env files -----------------------------------------------

func checkTrackedEnvFiles() []AuditIssue {
	out, err := exec.Command("git", "ls-files").Output()
	if err != nil {
		// Not a git repo or git not available - skip silently.
		return nil
	}

	var issues []AuditIssue
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		if isTrackedEnvFile(name) {
			issues = append(issues, AuditIssue{
				Level:   "error",
				Code:    "ENV_FILE_TRACKED",
				Message: fmt.Sprintf("Environment file '%s' is tracked in the git tree and may expose secrets.", name),
			})
		}
	}
	return issues
}

// isTrackedEnvFile returns true when the path looks like a real env file
// (not a template/example variant).
func isTrackedEnvFile(name string) bool {
	// Consider only the filename, not the directory part.
	base := name
	if idx := strings.LastIndex(name, "/"); idx >= 0 {
		base = name[idx+1:]
	}

	// Must be ".env" itself, start with ".env.", or end with ".env".
	isEnvFile := base == ".env" || strings.HasPrefix(base, ".env.") || strings.HasSuffix(base, ".env")
	if !isEnvFile {
		return false
	}

	// Exclude well-known template suffixes.
	lower := strings.ToLower(base)
	for _, token := range []string{"example", "sample", "template", "dist", "defaults", "test", "ci"} {
		if strings.Contains(lower, token) {
			return false
		}
	}

	return true
}

// --- Shared safety helpers ----------------------------------------------------

// isTrackedByGit returns true if path is currently tracked in the git index.
// Returns false when git is unavailable or the working directory has no repo.
func isTrackedByGit(path string) bool {
	err := exec.Command("git", "ls-files", "--error-unmatch", path).Run()
	return err == nil
}

// ensureGitignoreEntry guarantees the given filename is covered by at least
// one pattern in .gitignore. If .gitignore does not exist it is created; if it
// exists but has no covering pattern, the exact filename is appended.
//
// "Covered" means one of these lines already appears in the file:
//
//	.env   *.env   .env.*   **/.env   or an exact match of filename
func ensureGitignoreEntry(filename string) (added bool, err error) {
	// Strip any leading "./" from filename for comparison.
	base := strings.TrimPrefix(filename, "./")

	// Patterns that broadly cover standard .env files.
	broadPatterns := []string{".env", "*.env", ".env.*", "**/.env"}

	data, readErr := os.ReadFile(".gitignore")
	if readErr == nil {
		// File exists - scan line by line.
		scanner := bufio.NewScanner(strings.NewReader(string(data)))
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if line == base {
				return false, nil // already covered by exact match
			}
			for _, pat := range broadPatterns {
				if line == pat {
					return false, nil // covered by a broad pattern
				}
			}
		}

		// Not covered - append the exact filename.
		f, openErr := os.OpenFile(".gitignore", os.O_APPEND|os.O_WRONLY, 0644)
		if openErr != nil {
			return false, fmt.Errorf("could not open .gitignore: %w", openErr)
		}
		defer f.Close()

		// Ensure we start on a new line.
		if len(data) > 0 && data[len(data)-1] != '\n' {
			if _, writeErr := f.WriteString("\n"); writeErr != nil {
				return false, writeErr
			}
		}
		if _, writeErr := f.WriteString(base + "\n"); writeErr != nil {
			return false, writeErr
		}
		return true, nil
	}

	// .gitignore does not exist - create it.
	if writeErr := os.WriteFile(".gitignore", []byte(base+"\n"), 0644); writeErr != nil {
		return false, fmt.Errorf("could not create .gitignore: %w", writeErr)
	}
	return true, nil
}

// --- Check: parity with template ---------------------------------------------

func checkParity() []AuditIssue {
	// 1. Attempt to read the template file.
	templateEnv, err := godotenv.Read(auditTemplate)
	if err != nil {
		if os.IsNotExist(err) {
			return []AuditIssue{{
				Level:   "warning",
				Code:    "TEMPLATE_MISSING",
				Message: fmt.Sprintf("Template file '%s' not found. Parity check skipped.", auditTemplate),
			}}
		}
		return []AuditIssue{{
			Level:   "error",
			Code:    "TEMPLATE_PARSE_ERROR",
			Message: fmt.Sprintf("Could not parse template '%s': %s", auditTemplate, sanitizeParseErr(err)),
		}}
	}

	// 2. Attempt to read the local env file.
	// When the user has not explicitly set --file and the default '.env' does
	// not exist, walk a prioritised list of well-known env file names so that
	// projects using .env.local, .env.development, etc. are handled without
	// requiring a manual --file flag.
	resolvedEnvFile := auditEnvFile
	if _, statErr := os.Stat(resolvedEnvFile); os.IsNotExist(statErr) {
		candidates := []string{
			".env.local",
			".env.development.local",
			".env.development",
			".env.test.local",
			".env.test",
			".env.production.local",
			".env.production",
			".env.staging",
			".env.preview",
		}
		for _, c := range candidates {
			if _, cErr := os.Stat(c); cErr == nil {
				resolvedEnvFile = c
				break
			}
		}
	}

	localEnv, err := godotenv.Read(resolvedEnvFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []AuditIssue{{
				Level:   "error",
				Code:    "ENV_FILE_MISSING",
				Message: fmt.Sprintf("Local env file not found. Looked for '%s' and common variants (.env.local, .env.development, etc.).", auditEnvFile),
			}}
		}
		return []AuditIssue{{
			Level:   "error",
			Code:    "ENV_FILE_PARSE_ERROR",
			Message: fmt.Sprintf("Could not parse '%s': %s", resolvedEnvFile, sanitizeParseErr(err)),
		}}
	}

	var issues []AuditIssue

	// 3. Missing keys: present in template but absent in local.
	var missingKeys []string
	for k := range templateEnv {
		if _, ok := localEnv[k]; !ok {
			missingKeys = append(missingKeys, k)
		}
	}
	if len(missingKeys) > 0 {
		sort.Strings(missingKeys)
		issues = append(issues, AuditIssue{
			Level:   "error",
			Code:    "MISSING_KEYS",
			Message: fmt.Sprintf("%d key(s) defined in '%s' are missing from '%s'.", len(missingKeys), auditTemplate, resolvedEnvFile),
			Keys:    missingKeys,
		})
	}

	// 4. Orphaned keys: present in local but absent in template.
	var orphanedKeys []string
	for k := range localEnv {
		if _, ok := templateEnv[k]; !ok {
			orphanedKeys = append(orphanedKeys, k)
		}
	}
	if len(orphanedKeys) > 0 {
		sort.Strings(orphanedKeys)
		issues = append(issues, AuditIssue{
			Level:   "warning",
			Code:    "ORPHANED_KEYS",
			Message: fmt.Sprintf("%d key(s) in '%s' are not defined in the template '%s'.", len(orphanedKeys), resolvedEnvFile, auditTemplate),
			Keys:    orphanedKeys,
		})
	}

	// 5. Empty or placeholder values in local env.
	var placeholderKeys []string
	for k, v := range localEnv {
		v = strings.TrimSpace(v)
		if v == "" || placeholderRe.MatchString(v) {
			placeholderKeys = append(placeholderKeys, k)
		}
	}
	if len(placeholderKeys) > 0 {
		sort.Strings(placeholderKeys)
		issues = append(issues, AuditIssue{
			Level:   "error",
			Code:    "PLACEHOLDER_VALUES",
			Message: fmt.Sprintf("%d key(s) in '%s' have empty or placeholder values.", len(placeholderKeys), auditEnvFile),
			Keys:    placeholderKeys,
		})
	}

	return issues
}

// --- Text Renderer ------------------------------------------------------------

// issueSection maps each code to its display section.
var issueSection = map[string]string{
	"GITIGNORE_MISSING":     "git",
	"GITIGNORE_ENV_MISSING": "git",
	"ENV_FILE_TRACKED":      "git",
	"TEMPLATE_MISSING":      "parity",
	"TEMPLATE_PARSE_ERROR":  "parity",
	"ENV_FILE_MISSING":      "parity",
	"ENV_FILE_PARSE_ERROR":  "parity",
	"MISSING_KEYS":          "parity",
	"ORPHANED_KEYS":         "parity",
	"PLACEHOLDER_VALUES":    "parity",
}

// sectionOrder defines display order and labels for sections.
var sectionOrder = []struct {
	key   string
	label string
}{
	{"git", "GIT SAFETY"},
	{"parity", "KEY PARITY"},
}

func printAuditResult(result AuditResult) {
	const sepLen = 56
	sep := ui.ColorDim(strings.Repeat("-", sepLen))

	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#22D3EE")).
		Width(sepLen).
		Align(lipgloss.Center)

	sectionStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#9CA3AF"))

	fmt.Println()
	fmt.Println(titleStyle.Render("ENVAULT AUDIT"))
	fmt.Println(sep)

	if len(result.Issues) == 0 {
		fmt.Println()
		fmt.Printf("  %s\n\n", ui.ColorGreen("[OK]  All checks passed. No issues found."))
		fmt.Println(sep)
		fmt.Printf("  %s\n", lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#34D399")).Render("[OK]  PASSED"))
		fmt.Println(sep)
		fmt.Println()
		return
	}

	// Index issues by code for grouped rendering.
	issueByCode := map[string]AuditIssue{}
	for _, issue := range result.Issues {
		issueByCode[issue.Code] = issue
	}

	for _, sec := range sectionOrder {
		// Collect issues belonging to this section, in canonical order.
		var secIssues []AuditIssue
		for _, codeOrder := range []string{
			"GITIGNORE_MISSING", "GITIGNORE_ENV_MISSING", "ENV_FILE_TRACKED",
			"TEMPLATE_MISSING", "TEMPLATE_PARSE_ERROR", "ENV_FILE_MISSING", "ENV_FILE_PARSE_ERROR",
			"MISSING_KEYS", "ORPHANED_KEYS", "PLACEHOLDER_VALUES",
		} {
			if issueSection[codeOrder] == sec.key {
				if issue, ok := issueByCode[codeOrder]; ok {
					secIssues = append(secIssues, issue)
				}
			}
		}
		if len(secIssues) == 0 {
			continue
		}

		fmt.Println()
		fmt.Printf("  %s\n", sectionStyle.Render(sec.label))
		fmt.Println()

		for _, issue := range secIssues {
			var icon, badge, msg string
			switch issue.Level {
			case "error":
				icon = ui.ColorRed("[X]")
				badge = lipgloss.NewStyle().
					Bold(true).
					Foreground(lipgloss.Color("#F87171")).
					Render(issue.Code)
				msg = ui.ColorRed(issue.Message)
			case "warning":
				icon = ui.ColorYellow("[!]")
				badge = lipgloss.NewStyle().
					Bold(true).
					Foreground(lipgloss.Color("#FBBF24")).
					Render(issue.Code)
				msg = ui.ColorYellow(issue.Message)
			default:
				icon = ui.ColorBlue("[i]")
				badge = lipgloss.NewStyle().
					Bold(true).
					Foreground(lipgloss.Color("#60A5FA")).
					Render(issue.Code)
				msg = issue.Message
			}

			fmt.Printf("  %s  %s\n", icon, badge)
			fmt.Printf("     %s\n", msg)
			if len(issue.Keys) > 0 {
				fmt.Println()
				for _, k := range issue.Keys {
					fmt.Printf("       %s  %s\n", ui.ColorDim("-"), k)
				}
			}
			fmt.Println()
		}
	}

	fmt.Println(sep)
	if result.Passed {
		passStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#34D399"))
		fmt.Printf("  %s   %s\n",
			passStyle.Render("[OK]  PASSED"),
			ui.ColorDim(fmt.Sprintf("%d errors - %d warnings", result.Summary.Errors, result.Summary.Warnings)),
		)
	} else {
		failStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#F87171"))
		fmt.Printf("  %s   %s\n",
			failStyle.Render("[X]  FAILED"),
			ui.ColorDim(fmt.Sprintf("%d errors - %d warnings", result.Summary.Errors, result.Summary.Warnings)),
		)
	}
	fmt.Println(sep)
	fmt.Println()
}

// sanitizeParseErr trims godotenv error messages that embed raw file content
// after the "near" keyword, producing a clean single-line diagnostic.
func sanitizeParseErr(err error) string {
	msg := err.Error()
	if idx := strings.Index(msg, " near "); idx > 0 {
		// Keep everything up to "near ..." but strip the file-content dump.
		// Show only the first 60 chars of the "near" excerpt so users can
		// spot which character caused the issue without a wall of text.
		suffix := msg[idx+6:] // skip " near "
		if len(suffix) > 60 {
			suffix = suffix[:60] + "..."
		}
		return msg[:idx] + ` near "` + suffix + `"`
	}
	const maxLen = 120
	if len(msg) > maxLen {
		return msg[:maxLen] + "..."
	}
	return msg
}
