import { EnvaultAgentClient } from "../src/lib/sdk/agent-interceptor";

async function main() {
  const baseUrl = process.env.ENVAULT_BASE_URL || "https://envault.localhost:1355";
  const projectId = process.env.ENVAULT_TEST_PROJECT_ID || "notification-test-project";
  const approvalUrl = process.env.ENVAULT_TEST_APPROVAL_URL || `${baseUrl}/dashboard`;

  // Token value is irrelevant for this local notification smoke test.
  const client = new EnvaultAgentClient(baseUrl, "envault_agt_test_token", projectId);

  const notifier = client as unknown as {
    triggerOsNotification: (message: string, url?: string) => Promise<void>;
  };

  const message = `Envault Agent test ping at ${new Date().toISOString()}`;
  console.log("[Notification Test] Triggering ping...");
  await notifier.triggerOsNotification(message, approvalUrl);
  console.log("[Notification Test] Ping dispatch attempted. Check OS notification center and terminal bell indicator.");
}

main().catch((error) => {
  console.error("[Notification Test] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
