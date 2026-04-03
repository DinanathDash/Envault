import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { EnvaultAgentClient } from "@/lib/sdk/agent-interceptor";
import { buildCliToolDefinitionText } from "@/lib/sdk/cli-tool-definition";
import { getCliToolDefinitionFreshnessWarning } from "@/lib/sdk/cli-tool-definition-freshness";

const mutationSchema = z.object({
  mutations: z.array(
    z.object({
      key: z.string(),
      value: z.string().optional(),
      action: z.enum(["upsert", "delete"]),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token || !token.startsWith("envault_agt_")) {
    return NextResponse.json(
      { error: "Missing or invalid envault_agt_ token" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const messages = body?.messages;
  const projectId = body?.projectId;

  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { error: "messages[] is required" },
      { status: 400 },
    );
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const endpoint = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const client = new EnvaultAgentClient(
    endpoint,
    token,
    typeof projectId === "string" ? projectId : undefined,
  );

  // Mock current vault state for now; this is redacted before the model sees it.
  const mockVaultState: Record<string, string> = {
    DB_PASSWORD: "mock-db-password",
    API_TOKEN: "mock-api-token",
  };
  const redactedState = client.prepareLlmContext(mockVaultState);
  const cliToolDefinition = buildCliToolDefinitionText();
  const cliManifestFreshnessWarning =
    await getCliToolDefinitionFreshnessWarning();

  const systemPrompt = [
    "You are Envault Agent. Use the execute_mutations tool for any vault change.",
    "Only produce arguments matching the tool schema exactly.",
    [
      "Execution Policy:",
      "- Act as an operations agent, not a codebase explorer.",
      "- Do not claim to scan/search/read repository files or docs.",
      "- Do not emit investigation logs like 'Searched...' or 'Read file...'.",
      "- Convert user intent directly into execute_mutations calls whenever possible.",
      "- For requests like 'set KEY=VALUE in development', use action=upsert with environment='development'.",
      "- For delete requests, use action=delete and include only the key.",
      "- If required inputs are missing, ask one concise clarifying question.",
      "- Keep user-facing replies short: action summary, pending approval id, and approve command if needed.",
    ].join("\n"),
    cliToolDefinition,
    ...(cliManifestFreshnessWarning ? [cliManifestFreshnessWarning] : []),
    "Project context resolution order for SDK calls: envault.json -> ENVAULT_PROJECT_ID -> envault status fallback.",
    `Current vault state (redacted): ${JSON.stringify(redactedState)}`,
  ].join("\n\n");

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

  const result = streamText({
    model: google(process.env.ENVAULT_AGENT_MODEL || "gemini-1.5-flash"),
    system: systemPrompt,
    messages,
    tools: {
      execute_mutations: tool({
        description:
          "Execute secret mutations through Envault HITL pipeline using strict mutation schema.",
        inputSchema: mutationSchema,
        execute: async (args) => {
          const validated = mutationSchema.parse(args);
          const executionResult = await client.executeMutation(validated);
          return {
            ok: true,
            executionResult,
          };
        },
      }),
    },
  });

  return result.toTextStreamResponse();
}
