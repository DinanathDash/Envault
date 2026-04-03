import { NextResponse } from "next/server";
import { SDK_VERSION } from "@/lib/sdk/version";

export async function GET() {
  const minSupportedFromEnv =
    process.env.ENVAULT_SDK_MIN_SUPPORTED_VERSION?.trim() || SDK_VERSION;

  return NextResponse.json({
    latest_version: SDK_VERSION,
    min_supported_version: minSupportedFromEnv,
  });
}
