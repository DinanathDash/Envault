import { execFileSync, execSync } from "child_process";
import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SDK_VERSION } from "./version";

type MutationOperation = {
  key: string;
  value?: string;
  action: "upsert" | "delete";
};

type MutationPayload = {
  mutations: MutationOperation[];
  environment?: string;
  environmentSlug?: string;
};

type ExecuteMutationOptions = {
  environment?: string;
  waitForApproval?: boolean;
};

type PendingApprovalResult = {
  status: "pending_approval";
  approval_id: string;
  approval_url: string;
  project_id: string;
  approve_command: string;
};

/**
 * Encapsulates the runtime SDK execution loop with Human-In-The-Loop intercepts.
 */
export class EnvaultAgentClient {
  private endpoint: string;
  private token: string;
  private projectIdHint?: string;
  private resolvedProjectId?: string;
  private compatibilityCheckPromise: Promise<void>;
  private originalSecrets: Record<string, string> = {};

  constructor(endpoint: string, token: string, projectId?: string) {
    this.endpoint = endpoint;
    this.token = token;
    this.projectIdHint = projectId;
    this.compatibilityCheckPromise = this.checkSdkCompatibility();
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private resolveProjectIdFromEnvaultJson(): string | null {
    const configPath = path.join(process.cwd(), "envault.json");
    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as {
        projectId?: unknown;
      };
      if (
        typeof parsed.projectId === "string" &&
        this.isUuid(parsed.projectId.trim())
      ) {
        return parsed.projectId.trim();
      }
    } catch {
      // Invalid local config should not crash SDK initialization.
    }

    return null;
  }

  private resolveProjectId(): string {
    if (this.resolvedProjectId) {
      return this.resolvedProjectId;
    }

    const fromHint = (this.projectIdHint || "").trim();
    if (this.isUuid(fromHint)) {
      this.resolvedProjectId = fromHint;
      return fromHint;
    }

    const fromConfigFile = this.resolveProjectIdFromEnvaultJson();
    if (fromConfigFile) {
      this.resolvedProjectId = fromConfigFile;
      return fromConfigFile;
    }

    const fromEnv = (process.env.ENVAULT_PROJECT_ID || "").trim();
    if (this.isUuid(fromEnv)) {
      this.resolvedProjectId = fromEnv;
      return fromEnv;
    }

    throw new Error(
      "Unable to resolve project context. Run `envault init` in this directory or set ENVAULT_PROJECT_ID.",
    );
  }

  private compareVersions(a: string, b: string): number {
    const parse = (value: string): number[] => {
      return value
        .trim()
        .replace(/^v/i, "")
        .split(".")
        .map((segment) => Number.parseInt(segment.replace(/[^0-9].*$/, ""), 10) || 0);
    };

    const left = parse(a);
    const right = parse(b);
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      const l = left[index] ?? 0;
      const r = right[index] ?? 0;
      if (l > r) return 1;
      if (l < r) return -1;
    }

    return 0;
  }

  private async checkSdkCompatibility(): Promise<void> {
    try {
      const response = await fetch(`${this.endpoint}/api/sdk-version`, {
        headers: {
          "X-SDK-Version": SDK_VERSION,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        latest_version?: unknown;
        min_supported_version?: unknown;
      };

      const latestVersion =
        typeof data.latest_version === "string" && data.latest_version.trim().length > 0
          ? data.latest_version.trim()
          : null;
      const minSupportedVersion =
        typeof data.min_supported_version === "string" &&
        data.min_supported_version.trim().length > 0
          ? data.min_supported_version.trim()
          : null;

      if (minSupportedVersion && this.compareVersions(SDK_VERSION, minSupportedVersion) < 0) {
        throw new Error(
          `Envault SDK ${SDK_VERSION} is below minimum supported version ${minSupportedVersion}. Please upgrade before continuing.`,
        );
      }

      if (latestVersion && this.compareVersions(SDK_VERSION, latestVersion) < 0) {
        console.warn(
          `[Envault SDK] A newer SDK version (${latestVersion}) is available. You are running ${SDK_VERSION}.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("minimum supported version")) {
        throw error;
      }
      // Best-effort network check should not block execution when endpoint is unavailable.
    }
  }

  private resolveAppBaseUrl(): string {
    const LOCAL_APP_URL = "https://envault.localhost:1355";
    const PROD_APP_URL = "https://envault.tech";

    const normalize = (value: string): string | null => {
      try {
        return new URL(value).origin.replace(/\/$/, "");
      } catch {
        return null;
      }
    };

    const configuredCandidates = [
      process.env.BASE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
    ];

    for (const configured of configuredCandidates) {
      if (!configured) continue;
      const origin = normalize(configured);
      if (!origin) continue;
      if (origin === LOCAL_APP_URL) return LOCAL_APP_URL;
      if (origin === PROD_APP_URL) return PROD_APP_URL;
    }

    try {
      const parsedEndpoint = new URL(this.endpoint);
      if (
        parsedEndpoint.hostname === "localhost" ||
        parsedEndpoint.hostname === "127.0.0.1" ||
        parsedEndpoint.hostname.endsWith(".localhost")
      ) {
        return LOCAL_APP_URL;
      }
      return PROD_APP_URL;
    } catch {
      return PROD_APP_URL;
    }
  }

  /**
   * Generates a repeatable Idempotency-Key
   */
  private generateIdempotencyKey(): string {
    return crypto.randomUUID();
  }

  /**
   * Exposes a native OS Notification for local setups.
   * Uses a layered fallback so IDE and system alerts still surface when one path fails.
   */
  private async triggerOsNotification(message: string, approvalUrl?: string) {
    const title = "Envault Agent Security";
    const notificationIcon = this.resolveNotificationIconPath();
    const allowOsaFallback = process.env.ENVAULT_ALLOW_OSASCRIPT_NOTIFIER === "true";

    const emitTerminalAttention = () => {
      // VS Code integrated terminal shows a bell/status icon for BEL events.
      process.stdout.write("\u0007");
    };

    const tryNodeNotifier = async (): Promise<boolean> => {
      try {
        const notifierModule = (await import("node-notifier")) as unknown as {
          default?: {
            notify: (
              options: {
                title: string;
                message: string;
                open?: string;
                sound?: boolean;
                wait?: boolean;
                timeout?: number;
                icon?: string;
              },
              callback?: (err: Error | null) => void,
            ) => void;
          };
          notify?: (
            options: {
              title: string;
              message: string;
              open?: string;
              sound?: boolean;
              wait?: boolean;
              timeout?: number;
              icon?: string;
            },
            callback?: (err: Error | null) => void,
          ) => void;
        };

        const notify = notifierModule.default?.notify || notifierModule.notify;
        if (!notify) {
          return false;
        }

        // Do not block on notifier callbacks; some backends never invoke them.
        notify({
          title,
          message,
          open: approvalUrl,
          sound: true,
          wait: false,
          timeout: 8,
          icon: notificationIcon || undefined,
        });

        return true;
      } catch {
        return false;
      }
    };

    try {
      // Always emit a local terminal cue first so there is a reliable ping even
      // when native notification permissions/tools are unavailable.
      emitTerminalAttention();

      if (await tryNodeNotifier()) {
        return;
      }

      if (process.platform === "darwin") {
          const terminalNotifierPath = this.resolveTerminalNotifierPath();
        try {
            if (terminalNotifierPath) {
              const args = ["-title", title, "-message", message, "-sound", "default"];
              if (approvalUrl) {
                args.push("-open", approvalUrl);
              }
              if (notificationIcon) {
                const iconUrl = pathToFileURL(notificationIcon).toString();
                  args.push("-appIcon", iconUrl);
              }
              execFileSync(terminalNotifierPath, args, { stdio: "ignore" });
              return;
            }
        } catch {
          // Keep fallback chain moving.
        }

          if (allowOsaFallback) {
            try {
              const appleScript = `display notification "${message.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" with title "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" sound name "default"`;
              execFileSync("osascript", ["-e", appleScript], { stdio: "ignore" });
              return;
            } catch {
              // Keep fallback chain moving.
            }
          }

          console.error(`[Envault Agent] Notification unavailable: ${message}`);
          console.error("[Envault Agent] Install terminal-notifier (brew install terminal-notifier) to enable native macOS notifications.");
          if (approvalUrl) {
            console.error(`[Envault Agent] Approval URL: ${approvalUrl}`);
          }
          return;
      } else if (process.platform === "linux") {
        const iconArg = notificationIcon
          ? ` --icon="${notificationIcon.replace(/"/g, "\\\"")}"`
          : "";
        execSync(
          `notify-send "Envault Agent Security" "${message.replace(/"/g, "'")}"${iconArg}`,
          {
            stdio: "ignore",
          },
        );
        return;
      }
    } catch {
      // Best-effort local notification, do not crash execution
    }
  }

  private resolveNotificationIconPath(): string | null {
    const candidate = path.join(process.cwd(), "public", "favicon.png");
    return existsSync(candidate) ? candidate : null;
  }

  private resolveTerminalNotifierPath(): string | null {
    const candidates = [
      "/opt/homebrew/bin/terminal-notifier",
      "/usr/local/bin/terminal-notifier",
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    try {
      const commandPath = execSync("command -v terminal-notifier", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return commandPath || null;
    } catch {
      return null;
    }
  }

  /**
   * Pre-execution routine: Ensure Zero-Trust LLM Context
   * Redacts actual secret values from strings intended for the Chat UI LLM.
   */
  public prepareLlmContext(
    fetchedEnv: Record<string, string>,
  ): Record<string, string> {
    this.originalSecrets = { ...fetchedEnv };
    const redacted: Record<string, string> = {};
    for (const [key] of Object.entries(fetchedEnv)) {
      redacted[key] = `[REDACTED_SECRET_${key}]`;
    }
    return redacted;
  }

  private restoreLlmContext(payload: unknown): unknown {
    const restore = (value: unknown): unknown => {
      if (typeof value === "string") {
        // Replace redacted tags even when embedded inside larger strings.
        return value.replace(/\[REDACTED_SECRET_([^\]]+)\]/g, (match, key) => {
          return Object.prototype.hasOwnProperty.call(this.originalSecrets, key)
            ? this.originalSecrets[key]
            : match;
        });
      }

      if (Array.isArray(value)) {
        return value.map((item) => restore(item));
      }

      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const restored: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          restored[k] = restore(v);
        }
        return restored;
      }

      return value;
    };

    return restore(payload);
  }

  /**
   * The core 202 Polling Loop for executing mutations.
   * Split-Routing ensures the Chat UI handles the "why" and terminal handles "how".
   */
  public async executeMutation(
    payload: MutationPayload,
    options?: ExecuteMutationOptions,
  ): Promise<unknown> {
    await this.compatibilityCheckPromise;

    const resolvedProjectId = this.resolveProjectId();
    const idempotencyKey = this.generateIdempotencyKey();
    const restoredPayload = this.restoreLlmContext(payload) as MutationPayload;

    const selectedEnvironment =
      (options?.environment || restoredPayload.environment || restoredPayload.environmentSlug || "")
        .toString()
        .trim();

    const payloadForApi: MutationPayload = {
      ...restoredPayload,
      ...(selectedEnvironment
        ? {
            environment: selectedEnvironment,
            environmentSlug: selectedEnvironment,
          }
        : {}),
    };

    // Initial Mutation Intercept
    const response = await fetch(`${this.endpoint}/api/sdk/secrets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-SDK-Version": SDK_VERSION,
      },
      body: JSON.stringify({
        projectId: resolvedProjectId,
        payload: payloadForApi,
        action: "update",
      }),
    });

    if (response.status === 429) {
      console.error("[Envault SDK] Rate limit hit. Terminal execution halted.");
      throw new Error("Too Many Requests");
    }

    if (!response.ok && response.status !== 202) {
      throw new Error(`API Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();

    if (response.status === 202 || data.status === "pending") {
      const approvalId =
        typeof data.approval_id === "string" ? data.approval_id : "";
      if (!approvalId) {
        throw new Error("Approval response missing approval_id");
      }
      const approvalUrl =
        typeof data.approval_url === "string" && data.approval_url.length > 0
          ? data.approval_url
          : `${this.resolveAppBaseUrl()}/approve/${approvalId}`;

      const pendingResult: PendingApprovalResult = {
        status: "pending_approval",
        approval_id: approvalId,
        approval_url: approvalUrl,
        project_id: resolvedProjectId,
        approve_command: `envault approve ${approvalId}`,
      };

      // Split-Routing Glass-Box Execution: Stream deterministic state to `stdout`
      process.stdout.write(
        `\n\x1b[33m[Envault SDK] Action paused. Human approval required.\x1b[0m`,
      );
      process.stdout.write(
        `\n\x1b[36mApprove inline with: ${pendingResult.approve_command}\x1b[0m\n`,
      );

      void this.triggerOsNotification(
        `Envault Agent requires approval for [${resolvedProjectId}].`,
        approvalUrl,
      );

      if (!options?.waitForApproval) {
        return pendingResult;
      }

      try {
        const approvedPayload = await this.pollForApproval(approvalId);
        return {
          status: "approved",
          approval_id: approvalId,
          payload: approvedPayload,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "HitlApprovalRejected") {
          throw new Error("Mutation rejected by project administrator.");
        }
        throw error;
      }
    }

    return data;
  }

  /**
   * 3-second polling loop handling the One-Time Read Burn mechanics
   */
  private async pollForApproval(approvalId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      process.stdout.write("Polling status");
      let finished = false;

      const finish = (fn: () => void) => {
        if (finished) return;
        finished = true;
        clearInterval(interval);
        clearTimeout(timeoutHandle);
        fn();
      };

      const interval = setInterval(async () => {
        try {
          process.stdout.write("."); // Terminal execution visual

          const res = await fetch(
            `${this.endpoint}/api/sdk/approvals/${approvalId}/status`,
            {
              headers: {
                Authorization: `Bearer ${this.token}`,
                "X-SDK-Version": SDK_VERSION,
              },
            },
          );

          // 410 Gone means the hitl-burn constraint worked or timed out
          if (res.status === 410) {
            return finish(() => {
              console.log(
                "\n\x1b[31m[Envault SDK] Resource Gone (Approval expired or already consumed by a replay attack).\x1b[0m",
              );
              reject(new Error("HitlApprovalGone"));
            });
          }

          if (res.status === 403) {
            try {
              await res.json();
            } catch {
              // Ignore JSON parsing failures and fall back to generic 403 rejection.
            }
            return finish(() => {
              console.log(
                "\n\x1b[31m[Envault SDK] Action Rejected by Human.\x1b[0m",
              );
              reject(new Error("HitlApprovalRejected"));
            });
          }

          if (res.status === 200) {
            const result = await res.json();
            if (result?.status === "rejected") {
              return finish(() => {
                console.log(
                  "\n\x1b[31m[Envault SDK] Action Rejected by Human.\x1b[0m",
                );
                reject(new Error("HitlApprovalRejected"));
              });
            }
            return finish(() => {
              console.log(
                "\n\x1b[32m[Envault SDK] Approved. Resuming execution.\x1b[0m\n",
              );
              resolve(result.payload);
            });
          }
        } catch {
          process.stdout.write("x"); // Local network failure indicator
        }
      }, 3000); // 3-second cycle

      // Safety timeout matching the 15m TTL constraint
      const timeoutHandle = setTimeout(() => {
        finish(() => {
          console.log("\n\x1b[31m[Envault SDK] Polling timeout (15m).\x1b[0m");
          reject(new Error("HitlApprovalTimeout"));
        });
      }, 15 * 60 * 1000);
    });
  }
}
