import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { EnvaultAgentClient } from "../src/lib/sdk/agent-interceptor";

type FetchInvocation = {
  input: string;
  init?: RequestInit;
};

const originalCwd = process.cwd();
const originalFetch = globalThis.fetch;
const originalProjectEnv = process.env.ENVAULT_PROJECT_ID;
const originalWarn = console.warn;

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makePendingResponse(overrides?: Partial<Record<string, unknown>>): Response {
  return new Response(
    JSON.stringify({
      status: "pending",
      approval_id: "approval-001",
      approval_url: "https://envault.tech/approve/approval-001",
      ...overrides,
    }),
    {
      status: 202,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function installFetchSpy(responseFactory: () => Response): FetchInvocation[] {
  const calls: FetchInvocation[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return responseFactory();
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  if (originalProjectEnv === undefined) {
    delete process.env.ENVAULT_PROJECT_ID;
  } else {
    process.env.ENVAULT_PROJECT_ID = originalProjectEnv;
  }
});

test("resolves projectId from envault.json with expected format", async () => {
  const dir = tempDir("envault-agent-json-");
  process.chdir(dir);
  writeFileSync(
    path.join(dir, "envault.json"),
    JSON.stringify({
      projectId: "9bdc9567-0fd7-472b-af5f-29fd9771227e",
      defaultEnvironment: "development",
    }),
  );

  process.env.ENVAULT_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const calls = installFetchSpy(() => makePendingResponse());

  const client = new EnvaultAgentClient("https://envault.tech", "envault_agt_test");
  const result = (await client.executeMutation({
    mutations: [{ key: "DB_PASSWORD", value: "secret", action: "upsert" }],
  })) as { project_id: string; approve_command: string };

  const secretsCall = calls.find((call) => call.input.endsWith("/api/sdk/secrets"));
  assert.ok(secretsCall, "expected /api/sdk/secrets call");

  const body = JSON.parse(String(secretsCall?.init?.body));
  assert.equal(body.projectId, "9bdc9567-0fd7-472b-af5f-29fd9771227e");
  assert.equal(result.project_id, "9bdc9567-0fd7-472b-af5f-29fd9771227e");
  assert.equal(result.approve_command, "envault approve approval-001");
});

test("falls back to ENVAULT_PROJECT_ID when envault.json is absent", async () => {
  const dir = tempDir("envault-agent-env-");
  process.chdir(dir);

  process.env.ENVAULT_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const calls = installFetchSpy(() => makePendingResponse());

  const client = new EnvaultAgentClient("https://envault.tech", "envault_agt_test");
  await client.executeMutation({
    mutations: [{ key: "API_TOKEN", value: "token", action: "upsert" }],
  });

  const secretsCall = calls.find((call) => call.input.endsWith("/api/sdk/secrets"));
  assert.ok(secretsCall, "expected /api/sdk/secrets call");
  const body = JSON.parse(String(secretsCall?.init?.body));
  assert.equal(body.projectId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
});

test("throws when no file/env/projectId context exists", async () => {
  const dir = tempDir("envault-agent-missing-");
  process.chdir(dir);

  delete process.env.ENVAULT_PROJECT_ID;

  installFetchSpy(() => makePendingResponse());

  const client = new EnvaultAgentClient("https://envault.tech", "envault_agt_test");
  await assert.rejects(
    () =>
      client.executeMutation({
        mutations: [{ key: "X", value: "1", action: "upsert" }],
      }),
    /envault init/,
  );
});

test("returns structured pending approval payload for inline allow flow", async () => {
  const dir = tempDir("envault-agent-pending-");
  process.chdir(dir);
  writeFileSync(
    path.join(dir, "envault.json"),
    JSON.stringify({
      projectId: "9bdc9567-0fd7-472b-af5f-29fd9771227e",
      defaultEnvironment: "development",
    }),
  );

  const calls = installFetchSpy(() =>
    makePendingResponse({
      approval_id: "approval-xyz",
      approval_url: "https://envault.tech/approve/approval-xyz",
    }),
  );

  const client = new EnvaultAgentClient("https://envault.tech", "envault_agt_test");
  const result = (await client.executeMutation({
    mutations: [{ key: "K", value: "V", action: "upsert" }],
  })) as {
    status: string;
    approval_id: string;
    approval_url: string;
    approve_command: string;
  };

  assert.equal(result.status, "pending_approval");
  assert.equal(result.approval_id, "approval-xyz");
  assert.equal(result.approve_command, "envault approve approval-xyz");
  assert.equal(result.approval_url, "https://envault.tech/approve/approval-xyz");
  assert.ok(calls.some((call) => call.input.endsWith("/api/sdk/secrets")));
});
