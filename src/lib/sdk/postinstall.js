import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const prompt =
  "Envault can use native OS notifications (macOS, Windows, Linux) to alert you when an AI agent requires human approval for a secure mutation. Would you like to install the optional native notification helpers? (y/N) ";

function isCiEnvironment() {
  return Boolean(process.env.CI && process.env.CI.trim().length > 0);
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function main() {
  if (isCiEnvironment()) {
    return;
  }

  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return;
  }

  const rl = readline.createInterface({ input, output });

  try {
    const answer = (await rl.question(prompt)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      return;
    }
  } finally {
    rl.close();
  }

  const result = spawnSync(npmCommand(), ["install", "--no-save", "node-notifier@^10.0.1"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.warn("[Envault SDK] Optional notifier helper install failed. Continue without native helper support.");
  }
}

void main();
