import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "node:child_process";
import { EnvaultAgentClient } from "../src/lib/sdk/agent-interceptor";

// Explicitly load .env.local for Next.js consistency
dotenv.config({ path: ['.env.local', '.env'] });

function getCliAuthToken(): string {
  const configPath = path.join(os.homedir(), ".envault", "config.toml");
  if (!fs.existsSync(configPath)) {
    throw new Error(`CLI config not found at ${configPath}. Run 'envault login' first.`);
  }

  const configContent = fs.readFileSync(configPath, "utf-8");
  const match = configContent.match(/token\s*=\s*["']([^"']+)["']/);
  
  if (!match || !match[1]) {
    throw new Error("Could not find 'token' key in ~/.envault/config.toml");
  }
  return match[1];
}

type DelegateResponse = {
  token: string;
};

type DelegateError = {
  error?: string;
};

async function mintDelegatedToken(
  baseUrl: string,
  agentId: string,
  projectId: string,
  authToken: string,
): Promise<DelegateResponse> {
  const delegateRes = await fetch(`${baseUrl}/api/sdk/auth/delegate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ agentId, projectId }),
  });

  if (!delegateRes.ok) {
    const text = await delegateRes.text();
    let parsed: DelegateError | null = null;
    try {
      parsed = JSON.parse(text) as DelegateError;
    } catch {
      parsed = null;
    }

    if (delegateRes.status === 401 && parsed?.error === "token_expired") {
      throw new Error("token_expired");
    }

    throw new Error(
      `[E2E] Failed to mint delegate token: ${delegateRes.status} ${text}`,
    );
  }

  const delegateJson = (await delegateRes.json()) as DelegateResponse;
  if (!delegateJson.token?.startsWith("envault_agt_")) {
    throw new Error("[E2E] Delegate endpoint did not return envault_agt_ token");
  }

  return delegateJson;
}

async function main() {
  const baseUrl = process.env.ENVAULT_BASE_URL || "http://localhost:3000";
  const agentId = process.env.ENVAULT_TEST_AGENT_ID || "envault-agent";
  const projectId = process.env.ENVAULT_TEST_PROJECT_ID;
  const testEnvironment = (process.env.ENVAULT_TEST_ENVIRONMENT || "").trim();

  if (!projectId) {
    throw new Error("Missing ENVAULT_TEST_PROJECT_ID in .env.local");
  }

  console.log("[E2E] Reading local CLI session...");
  let authToken = getCliAuthToken();

  console.log(`[E2E] Target Project ID: ${projectId}`);
  console.log("[E2E] Agent Identity: Envault Agent");
  if (testEnvironment) {
    console.log(`[E2E] Target Environment: ${testEnvironment}`);
  } else {
    console.log("[E2E] Target Environment: project default");
  }
  console.log("[E2E] Step 1/2: Minting delegated agent token using CLI PAT...");
  
  let delegateJson: DelegateResponse;
  try {
    delegateJson = await mintDelegatedToken(baseUrl, agentId, projectId, authToken);
  } catch (error) {
    if (error instanceof Error && error.message === "token_expired") {
      console.log("[E2E] CLI access token expired. Attempting refresh via `envault status`...");

      try {
        execSync(`envault status --project ${projectId}`, { stdio: "ignore" });
      } catch {
        throw new Error(
          "[E2E] CLI access token expired and automatic refresh failed. Run `envault login` (or `envault status`) and retry.",
        );
      }

      authToken = getCliAuthToken();
      delegateJson = await mintDelegatedToken(baseUrl, agentId, projectId, authToken);
    } else {
      throw error;
    }
  }

  console.log("[E2E] Delegate token minted successfully.");

  const client = new EnvaultAgentClient(baseUrl, delegateJson.token, projectId);

  const payload = {
    mutations: [
      {
        key: "E2E_TEST_KEY",
        value: "secure_123",
        action: "upsert" as const,
      },
    ],
    ...(testEnvironment
      ? {
          environment: testEnvironment,
          environmentSlug: testEnvironment,
        }
      : {}),
  };

  console.log("[E2E] Step 2/2: Triggering executeMutation (expect 202 + polling)...");
  console.log("[E2E] The SDK should now pause and print polling dots.");

  const result = await client.executeMutation(payload);
  console.log("[E2E] executeMutation completed:", result);
}

main().catch((error) => {
  console.error("[E2E] Test failed:", error.message);
  process.exit(1);
});