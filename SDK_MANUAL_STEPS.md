# Envault SDK Manual Setup Walkthrough

This file lists manual steps that require your access or decisions after the SDK productionization changes.

## 1. NPM Publishing Access (Required)
1. Confirm package ownership strategy:
- Keep package name as `@dinanathdash/envault-sdk`, or
- Rename in `src/lib/sdk/package.json` if needed before first publish.
2. Ensure your npm org/user has publish rights for the selected package name.
3. Configure npm Trusted Publishing for this repository/workflow (OIDC):
- npmjs.com -> Package Settings -> Trusted Publishers.
- Add this GitHub repository and workflow `.github/workflows/publish-sdk.yml`.
- Keep workflow branch scope on `main`.

## 2. GitHub Workflow Activation (Required)
1. Confirm workflow file is present:
- `.github/workflows/publish-sdk.yml`
2. Verify branch policy allows workflow execution on `main` pushes.
3. Optional hardening:
- Require workflow approval for first-time contributors.
- Restrict who can push to `main`.

## 3. SDK Compatibility Policy (Recommended)
1. Set minimum supported SDK version environment variable in deployment:
- `ENVAULT_SDK_MIN_SUPPORTED_VERSION`
2. Suggested policy:
- Set this to current stable minor baseline.
- Increase only for security/breaking requirements.

## 4. Optional Dedicated SDK Repository (Decision)
Use this only if you want complete repo-level isolation beyond folder-level isolation.

1. Create new repo (example: `envault-sdk`).
2. Move or mirror `src/lib/sdk/**` into the new repo root.
3. Add SDK-specific CI in that repo (build/test/publish).
4. Update package source links in `package.json`.
5. In this monorepo, keep only integration usage and remove local SDK package publishing workflow if you fully move release ownership.

## 5. GitHub Secrets for Cross-Repo Automation (Only if split repos)
If Envault main repo must trigger SDK repo releases, configure one of:
1. GitHub App with repository write access, or
2. Fine-grained PAT with access to the SDK repo.

Then add secret(s) to Envault repo, for example:
- `SDK_REPO_TOKEN` (custom automation)

## 6. Postinstall Prompt Behavior (Awareness)
The SDK postinstall script is intentionally:
1. Silent in CI (`CI=true` detected).
2. Interactive only when TTY is available.
3. Opt-in for notification helper install (`node-notifier`).

No action required unless your org policy disallows postinstall prompts; if so, remove `postinstall` from `src/lib/sdk/package.json`.

## 7. First Publish Dry Run (Recommended)
From `src/lib/sdk`:
1. `npm ci`
2. `npm run build`
3. `npm pack --dry-run`

Verify tarball contains only intended files (`dist`, `README.md`, package metadata).

## 8. Operational Checklist Before Production Tag
1. Confirm npm Trusted Publisher entry is configured for this repo/workflow.
2. Confirm package name availability/ownership.
3. Confirm `publish-sdk.yml` ran successfully on a SDK-only change.
4. Confirm consumers can install and import `@dinanathdash/envault-sdk`.
5. Confirm `/api/sdk-version` returns expected compatibility values in deployed environment.
