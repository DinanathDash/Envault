import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Function to load .env.local manually
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, "utf8");
      envConfig.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["'](.*)["']$/, "$1"); // Remove quotes if present
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    console.warn("Could not load .env.local", e);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Error: Missing environment variables.");
  console.error(
    "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local",
  );
  process.exit(1);
}

console.log(`Connecting to Supabase at ${SUPABASE_URL}...`);
console.log("Triggering 'rotate-keys' function...");

const functionUrl = `${SUPABASE_URL}/functions/v1/rotate-keys`;

(async () => {
  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(
        `[X] Function invocation failed with status: ${response.status} ${response.statusText}`,
      );
      console.error("Body:", text);
      process.exit(1);
    }

    console.log("[OK] Function invoked successfully!");
    try {
      console.log("Response:", JSON.parse(text));
    } catch {
      console.log("Response:", text);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
})();
