import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, Bot, Boxes, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideUp } from "@/components/landing/animations/SlideUp";
import { FadeIn } from "@/components/landing/animations/FadeIn";

const highlights = [
  {
    icon: Boxes,
    title: "Build With CLI, SDK, And MCP",
    desc: "Use one secret model across terminal workflows, TypeScript services, and AI agent tooling.",
  },
  {
    icon: Bot,
    title: "Open Agent Runtime Surface",
    desc: "The cloud control plane is proprietary, but agent execution code is MIT-licensed so teams can inspect runtime behavior directly.",
  },
  {
    icon: PackageCheck,
    title: "Audit HITL + Delegated JWT Flow",
    desc: "The MIT-licensed MCP and SDK code lets you verify envault_agt_ short-lived token gating and approval-first mutation behavior.",
  },
];

export async function PlatformHighlights() {
  let sdkVersion: string | null = null;
  let mcpVersion: string | null = null;

  try {
    const headersList = await headers();
    const isDev = process.env.NODE_ENV === "development";
    const internalDevPort = process.env.PORT || "3000";
    const host =
      headersList.get("x-forwarded-host") ||
      headersList.get("host") ||
      "envault.tech";
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const baseUrl = isDev
      ? `http://127.0.0.1:${internalDevPort}`
      : `${protocol}://${host}`;

    const [sdkRes, mcpRes] = await Promise.all([
      fetch(`${baseUrl}/api/sdk-version`, isDev
        ? { cache: "no-store" }
        : { next: { revalidate: 3600 } }),
      fetch(`${baseUrl}/api/mcp-version`, isDev
        ? { cache: "no-store" }
        : { next: { revalidate: 3600 } }),
    ]);

    if (sdkRes.ok) {
      const sdkData = (await sdkRes.json()) as { latest_version?: string };
      sdkVersion = sdkData.latest_version ?? null;
    }

    if (mcpRes.ok) {
      const mcpData = (await mcpRes.json()) as { latest_version?: string };
      mcpVersion = mcpData.latest_version ?? null;
    }
  } catch {
    console.warn("Could not fetch SDK/MCP versions during SSR");
  }

  return (
    <section className="bg-bone dark:bg-void py-16 md:py-24 relative z-20">
      <div className="container px-4 md:px-6 space-y-8">
        <SlideUp className="text-center mb-10 md:mb-14 space-y-4">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.1] text-void dark:text-bone">
            Built for fast onboarding loops.
          </h2>
          <p className="max-w-[780px] mx-auto font-mono text-sm uppercase tracking-wider text-void/60 dark:text-bone/60">
            CORE CAPABILITIES USERS SHOULD KNOW BEFORE READING THE DOCS
          </p>
        </SlideUp>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-black/20 dark:border-white/20">
          {highlights.map((item, index) => (
            <FadeIn
              key={item.title}
              delay={index * 0.1}
              className="h-full border-r border-b border-black/20 dark:border-white/20 last:border-r-0 p-6 bg-bone dark:bg-void hover:bg-void/5 dark:hover:bg-bone/5 transition-colors relative group space-y-3"
            >
              <div className="inline-flex p-3 bg-primary/10 text-primary border border-primary/20">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="font-mono text-sm uppercase tracking-wider text-void dark:text-bone">
                {item.title}
              </h3>
              <p className="text-sm text-void/70 dark:text-bone/70 leading-relaxed font-sans">
                {item.desc}
              </p>
            </FadeIn>
          ))}
        </div>

        <FadeIn
          delay={0.35}
          className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/docs/platform/guides/sdk-mcp-agent-workflows"
            >
              <Button size="lg" className="rounded-none h-12 px-8 w-full sm:w-auto">
                Explore SDK + MCP
                <ArrowRight className="w-4 h-4 -rotate-45" />
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground font-mono uppercase tracking-wide">
            {sdkVersion ? `SDK v${sdkVersion}` : "SDK unavailable"} /{" "}
            {mcpVersion ? `MCP v${mcpVersion}` : "MCP unavailable"}
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
