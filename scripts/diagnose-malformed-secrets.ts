import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env"] });

type SecretRow = {
  id: string;
  key: string;
  project_id: string;
  environment_id: string;
  value: string;
};

type Finding = {
  id: string;
  key: string;
  project_id: string;
  environment_id: string;
  reason: string;
};

const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function isBase64Decodable(value: string): boolean {
  try {
    Buffer.from(value, "base64");
    return true;
  } catch {
    return false;
  }
}

function analyzeSecretValue(secret: SecretRow): Finding | null {
  const value = secret.value || "";

  if (value.startsWith("v1:")) {
    const parts = value.split(":");
    if (parts.length !== 3) {
      return { ...secret, reason: "invalid_v1_format_parts" };
    }

    const ciphertext = parts[2];
    if (!isBase64Decodable(ciphertext)) {
      return { ...secret, reason: "invalid_v1_ciphertext_base64" };
    }

    const combined = Buffer.from(ciphertext, "base64");
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return { ...secret, reason: "invalid_v1_ciphertext_too_short" };
    }

    return null;
  }

  if (!isBase64Decodable(value)) {
    return { ...secret, reason: "invalid_legacy_base64" };
  }

  const combined = Buffer.from(value, "base64");
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    return { ...secret, reason: "invalid_legacy_ciphertext_too_short" };
  }

  return null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const findings: Finding[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("secrets")
      .select("id,key,project_id,environment_id,value")
      .range(from, to);

    if (error) {
      throw new Error(`Failed reading secrets: ${error.message}`);
    }

    const rows = (data || []) as SecretRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const finding = analyzeSecretValue(row);
      if (finding) findings.push(finding);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  if (findings.length === 0) {
    console.log("No malformed ciphertext rows detected.");
    return;
  }

  console.log(`Malformed ciphertext rows detected: ${findings.length}`);
  console.table(
    findings.map((f, idx) => ({
      idx,
      id: f.id,
      key: f.key,
      project_id: f.project_id,
      environment_id: f.environment_id,
      reason: f.reason,
    })),
  );
}

main().catch((error) => {
  console.error("diagnose-malformed-secrets failed:", error);
  process.exit(1);
});
