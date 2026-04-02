# Envault Manual Release Guide

This repo uses a hybrid release flow:

- App release: manual
- CLI release: automatic (GitHub Actions)

## Important: Two Separate Versions

- **App version**: root [`package.json`](./package.json) (`envault`)
- **CLI version**: [`cli-wrapper/package.json`](./cli-wrapper/package.json) (`@dinanathdash/envault`)

These are independent and should be bumped only when that surface changes.

## Release Ownership

- **Manual (you run commands):** App changelog + root app version
- **Automatic (CI runs it):** CLI version tag, binaries, npm wrapper publish

## How Landing Page CLI Version Works

- The landing page version badge calls `/api/cli-version`.
- That API reads `cli-wrapper/package.json` from the `main` branch on GitHub.
- So if you want the website to show a new CLI version, you must bump and push `cli-wrapper/package.json` to `main`.

## A) App Release (Web Product)

Use this when web/app features change.

1. Update changelog manually in [`CHANGELOG.mdx`](./CHANGELOG.mdx):
   - Move `Unreleased` items into a real version heading (example: `## 1.3.0 - 2026-03-10`).
2. Bump app version in root:

```bash
npm version <major|minor|patch> --no-git-tag-version
```

3. Review and commit:

```bash
git add CHANGELOG.mdx package.json package-lock.json
git commit -m "chore(app-release): bump app version to X.Y.Z"
git push origin main
```

Note: App releases do **not** need the `vX.Y.Z` git tag used by CLI distribution.

## B) CLI Release (Automatic)

When changes are pushed to `main` that touch `cli-go/**` or `cli-wrapper/**`, CI automatically:

1. Determines next CLI version from commit messages.
2. Creates/pushes tag `vX.Y.Z`.
3. Runs GoReleaser for binaries + GitHub release assets.
4. Publishes `@dinanathdash/envault` from `cli-wrapper/package.json`.
5. Commits the bumped `cli-wrapper/package.json` back to `main`.

Guardrail: if commits since the last CLI tag include non-CLI file changes, the CLI workflow skips release to keep CLI notes clean.

### Keep CLI release notes focused on CLI changes

- Keep CLI work in dedicated PRs/commits (avoid mixing app-only commits in the same merge).
- If app and CLI must both change, prefer separate merges so CLI auto-release does not skip.
- Prefer conventional commit messages for CLI changes:
  - `feat(cli): ...`
  - `fix(cli): ...`
  - `perf(cli): ...`
  - `refactor(cli): ...`
- This makes release notes and commit info clearer in CLI releases.

## C) If Both App and CLI Changed

Do both tracks in one PR, but only app versioning is manual:

1. Update `CHANGELOG.mdx` for app.
2. Bump root app version if app changed.
3. Commit and push to `main`.
4. If CLI files changed in that push, CLI release runs automatically.

## Quick Sanity Checklist Before Release

- `git status` is clean before app version bump.
- CLI changes are committed with clear CLI-focused commit messages.
- GitHub release assets exist for new CLI tag (`vX.Y.Z`).
- `npm view @dinanathdash/envault version` matches `cli-wrapper/package.json` after CI release.
- Landing page `/api/cli-version` returns the expected CLI version after push.
