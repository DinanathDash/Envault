import * as dotenv from "dotenv";
import { sendBrevoEmail } from "../src/lib/infra/email";
import { getEmailHtml } from "../src/lib/infra/email-html";

// load env
dotenv.config({ path: ".env.local" });

const recipientEmail = process.argv[2];
if (!recipientEmail) {
  console.error("Usage: npx tsx scripts/send-feedback.ts <recipient-email>");
  process.exit(1);
}

const SENDER_DOMAIN = process.env.EMAIL_DOMAIN || "mail.envault.tech";
const SENDERS = {
  default: `Envault <team@${SENDER_DOMAIN}>`,
};

async function main() {
  if (!process.env.BREVO_API_KEY) {
    console.error("BREVO_API_KEY is not set");
    process.exit(1);
  }
  const html = getEmailHtml({
    previewText: "We'd love to hear what you think about Envault",
    heading: "Help us improve Envault",
    content: `
      <p>Hi there,</p>

      <p>I'm reaching out from the Envault team because we really value
      the opinions of our users. If you have a few minutes, we'd love to
      hear your thoughts on your experience so far-what's working well,
      what could be better, or any feature you'd like to see.</p>

      <p>Your feedback goes straight to the people building Envault, and
      it helps us make the product more useful and enjoyable for
      everyone.</p>

      <p>You can reply directly to this email with anything you'd like
      to share.</p>

      <p>Thanks in advance for your time,</p>

      <p><strong>The Envault Team</strong></p>

      <p style="font-size:0.9em;color:#666;">
        Envault • <a href="https://envault.tech">envault.tech</a>
      </p>
    `,
    logoUrl: "https://www.envault.tech/favicon.png",
  });

  console.log(`Sending feedback request to ${recipientEmail}...`);

  const result = await sendBrevoEmail({
    from: SENDERS.default,
    to: recipientEmail,
    replyTo: "connect@envault.tech",
    subject: "We'd love your feedback",
    html,
  });
  console.log("send result", result);
}

main().catch(console.error);
