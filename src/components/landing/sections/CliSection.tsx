import { Terminal, Github, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AnimatedTerminal } from "@/components/landing/animations/animated-terminal";
import { headers } from "next/headers";
import { FadeIn } from "@/components/landing/animations/FadeIn";
import { SlideUp } from "@/components/landing/animations/SlideUp";

export async function CliSection() {
  let version: string | null = null;
  try {
    // Resolve absolute URL for SSR route fetch across local/dev/prod.
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

    const res = await fetch(
      `${baseUrl}/api/cli-version`,
      isDev ? { cache: "no-store" } : { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { version?: string };
      version = data.version ?? null;
    }
  } catch {
    console.warn("Could not fetch CLI version during SSR");
  }

  const workflowSteps = [
    {
      icon: Github,
      title: "GitHub JIT Onboarding",
      desc: "Link the repo once, then collaborators get Viewer access automatically when they run `envault pull` in that workspace.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Zap,
      title: "Smart Environment Selection",
      desc: "Default environment selection during `init` and automatic context-aware command execution. No more manual flag juggling.",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Shield,
      title: "Secure Device Flow",
      desc: "Authenticate securely via browser without handling long-lived tokens manually. Multi-environment aware authentication.",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <section className="py-16 md:py-32 relative z-20">
      <div className="container px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* Left Column: Content */}
          <div className="space-y-4">
            <SlideUp className="space-y-4">
              <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
                <Terminal className="w-4 h-4" />
                <span>Command Line Interface</span>
              </div>

              <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.1] text-void dark:text-bone">
                Onboard developers with two commands.
              </h2>
              <p className="max-w-lg font-mono text-sm uppercase tracking-wider text-void/60 dark:text-bone/60">
                ENVAULT LOGIN. ENVAULT PULL.
                <br />
                GITHUB JIT CHECKS REPO COLLABORATORS AND UNLOCKS VIEW ACCESS
                INSTANTLY.
              </p>
            </SlideUp>

            <div className="space-y-4">
              {workflowSteps.map((item, i) => (
                <SlideUp
                  key={i}
                  delay={i * 0.15}
                  className="group flex items-start space-x-4 p-4 rounded-none bg-card/50 backdrop-blur-sm border border-muted/20 hover:border-primary/50 transition-colors shadow-sm"
                >
                  <div
                    className={`mt-1 p-3 rounded-none ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}
                  >
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-void dark:text-bone">
                      {item.title}
                    </h3>
                    <p className="text-void/70 dark:text-bone/70 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </SlideUp>
              ))}
            </div>

            <FadeIn delay={0.4} className="pt-4 flex items-center gap-4">
              <Link href="/docs/platform/cli/reference">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base shadow-lg shadow-primary/20 rounded-none"
                >
                  Read the Docs
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </Button>
              </Link>
              <div className="text-sm text-muted-foreground">
                {version ? `v${version} released` : "Latest CLI release"}
              </div>
            </FadeIn>
          </div>

          {/* Right Column: Premium Terminal visualization */}
          <FadeIn delay={0.2} className="">
            <AnimatedTerminal />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
