---
name: envault
description: Official AI Agent Skill for Envault Secrets Management platform. Enforces strict zero-hardcode rules, Client-Side Encryption, and Human-in-the-Loop (HITL) approval workflows.
---

# Envault Agent Skill

This skill provides critical instructions for interacting with the Envault Secrets Management platform. Envault uses strict Client-Side Encryption and Human-in-the-Loop (HITL) approvals. As an AI agent, you must strictly adhere to the following rules when working with Envault.

## 1. THE ZERO-HARDCODE RULE (`envault run`)

Envault injects secrets directly into process memory.
- You must **NEVER** create, modify, or suggest creating `.env` files.
- When writing scripts or running tests that require environment variables, you must execute them using the runtime wrapper:
  `envault run --env <environment> -- <command>`

## 2. THE HITL NAVIGATOR (Handling Mutations)

Envault's MCP server uses a delegated token model with active Human-in-the-Loop (HITL) safeguards.
- When you attempt to mutate a secret (e.g., using `envault_push` or `envault_deploy`), the server intercepts the request and returns a `202 Accepted` response. This response includes an `approval_id` and an `approval_url`.
- **A `202 Accepted` is NOT a failure.**
- You must immediately **stop execution**, present the approval link to the user, and wait for the user to approve it via the UI or by typing `envault approve <approval_id>` in the terminal.
- You must **not** retry the mutation automatically.

## 3. GIT COMPLIANCE

Envault has active safeguards regarding git tracking.
- If an `envault pull` or `envault deploy` command fails because a file is already tracked in git, you must **not** try to force the operation.
- Instead, you must:
  1. Execute `git rm --cached <file>` to untrack the file.
  2. Ensure the file is added to `.gitignore`.
  3. Retry the Envault command.
