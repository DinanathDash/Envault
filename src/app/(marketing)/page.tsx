import { Hero } from "@/components/landing/sections/Hero";
import { PlatformHighlights } from "@/components/landing/sections/PlatformHighlights";
import { Features } from "@/components/landing/sections/Features";
import { WorkflowSection } from "@/components/landing/sections/WorkflowSection";
import { CliSection } from "@/components/landing/sections/CliSection";
import { RegMark } from "@/components/landing/ui/RegMark";
import { Testimonials } from "@/components/landing/sections/Testimonials";
import { DesignPartnerCta } from "@/components/landing/sections/DesignPartnerCta";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Envault - 10-Second Developer Onboarding For Secrets",
  description:
    "Stop sharing .env files. Run envault login, then envault pull, and start coding.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "https://www.envault.tech",
    siteName: "Envault",
    images: ["/open-graph/Landing%20OG.png"],
  },
};

export default async function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative blueprint-grid sharp">
      <main className="flex-1 relative">
        <RegMark position="top-left" />
        <RegMark position="top-right" />
        <Hero />
        <WorkflowSection />
        <CliSection />
        <PlatformHighlights />
        <Features />
        <Testimonials />
        <DesignPartnerCta />
        <RegMark position="bottom-left" />
        <RegMark position="bottom-right" />
      </main>
    </div>
  );
}
