import * as dotenv from "dotenv";
import { resolve } from "path";

// Extract env from Next.js local files
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const testAll = args.includes("--all");
const recipientEmail = args.find((arg) => !arg.startsWith("--")) || "dashdinanath056@gmail.com";

console.log(`Sending test email(s) to ${recipientEmail}...`);
if (testAll) {
  console.log("Mode: Testing ALL configured sender domains");
} else {
  console.log("Mode: Testing single default sender (use --all to test all senders)");
}

async function main() {
  if (!process.env.BREVO_API_KEY) {
    console.error("Error: BREVO_API_KEY is not set in environment variables.");
    process.exit(1);
  }

  // Import dynamically so it evaluates after dotenv.config()
  const { sendBrevoEmail, SENDERS } = await import("../src/lib/infra/email");
  const { getEmailHtml } = await import("../src/lib/infra/email-html");

  const html = getEmailHtml({
    heading: "Template Check",
    content: "<p>Verifying template generation and email delivery capability...</p>",
  });

  let allSuccess = true;

  const sendersToTest = testAll 
    ? Object.entries(SENDERS) 
    : [["default", SENDERS.default]];

  for (const [key, sender] of sendersToTest) {
    console.log(`\nTesting sender [${key}]: ${sender}`);
    const result = await sendBrevoEmail({
      from: sender as string,
      to: recipientEmail,
      subject: `Envault Sender Test - [${key}]`,
      html,
    });

    if (result.error) {
      console.error(`❌ Failed to send from [${key}]`);
      console.error(result.error);
      allSuccess = false;
    } else {
      console.log(`✅ Success for [${key}]!`);
      console.log("   Message ID:", result.data?.messageId);
    }
  }

  if (allSuccess) {
    console.log("\n🎉 Tested successfully!");
  } else {
    console.log("\n⚠️ Some sender domains failed. Check the logs above.");
    process.exit(1);
  }
}

main().catch(console.error);
