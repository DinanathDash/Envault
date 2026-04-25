import { getEmailHtml } from "./email-html";
import { Notification } from "../types/notifications";
import { formatEnvironmentLabel } from "../utils/environment-label";

// Helper to extract name and email from "Name <email@domain.com>" or just "email@domain.com"
function parseSenderString(sender: string) {
  const match = sender.match(/(.*?)<(.*?)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: sender.trim() };
}

interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendBrevoEmail(options: SendEmailOptions) {
  const { from, to, subject, html, replyTo } = options;
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("Skipping email in DEV (No BREVO_API_KEY).");
      return { data: null, error: null };
    }
    return { data: null, error: new Error("Missing BREVO_API_KEY") };
  }

  const senderObj = parseSenderString(from);

  const toArray = Array.isArray(to) ? to : [to];
  const toObjects = toArray.map(t => parseSenderString(t));

  const payload: Record<string, unknown> = {
    sender: senderObj,
    to: toObjects,
    subject,
    htmlContent: html,
  };

  if (replyTo) {
    payload.replyTo = parseSenderString(replyTo);
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: new Error(`Brevo API error: ${response.status} ${errorText}`) };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Helper to determine sender email
const SENDER_DOMAIN = process.env.EMAIL_DOMAIN || "mail.envault.tech";
// Each category uses a distinct sub-address so users can filter their inbox.
// All sub-addresses are on the same verified domain so deliverability is fine.
export const SENDERS = {
  default: `Envault <team@${SENDER_DOMAIN}>`,
  notifications: `Envault <notifications@${SENDER_DOMAIN}>`,
  invites: `Envault Access <access@${SENDER_DOMAIN}>`,
  security: `Envault Security <security@${SENDER_DOMAIN}>`,
  activity: `Envault Activity <activity@${SENDER_DOMAIN}>`,
  cli: `Envault CLI <cli@${SENDER_DOMAIN}>`,
  system: `Envault System <system@${SENDER_DOMAIN}>`,
  digest: `Envault Digest <digest@${SENDER_DOMAIN}>`,
};
const APP_URL = (
  process.env.EMAIL_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.envault.tech"
).replace(/\/+$/, "");
const LOGO_URL = `${APP_URL}/email-logo-light.png`;

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatDateInTimezone(isoDate: string, timezone: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/**
 * Send a test email to verify Resend configuration
 */
export async function sendTestEmail(to: string) {
  try {
    const html = getEmailHtml({
      heading: "Test Email",
      content: `
        <p>This is a test email to verify your Resend configuration is working correctly.</p>
        <p>If you're seeing this, your email setup is working! 🎉</p>
      `,
      logoUrl: LOGO_URL,
    });

    const result = await sendBrevoEmail({
      from: SENDERS.default,
      to,
      subject: "Envault - Test Email",
      html,
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to send test email:", error);
    return { success: false, error };
  }
}

export async function sendAccountScheduledDeletionEmail(
  to: string,
  scheduledAtIso: string,
  deletionDueAtIso: string,
  timezone?: string | null,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(
      "Skipping account deletion schedule email in DEV (No API Key).",
    );
    return;
  }

  const displayTimezone =
    timezone && isValidTimezone(timezone) ? timezone : "UTC";
  const scheduledAtText = formatDateInTimezone(scheduledAtIso, displayTimezone);
  const deletionDueText = formatDateInTimezone(
    deletionDueAtIso,
    displayTimezone,
  );
  const fallbackCopy =
    displayTimezone === "UTC"
      ? "<p>We couldn't determine your local timezone, so times are shown in UTC.</p>"
      : "";

  try {
    const html = getEmailHtml({
      heading: "Account Deletion Scheduled",
      content: `
        <p>We received your request to delete your Envault account.</p>
        <p><strong>Requested (${displayTimezone}):</strong> ${scheduledAtText}</p>
        <p><strong>Permanently deleted after (${displayTimezone}):</strong> ${deletionDueText}</p>
        ${fallbackCopy}
        <p>If you change your mind, sign in before the deadline to cancel deletion.</p>
      `,
      action: {
        text: "Sign In to Cancel Deletion",
        url: `${APP_URL}/login`,
      },
      footerText:
        "If this wasn't you, sign in immediately and secure your account.",
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.security,
      to,
      subject: "Your Envault account is scheduled for deletion",
      html,
    });

    if (error) {
      console.error(
        "Resend API failed to send scheduled deletion email:",
        error,
      );
    }
  } catch (error) {
    console.error("Failed to send scheduled deletion email:", error);
  }
}

// ============================================
// PROJECT SHARING EMAILS
// ============================================

/**
 * Send access request notification to project owner
 * Sent when someone requests access to a project
 */
export async function sendAccessRequestEmail(
  to: string, // Owner's email
  requesterEmail: string, // Who requested access
  projectName: string,
  requestId: string,
  requestedEnvironment?: string,
  ownerId?: string, // Added to check preferences
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping Access Request email in DEV (No API Key).");
    return;
  }

  // Check notification preferences if we have an ownerId
  if (ownerId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_requests")
      .eq("user_id", ownerId)
      .single();

    if (prefs && prefs.email_access_requests === false) {
      console.log(`Skipping Access Request email for ${to} (User opted out)`);
      return;
    }
  }

  try {
    const requestedEnvironmentLabel = requestedEnvironment
      ? formatEnvironmentLabel(requestedEnvironment)
      : "";
    const envLine = requestedEnvironment
      ? `<p><strong>Requested environment:</strong> ${requestedEnvironmentLabel}</p>`
      : "";

    const html = getEmailHtml({
      heading: "New Access Request",
      content: `
        <p><strong>${requesterEmail}</strong> has requested access to your project <strong>${projectName}</strong>.</p>
        ${envLine}
        <p>Review and approve or reject this request from your dashboard.</p>
      `,
      action: {
        text: "Review Request",
        url: `${APP_URL}/approve/${requestId}`,
      },
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      replyTo: requesterEmail,
      subject: `Access Request: ${projectName}`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send access request email:", error);
    }
  } catch (error) {
    console.error("Failed to send access request email:", error);
  }
}

/**
 * Send new device access email
 * Sent when a user approves CLI access from a new device
 */
export async function sendNewDeviceEmail(
  to: string,
  deviceName: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping New Device email in DEV (No API Key).");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_device_activity")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_device_activity === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "CLI Access Confirmed",
      content: `
        <p>The Envault CLI on <strong>${deviceName}</strong> was successfully authenticated to your account.</p>
        <p>You can manage active CLI sessions anytime from your account settings.</p>
      `,
      action: {
        text: "Manage Sessions",
        url: `${APP_URL}/settings`,
      },
      footerText:
        "You are receiving this because new device notifications are enabled in your account.",
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      subject: "New Device Access - Envault",
      html,
    });
    if (error) {
      console.error("Resend API failed to send new device email:", error);
    }
  } catch (error) {
    console.error("Failed to send new device email:", error);
  }
}

/**
 * Send project invitation email
 */
export async function sendInviteEmail(
  to: string,
  projectName: string,
  token: string,
  senderEmail?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.warn(
      "Skipping email in DEV (No API Key). Invite Link:",
      `${APP_URL}/join/${token}`,
    );
    return;
  }

  // Check notification preferences if the email belongs to an existing user
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Try to find the user by email to check their preferences
  const { data: usersData } = await admin.auth.admin.listUsers();
  const existingUser = usersData.users.find((u) => u.email === to);

  if (existingUser) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_requests")
      .eq("user_id", existingUser.id)
      .single();

    if (prefs && prefs.email_access_requests === false) {
      console.log(`Skipping Invite email for ${to} (User opted out)`);
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: `Join ${projectName}`,
      content: `
        <p>You have been invited to collaborate on the project <strong>${projectName}</strong>.</p>
        <p>Click the button below to accept the invitation and request access.</p>
      `,
      action: {
        text: "Accept Invitation",
        url: `${APP_URL}/join/${token}`,
      },
      footerText:
        "If you didn't expect this invitation, you can ignore this email.",
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.invites,
      to,
      replyTo: senderEmail || to,
      subject: `You've been invited to join ${projectName} on Envault`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send invite email:", error);
    }
  } catch (error) {
    console.error("Failed to send invite email:", error);
  }
}

/**
 * Send access granted notification
 */
export async function sendAccessGrantedEmail(
  to: string,
  projectName: string,
  role?: "viewer" | "editor" | "owner",
  allowedEnvironments?: string[] | null,
  userId?: string, // Added to check preferences
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping Access Granted email in DEV (No API Key).");
    return;
  }

  // Check notification preferences if we have a userId
  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      console.log(`Skipping Access Granted email for ${to} (User opted out)`);
      return;
    }
  }

  try {
    const formattedAllowedEnvironments =
      allowedEnvironments?.map((env) => formatEnvironmentLabel(env)) || [];
    const roleText = role ? ` with <strong>${role}</strong> permissions` : "";
    const envText =
      allowedEnvironments === undefined || allowedEnvironments === null
        ? "all environments"
        : formattedAllowedEnvironments.length > 0
          ? formattedAllowedEnvironments.join(", ")
          : "none";

    const html = getEmailHtml({
      heading: "Access Granted",
      content: `<p>Your request to access <strong>${projectName}</strong> has been approved${roleText}.</p><p><strong>Environment access:</strong> ${envText}</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      subject: `Access Granted: ${projectName}`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send access granted email:", error);
    }
  } catch (error) {
    console.error("Failed to send access granted email:", error);
  }
}

export async function sendAccessDeniedEmail(
  to: string,
  projectName: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping Access Denied email in DEV (No API Key).");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "Access Request Denied",
      content: `<p>Your request to access <strong>${projectName}</strong> was denied.</p><p>If you think this is a mistake, contact the project owner.</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      subject: `Access Request Denied: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send access denied email:", error);
  }
}

export async function sendAccessUpdatedEmail(
  to: string,
  projectName: string,
  oldRole: string,
  newRole: string,
  changedBy: string,
  newAllowedEnvironments?: string[] | null,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping Access Updated email in DEV (No API Key).");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      return;
    }
  }

  const roleText =
    oldRole === newRole
      ? `<p>Your role remains <strong>${newRole}</strong>.</p>`
      : `<p>Your role changed from <strong>${oldRole}</strong> to <strong>${newRole}</strong>.</p>`;

  const formattedAllowedEnvironments =
    newAllowedEnvironments?.map((env) => formatEnvironmentLabel(env)) || [];
  const envText =
    newAllowedEnvironments === undefined || newAllowedEnvironments === null
      ? "all environments"
      : formattedAllowedEnvironments.length > 0
        ? formattedAllowedEnvironments.join(", ")
        : "none";

  try {
    const html = getEmailHtml({
      heading: "Access Updated",
      content: `<p><strong>${changedBy}</strong> updated your access in <strong>${projectName}</strong>.</p>${roleText}<p><strong>Environment access:</strong> ${envText}</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      subject: `Access Updated: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send access updated email:", error);
  }
}

export async function sendAccessRevokedEmail(
  to: string,
  projectName: string,
  removedBy: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping Access Revoked email in DEV (No API Key).");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "Project Access Revoked",
      content: `<p><strong>${removedBy}</strong> removed your access to <strong>${projectName}</strong>.</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.notifications,
      to,
      subject: `Access Revoked: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send access revoked email:", error);
  }
}

/**
 * Send email digest
 */
export async function sendDigestEmail(
  to: string,
  notifications: Notification[],
  frequency: "daily" | "weekly",
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(
      `Skipping Digest email in DEV (No API Key). To: ${to}, Count: ${notifications.length}`,
    );
    return;
  }

  if (notifications.length === 0) return;

  const period = frequency === "daily" ? "Daily" : "Weekly";

  // Group notifications by type or just list them
  // For simplicity, let's list the top 10 most recent
  const recent = notifications.slice(0, 10);
  const remaining = notifications.length - recent.length;

  const listItems = recent
    .map((n) => {
      const time = new Date(n.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e4e4e7;">
        <div style="font-weight: 500; font-size: 14px; color: #18181b;">${n.title}</div>
        <div style="font-size: 13px; color: #52525b;">${n.message}</div>
        <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">${time}</div>
      </div>
    `;
    })
    .join("");

  const moreText =
    remaining > 0
      ? `<div style="font-size: 13px; color: #52525b; text-align: center; margin-top: 16px;">And ${remaining} more notifications...</div>`
      : "";

  try {
    const html = getEmailHtml({
      heading: `${period} Activity Digest`,
      content: `
        <p>Here is a summary of activity in your Envault projects for the last ${
          frequency === "daily" ? "24 hours" : "7 days"
        }.</p>
        <div style="margin-top: 24px; text-align: left;">
          ${listItems}
          ${moreText}
        </div>
      `,
      action: {
        text: "View All Activity",
        url: `${APP_URL}/notifications`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.digest,
      to,
      subject: `Envault - ${period} Digest`,
      html,
    });
  } catch (error) {
    console.error("Failed to send digest email:", error);
  }
}

// ============================================
// SECURITY ALERT EMAILS
// ============================================

/**
 * Send a security alert email (password change, 2FA, unknown login, encryption failure)
 * From: security@envault.tech
 */
export async function sendSecurityAlertEmail(
  to: string,
  title: string,
  message: string,
  userId?: string,
  actionUrl?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(`Skipping Security Alert email in DEV: ${title}`);
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_security_alerts")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_security_alerts === false) {
      console.log(`Skipping Security Alert email for ${to} (User opted out)`);
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: title,
      content: `<p>${message}</p><p>If this wasn't you, please secure your account immediately.</p>`,
      action: actionUrl
        ? { text: "Review Security Settings", url: `${APP_URL}${actionUrl}` }
        : { text: "Go to Settings", url: `${APP_URL}/settings` },
      footerText:
        "If you recognise this activity, you can safely ignore this email.",
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.security,
      to,
      subject: `Security Alert: ${title} - Envault`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send security alert email:", error);
    }
  } catch (error) {
    console.error("Failed to send security alert email:", error);
  }
}

// ============================================
// PROJECT & SECRET ACTIVITY EMAILS
// ============================================

/**
 * Send a project activity email (secret/project changes, member events)
 * From: activity@envault.tech
 */
export async function sendProjectActivityEmail(
  to: string,
  projectName: string,
  title: string,
  message: string,
  projectId: string,
  userId?: string,
  projectSlug?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(`Skipping Project Activity email in DEV: ${title}`);
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_project_activity")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_project_activity === false) {
      console.log(`Skipping Project Activity email for ${to} (User opted out)`);
      return;
    }
  }

  const projectUrl = projectSlug
    ? `/project/${projectSlug}`
    : `/project/${projectId}`;

  try {
    const html = getEmailHtml({
      heading: title,
      content: `<p>${message}</p>`,
      action: {
        text: `View ${projectName}`,
        url: `${APP_URL}${projectUrl}`,
      },
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.activity,
      to,
      subject: `${title} - ${projectName} on Envault`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send project activity email:", error);
    }
  } catch (error) {
    console.error("Failed to send project activity email:", error);
  }
}

export async function sendOwnershipTransferRequestedEmail(
  to: string,
  projectName: string,
  requestedBy: string,
  requestId: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping ownership transfer request email in DEV.");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_requests")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_requests === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "Ownership Transfer Requested",
      content: `<p><strong>${requestedBy}</strong> requested to transfer ownership of <strong>${projectName}</strong> to you.</p><p>Review and accept/reject from the project transfer controls in Envault.</p>`,
      action: {
        text: "Review Transfer Request",
        url: `${APP_URL}/transfer/${requestId}`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.activity,
      to,
      subject: `Ownership Transfer Request: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send ownership transfer request email:", error);
  }
}

export async function sendOwnershipTransferAcceptedEmail(
  to: string,
  projectName: string,
  acceptedBy: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping ownership transfer accepted email in DEV.");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "Ownership Transfer Accepted",
      content: `<p><strong>${acceptedBy}</strong> accepted ownership transfer for <strong>${projectName}</strong>.</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.activity,
      to,
      subject: `Ownership Transfer Accepted: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send ownership transfer accepted email:", error);
  }
}

export async function sendOwnershipTransferRejectedEmail(
  to: string,
  projectName: string,
  rejectedBy: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log("Skipping ownership transfer rejected email in DEV.");
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_access_granted")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_access_granted === false) {
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: "Ownership Transfer Rejected",
      content: `<p><strong>${rejectedBy}</strong> rejected ownership transfer for <strong>${projectName}</strong>.</p>`,
      action: {
        text: "Go to Dashboard",
        url: `${APP_URL}/dashboard`,
      },
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.activity,
      to,
      subject: `Ownership Transfer Rejected: ${projectName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send ownership transfer rejected email:", error);
  }
}

// ============================================
// CLI ACTIVITY EMAILS
// ============================================

/**
 * Send a CLI activity email (secrets pulled or pushed)
 * From: cli@envault.tech
 */
export async function sendCliActivityEmail(
  to: string,
  projectName: string,
  action: "pulled" | "pushed",
  secretCount: number,
  deviceName: string,
  projectId: string,
  userId?: string,
  projectSlug?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(`Skipping CLI Activity email in DEV (${action})`);
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_cli_activity")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_cli_activity === false) {
      console.log(`Skipping CLI Activity email for ${to} (User opted out)`);
      return;
    }
  }

  const title =
    action === "pulled"
      ? `Secrets Pulled from ${projectName}`
      : `Secrets Pushed to ${projectName}`;

  const description =
    action === "pulled"
      ? `<strong>${secretCount}</strong> secret${
          secretCount !== 1 ? "s" : ""
        } were pulled from <strong>${projectName}</strong> via the CLI on <strong>${deviceName}</strong>.`
      : `<strong>${secretCount}</strong> secret${
          secretCount !== 1 ? "s" : ""
        } were pushed to <strong>${projectName}</strong> via the CLI from <strong>${deviceName}</strong>.`;

  const projectUrl = projectSlug
    ? `/project/${projectSlug}`
    : `/project/${projectId}`;

  try {
    const html = getEmailHtml({
      heading: title,
      content: `<p>${description}</p><p>If this wasn't you, revoke CLI access from your settings.</p>`,
      action: {
        text: `View ${projectName}`,
        url: `${APP_URL}${projectUrl}`,
      },
      footerText:
        "You're receiving this because CLI activity notifications are enabled.",
      logoUrl: LOGO_URL,
    });

    const { error } = await sendBrevoEmail({
      from: SENDERS.cli,
      to,
      subject: `CLI ${
        action === "pulled" ? "Pull" : "Push"
      }: ${projectName} - Envault`,
      html,
    });
    if (error) {
      console.error("Resend API failed to send CLI activity email:", error);
    }
  } catch (error) {
    console.error("Failed to send CLI activity email:", error);
  }
}

// ============================================
// SYSTEM UPDATE EMAILS
// ============================================

/**
 * Send a system update/maintenance email
 * From: system@envault.tech
 */
export async function sendSystemUpdateEmail(
  to: string,
  title: string,
  message: string,
  userId?: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.BREVO_API_KEY) {
    console.log(`Skipping System Update email in DEV: ${title}`);
    return;
  }

  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("email_system_updates")
      .eq("user_id", userId)
      .single();

    if (prefs && prefs.email_system_updates === false) {
      console.log(`Skipping System Update email for ${to} (User opted out)`);
      return;
    }
  }

  try {
    const html = getEmailHtml({
      heading: title,
      content: `<p>${message}</p>`,
      action: {
        text: "View Status Page",
        url: `${APP_URL}/status`,
      },
      footerText:
        "You're receiving this because system update notifications are enabled.",
      logoUrl: LOGO_URL,
    });

    await sendBrevoEmail({
      from: SENDERS.system,
      to,
      subject: `${title} - Envault`,
      html,
    });
  } catch (error) {
    console.error("Failed to send system update email:", error);
  }
}
