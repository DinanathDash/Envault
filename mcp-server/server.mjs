#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = "@dinanathdash/envault-mcp-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseSemver(input) {
  return String(input || "")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((segment) => Number.parseInt(segment.replace(/[^0-9].*$/, ""), 10) || 0);
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
}

async function getCurrentPackageVersion() {
  const packageJsonPath = path.join(__dirname, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf-8");
    const parsed = safeJsonParse(raw, {});
    if (typeof parsed.version === "string" && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // Fall through to unknown version.
  }

  return "0.0.0";
}

async function getLatestPublishedVersion() {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`,
    );
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    if (typeof payload?.version === "string" && payload.version.trim()) {
      return payload.version.trim();
    }
  } catch {
    // Network failures should not break MCP server startup.
  }

  return null;
}

function printCliUsage() {
  process.stdout.write(
    [
      "Envault MCP Server",
      "",
      "Usage:",
      "  envault-mcp-server                Start stdio MCP server",
      "  envault-mcp-server --version      Print installed MCP server version",
      "  envault-mcp-server --check-update Compare installed version vs npm latest",
      "",
    ].join("\n"),
  );
}

async function handleMetadataCommand() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printCliUsage();
    return true;
  }

  if (args.includes("--version") || args.includes("-v")) {
    const currentVersion = await getCurrentPackageVersion();
    process.stdout.write(`${PACKAGE_NAME} v${currentVersion}\n`);
    return true;
  }

  if (args.includes("--check-update")) {
    const currentVersion = await getCurrentPackageVersion();
    const latestVersion = await getLatestPublishedVersion();

    if (!latestVersion) {
      process.stdout.write(
        `${PACKAGE_NAME} v${currentVersion} (latest npm version unavailable)\n`,
      );
      return true;
    }

    const cmp = compareSemver(currentVersion, latestVersion);
    if (cmp < 0) {
      process.stdout.write(
        `${PACKAGE_NAME} v${currentVersion} -> update available: v${latestVersion}\n`,
      );
    } else if (cmp === 0) {
      process.stdout.write(
        `${PACKAGE_NAME} v${currentVersion} is up to date.\n`,
      );
    } else {
      process.stdout.write(
        `${PACKAGE_NAME} v${currentVersion} is newer than npm latest v${latestVersion}.\n`,
      );
    }

    return true;
  }

  return false;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readEnvaultConfig(cwd) {
  const configPath = path.join(cwd, "envault.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return safeJsonParse(raw, {});
  } catch {
    return {};
  }
}

function resolveLocalEnvFile(config, environment, explicitFile) {
  if (typeof explicitFile === "string" && explicitFile.trim()) {
    return explicitFile.trim();
  }

  const env =
    (typeof environment === "string" && environment.trim()) ||
    config.defaultEnvironment ||
    "development";

  if (config.environmentFiles && typeof config.environmentFiles === "object") {
    const mapped = config.environmentFiles[env];
    if (typeof mapped === "string" && mapped.trim()) {
      return mapped.trim();
    }
  }

  if (env === "development") {
    return ".env";
  }

  return `.env.${env}`;
}

function upsertEnvLine(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedKey}=.*$`, "m");
  const nextLine = `${key}=${value}`;

  if (regex.test(content)) {
    return content.replace(regex, nextLine);
  }

  const suffix = content.endsWith("\n") || content.length === 0 ? "" : "\n";
  return `${content}${suffix}${nextLine}\n`;
}

function removeEnvLine(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedKey}=.*(?:\\r?\\n)?`, "gm");
  return content.replace(regex, "");
}

async function runEnvault(args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync("envault", args, {
      cwd,
      env: process.env,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    return {
      ok: true,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      command: `envault ${args.join(" ")}`,
    };
  } catch (error) {
    return {
      ok: false,
      command: `envault ${args.join(" ")}`,
      message: error?.message || "Unknown error",
      stdout: error?.stdout?.trim?.() || "",
      stderr: error?.stderr?.trim?.() || "",
    };
  }
}

function toToolResponse(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

const server = new Server(
  {
    name: "envault-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "envault_status",
      description: "Show Envault CLI auth/project/environment status.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID override for status call.",
          },
        },
      },
    },
    {
      name: "envault_pull",
      description: "Pull remote secrets into the local env file for an environment.",
      inputSchema: {
        type: "object",
        properties: {
          environment: { type: "string" },
          file: { type: "string" },
          force: { type: "boolean", default: true },
        },
      },
    },
    {
      name: "envault_push",
      description: "Deploy local env file values to Envault for an environment.",
      inputSchema: {
        type: "object",
        properties: {
          environment: { type: "string" },
          file: { type: "string" },
          force: { type: "boolean", default: true },
          dryRun: { type: "boolean", default: false },
        },
      },
    },
    {
      name: "envault_approve",
      description: "Approve a pending Envault HITL approval by ID.",
      inputSchema: {
        type: "object",
        properties: {
          approvalId: { type: "string" },
        },
        required: ["approvalId"],
      },
    },
    {
      name: "envault_set_local_key",
      description:
        "Set or update a key=value pair in the local env file resolved from envault.json/environment mapping. Optionally push immediately.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          environment: { type: "string" },
          file: { type: "string" },
          autoPush: { type: "boolean", default: false },
        },
        required: ["key", "value"],
      },
    },
    {
      name: "envault_remove_local_key",
      description:
        "Remove a key from the local env file resolved from envault.json/environment mapping. Optionally push immediately.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          environment: { type: "string" },
          file: { type: "string" },
          autoPush: { type: "boolean", default: false },
        },
        required: ["key"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const cwd = process.cwd();

  if (name === "envault_status") {
    const cliArgs = ["status"];
    if (typeof args.projectId === "string" && args.projectId.trim()) {
      cliArgs.push("--project", args.projectId.trim());
    }
    const result = await runEnvault(cliArgs, cwd);
    return toToolResponse(result, !result.ok);
  }

  if (name === "envault_pull") {
    const cliArgs = ["pull"];
    if (args.force !== false) cliArgs.push("--force");
    if (typeof args.environment === "string" && args.environment.trim()) {
      cliArgs.push("--env", args.environment.trim());
    }
    if (typeof args.file === "string" && args.file.trim()) {
      cliArgs.push("--file", args.file.trim());
    }
    const result = await runEnvault(cliArgs, cwd);
    return toToolResponse(result, !result.ok);
  }

  if (name === "envault_push") {
    const cliArgs = ["push"];
    if (args.force !== false) cliArgs.push("--force");
    if (args.dryRun === true) cliArgs.push("--dry-run");
    if (typeof args.environment === "string" && args.environment.trim()) {
      cliArgs.push("--env", args.environment.trim());
    }
    if (typeof args.file === "string" && args.file.trim()) {
      cliArgs.push("--file", args.file.trim());
    }
    const result = await runEnvault(cliArgs, cwd);
    return toToolResponse(result, !result.ok);
  }

  if (name === "envault_approve") {
    const approvalId = typeof args.approvalId === "string" ? args.approvalId.trim() : "";
    if (!approvalId) {
      return toToolResponse({ error: "approvalId is required" }, true);
    }
    const result = await runEnvault(["approve", approvalId], cwd);
    return toToolResponse(result, !result.ok);
  }

  if (name === "envault_set_local_key") {
    const key = typeof args.key === "string" ? args.key.trim() : "";
    const value = typeof args.value === "string" ? args.value : "";
    if (!key) {
      return toToolResponse({ error: "key is required" }, true);
    }

    const config = await readEnvaultConfig(cwd);
    const targetFile = resolveLocalEnvFile(config, args.environment, args.file);
    const absoluteTarget = path.join(cwd, targetFile);

    let before = "";
    try {
      before = await fs.readFile(absoluteTarget, "utf-8");
    } catch {
      before = "";
    }

    const after = upsertEnvLine(before, key, value);
    await fs.writeFile(absoluteTarget, after, "utf-8");

    const response = {
      updated: true,
      file: targetFile,
      key,
      value,
      autoPushed: false,
    };

    if (args.autoPush === true) {
      const pushArgs = ["push", "--force"];
      if (typeof args.environment === "string" && args.environment.trim()) {
        pushArgs.push("--env", args.environment.trim());
      }
      pushArgs.push("--file", targetFile);
      const pushResult = await runEnvault(pushArgs, cwd);
      response.autoPushed = pushResult.ok;
      return toToolResponse({ ...response, pushResult }, !pushResult.ok);
    }

    return toToolResponse(response);
  }

  if (name === "envault_remove_local_key") {
    const key = typeof args.key === "string" ? args.key.trim() : "";
    if (!key) {
      return toToolResponse({ error: "key is required" }, true);
    }

    const config = await readEnvaultConfig(cwd);
    const targetFile = resolveLocalEnvFile(config, args.environment, args.file);
    const absoluteTarget = path.join(cwd, targetFile);

    let before = "";
    try {
      before = await fs.readFile(absoluteTarget, "utf-8");
    } catch {
      before = "";
    }

    const after = removeEnvLine(before, key);
    await fs.writeFile(absoluteTarget, after, "utf-8");

    const response = {
      removed: true,
      file: targetFile,
      key,
      autoPushed: false,
    };

    if (args.autoPush === true) {
      const pushArgs = ["push", "--force"];
      if (typeof args.environment === "string" && args.environment.trim()) {
        pushArgs.push("--env", args.environment.trim());
      }
      pushArgs.push("--file", targetFile);
      const pushResult = await runEnvault(pushArgs, cwd);
      response.autoPushed = pushResult.ok;
      return toToolResponse({ ...response, pushResult }, !pushResult.ok);
    }

    return toToolResponse(response);
  }

  return toToolResponse({ error: `Unknown tool: ${name}` }, true);
});

async function main() {
  if (await handleMetadataCommand()) {
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[envault-mcp-server] Fatal: ${message}\n`);
  process.exit(1);
});
