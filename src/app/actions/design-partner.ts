"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailHtml } from "@/lib/infra/email-html";
import { SENDERS, sendBrevoEmail } from "@/lib/infra/email";
import {
  companyTypeLabels,
  designPartnerSchema,
  type DesignPartnerValues,
} from "@/lib/validators/design-partner";

type SubmitDesignPartnerResult = {
  success: boolean;
  error?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function notifyDesignPartnerLead(payload: DesignPartnerValues) {
  const html = getEmailHtml({
    previewText: "New design partner application received",
    heading: "New Design Partner Application",
    content: `
      <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Work Email:</strong> ${escapeHtml(payload.workEmail)}</p>
      <p><strong>Company Name:</strong> ${escapeHtml(payload.companyName)}</p>
      <p><strong>Company Type:</strong> ${escapeHtml(companyTypeLabels[payload.companyType])}</p>
      <p><strong>Pain Point:</strong><br />${escapeHtml(payload.painPoint).replaceAll("\n", "<br />")}</p>
    `,
    footerText: "Envault Design Partner Intake",
  });

  const { error } = await sendBrevoEmail({
    from: SENDERS.notifications,
    to: "Envault Team <connect@envault.tech>",
    subject: "New Design Partner Application",
    html,
    replyTo: payload.workEmail,
  });

  if (error) {
    throw error;
  }
}

async function sendDesignPartnerApplicantConfirmation(
  payload: DesignPartnerValues,
) {
  const appUrl = (
    process.env.EMAIL_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.envault.tech"
  ).replace(/\/+$/, "");

  const html = getEmailHtml({
    previewText: "We received your Envault design partner application",
    heading: "Application Received",
    content: `
      <p>Thanks ${escapeHtml(payload.name)}. We received your design partner application.</p>
      <p>Our team will review your workflow notes and follow up shortly.</p>
      <p><strong>Submitted details:</strong></p>
      <p>Company: ${escapeHtml(payload.companyName)} (${escapeHtml(companyTypeLabels[payload.companyType])})</p>
      <p>Pain Point: ${escapeHtml(payload.painPoint).replaceAll("\n", "<br />")}</p>
    `,
    action: {
      text: "Read Envault Docs",
      url: `${appUrl}/docs/platform`,
    },
    footerText: "You are receiving this because you submitted the Envault design partner form.",
  });

  const { error } = await sendBrevoEmail({
    from: SENDERS.notifications,
    to: payload.workEmail,
    subject: "We received your Envault Design Partner application",
    html,
  });

  if (error) {
    throw error;
  }
}

export async function submitDesignPartnerApplication(
  input: DesignPartnerValues,
): Promise<SubmitDesignPartnerResult> {
  const parsed = designPartnerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid form submission.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("design_partner_applications")
    .insert({
      name: parsed.data.name,
      work_email: parsed.data.workEmail,
      company_name: parsed.data.companyName,
      company_type: parsed.data.companyType,
      pain_point: parsed.data.painPoint,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[Design Partner] Supabase insert failed:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });

    if (error?.code === "42P01") {
      return {
        success: false,
        error:
          "Design partner table is not set up yet. Run the Supabase migration first.",
      };
    }

    return {
      success: false,
      error: "Could not submit right now. Please try again in a minute.",
    };
  }

  after(async () => {
    const [leadNotificationResult, applicantConfirmationResult] =
      await Promise.allSettled([
        notifyDesignPartnerLead(parsed.data),
        sendDesignPartnerApplicantConfirmation(parsed.data),
      ]);

    if (leadNotificationResult.status === "rejected") {
      console.error(
        "[Design Partner] Failed to send lead notification:",
        leadNotificationResult.reason,
      );
    }

    if (applicantConfirmationResult.status === "rejected") {
      console.error(
        "[Design Partner] Failed to send applicant confirmation:",
        applicantConfirmationResult.reason,
      );
    }
  });

  return { success: true };
}
