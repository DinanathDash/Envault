# Envault Notification Branding and Trust Roadmap

## Purpose
Create a production-grade, cross-platform notification path for Envault SDK users that:
- Preserves reliable approval pings.
- Uses Envault branding where platform rules allow.
- Avoids confusing sender identities (for example Terminal or Script Editor) for mainstream users.
- Transitions safely from current developer-first CLI distribution to signed native helpers.

## Current State (as of 2026-04-03)
- macOS notification path currently relies on CLI channels.
- `terminal-notifier` works when installed and supports click-through URL opening.
- Sender identity icon on macOS banners is still controlled by sender app identity, not always custom image.
- Fallbacks are intentionally conservative to avoid opening unexpected apps.
- Local default URL for tests is `https://envault.localhost:1355`.

## Desired End State
- Envault notifications appear from a trusted, signed Envault-native helper on each OS.
- Primary sender identity is Envault (not terminal host).
- Installation experience is explicit, secure, and low-friction.
- SDK can detect helper health and choose best channel at runtime.
- Documentation clearly explains trust posture, constraints, and roadmap.

## Scope
### In Scope
- Native notifier helper design and rollout plan (macOS, Windows, Linux).
- Signing, notarization, and distribution pipeline.
- SDK runtime channel selection and fallback behavior.
- User-facing docs and transparency messaging.
- Validation, telemetry, and support playbooks.

### Out of Scope (for this roadmap)
- Replacing SDK auth/approval architecture.
- Full desktop app development.
- Rewriting existing approval UX in web app.

## Guiding Principles
1. Security over convenience.
2. Predictable behavior across environments.
3. Clear user messaging during degraded modes.
4. Minimal hidden side effects.
5. Progressive enhancement: reliable ping first, polished branding second.

## High-Level Architecture
1. SDK Core
- Owns notification intent (title, message, approval URL, urgency, correlation ID).
- Calls a notifier adapter interface.

2. Notifier Adapter
- Detects available channels in priority order.
- Emits structured diagnostics for each attempt.
- Returns standardized result codes (`delivered`, `fallback`, `failed`).

3. Native Helper Layer (future default)
- OS-specific signed helper binary/app.
- Receives a sanitized payload from SDK.
- Uses platform-native notification APIs.

4. Fallback Layer
- Existing CLI notifier channels retained for developer environments.
- No stealth bypass behavior.
- Explicit user guidance if native channel unavailable.

## Delivery Phases

## Phase 0: Stabilize Current CLI Path (Complete/Active)
### Goals
- Keep notification delivery reliable during SDK build-out.
- Eliminate misleading fallback actions.

### Tasks
- Keep terminal attention cue as universal baseline.
- Keep local domain defaults aligned to Envault local/prod constraints.
- Ensure URL click-through works when notification is delivered.
- Keep clear logs when channel is unavailable.

### Exit Criteria
- Notification smoke test passes in local dev.
- No unexpected browser auto-open in degraded path.

## Phase 1: Add Diagnostics and Channel Contracts
### Goals
- Make support and debugging deterministic.

### Tasks
- Add notifier status command (for example `envault doctor notifications`).
- Print detected channels and why each is accepted/rejected.
- Add channel metrics counters in SDK logs (non-sensitive).
- Define adapter interface and result taxonomy.

### Exit Criteria
- Support can diagnose notification issues from one command output.
- SDK surfaces one concise recommendation per failure mode.

## Phase 2: Native macOS Helper (Priority 1)
### Goals
- Achieve trusted Envault sender identity on macOS.

### Helper Requirements
- App bundle (for example `EnvaultNotifier.app`) with bundle ID `com.envault.notifier`.
- Uses `UNUserNotificationCenter` for delivery.
- Handles click action to open approval URL.
- Supports controlled icon assets from app bundle.

### Signing & Release Requirements
- Apple Developer Program enrollment.
- Developer ID Application certificate.
- Hardened runtime.
- Notarization via `notarytool`.
- Stapled ticket before distribution.

### SDK Integration
- Detect installed helper and version.
- Send payload via local IPC/CLI bridge.
- Fall back to CLI channels only if helper unavailable.

### Exit Criteria
- Notification appears with Envault app identity on clean macOS install.
- No Gatekeeper warning on first launch.

## Phase 3: Native Windows Helper (Priority 2)
### Goals
- Improve trust and reduce SmartScreen friction.

### Helper Requirements
- Signed notifier executable or lightweight tray helper.
- Uses native toast notifications with stable app identity (AUMID/AppUserModelID).
- Click action opens approval URL.

### Signing Requirements
- Code-signing certificate (OV minimum, EV recommended for faster reputation).
- Timestamped signatures for long-term trust.

### Exit Criteria
- Notification sender identity is stable.
- First-run warnings reduced versus unsigned binary.

## Phase 4: Linux Helper/Packaging (Priority 3)
### Goals
- Improve consistency while respecting distro diversity.

### Strategy
- Native helper optional.
- First-class support for `notify-send`/DBus notification service.
- Package via common channels (`deb`/`rpm`/tarball + checksums/GPG).

### Trust Model
- No mandatory paid signing equivalent like Apple.
- Use checksums and signature verification guidance.

### Exit Criteria
- Reliable notification on major desktop environments.
- Clear unsupported-environment messaging (headless servers).

## Phase 5: Default to Native Helpers in SDK
### Goals
- Promote trusted path as default for end users.

### Tasks
- Installer flow adds helper per platform.
- SDK verifies helper integrity and version compatibility.
- Feature flag fallback for emergency rollback.

### Exit Criteria
- 90%+ notification delivery via native helper on supported desktop devices.
- Support tickets for notification identity drop significantly.

## Security and Privacy Requirements
1. Never include secret values in notifications.
2. Keep payload minimal: title, summary text, URL, metadata ID.
3. Validate URLs against allowed Envault domains.
4. Log channel outcomes, not sensitive payload bodies.
5. Harden helper IPC against arbitrary invocation.

## SDK Runtime Behavior (Target)
Priority order per platform:
1. Native Envault helper.
2. Supported local notifier channel.
3. Terminal attention + explicit action log.

Failure behavior:
- No silent fail.
- No hidden app launches without explicit policy.
- One actionable remediation line per failure.

## Cost and Resource Planning
## Minimum Budget View
- macOS: Apple Developer Program annual cost required for trusted distribution.
- Windows: Code-signing certificate cost (OV/EV tier dependent).
- Linux: No mandatory paid signing program, but packaging and maintenance effort required.

## Team Capacity Assumptions
- 1 engineer part-time can complete phased rollout over multiple milestones.
- macOS helper and signing pipeline should be first investment.

## Documentation Plan
## User Docs
Update install and notification docs with:
- Current channel behavior by OS.
- Known limitations of CLI-only sender identity.
- Security guarantees (approval still required).
- Clear migration note: "Native signed helpers are rolling out."

## Trust/Transparency Note (recommended wording draft)
"Envault is currently distributed in a developer-first model while we complete native signed notifier rollout. Core approval security checks are enforced regardless of notification channel. Platform trust UX will continue to improve as signed helpers are released per OS."

## Support Docs
- Troubleshooting matrix per OS.
- One-command diagnostics output examples.
- Decision tree for "notification not visible".

## Testing Plan
## Automated
- Unit tests for adapter selection logic.
- Integration test for payload validation and URL allowlist.
- Smoke tests for fallback decision paths.

## Manual QA Matrix
- macOS: clean machine, no helper, helper installed, helper outdated, DnD on/off.
- Windows: unsigned vs signed helper behavior.
- Linux: desktop session vs headless session.

## Release Gates
- No regression in approval flow if notifications fail.
- Notification failures produce actionable user guidance.
- Signed artifacts verified in CI before publish.

## Risks and Mitigations
1. Risk: Signing delays block release.
- Mitigation: Keep CLI fallback path and clear docs.

2. Risk: Platform API changes affect icon rendering.
- Mitigation: Snapshot tests + OS-version QA matrix.

3. Risk: Users perceive warning prompts as insecurity.
- Mitigation: Transparent docs + signed rollout priority.

4. Risk: Helper mismatch with SDK versions.
- Mitigation: version handshake and minimum-supported-helper checks.

## Milestone Checklist
## Milestone A (post-SDK completion)
- [ ] Lock notifier adapter interface.
- [ ] Add diagnostics command and log schema.
- [ ] Publish updated docs note.

## Milestone B (macOS trusted path)
- [ ] Build `EnvaultNotifier.app` prototype.
- [ ] Configure signing + notarization in CI.
- [ ] Release helper install flow and verify on clean macOS.

## Milestone C (Windows trusted path)
- [ ] Implement Windows toast helper.
- [ ] Add code-signing pipeline.
- [ ] Validate SmartScreen behavior improvements.

## Milestone D (Linux consistency)
- [ ] Improve distro packaging guidance.
- [ ] Add desktop/headless detection messaging.
- [ ] Finalize support matrix.

## Done Definition
This roadmap is complete when:
- End users receive Envault-branded notification identity on supported platforms through signed native helpers.
- SDK behavior is deterministic under degraded conditions.
- Documentation is transparent and trust-preserving for current and future distribution models.
