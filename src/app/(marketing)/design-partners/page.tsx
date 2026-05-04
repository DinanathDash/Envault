import type { Metadata } from "next";
import { DesignPartnerForm } from "./design-partner-form";

export const metadata: Metadata = {
  title: "Design Partners",
  description:
    "Apply to the Envault Design Partner Program for free, high-collaboration CLI and GitHub JIT stress testing.",
};

export default function DesignPartnersPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative blueprint-grid sharp">
      <main className="flex-1 relative pt-28 md:pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <section className="border border-border bg-background/70 backdrop-blur-sm p-6 sm:p-10 md:p-12 space-y-5">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
              Envault Design Partner Program
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl tracking-tight leading-[0.95]">
              The Envault Design Partner Program
            </h1>
            <p className="font-mono text-sm sm:text-base uppercase tracking-wider text-muted-foreground leading-relaxed max-w-4xl">
              WE NEED 5-10 FAST-MOVING STARTUPS AND DEV AGENCIES TO PUSH ENVAULT
              HARD IN PRODUCTION AND TELL US WHERE IT BREAKS.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="border border-border bg-background/70 p-5 sm:p-6">
              <h2 className="font-mono text-sm uppercase tracking-[0.14em] mb-3">
                What We Need From You
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <li>
                  Feedback on CLI onboarding speed under real teammate churn.
                </li>
                <li>
                  Adversarial testing of HITL interceptor behavior for
                  mutations.
                </li>
                <li>
                  Bug hunting across GitHub JIT auto-provisioning and access
                  drift.
                </li>
              </ul>
            </div>
            <div className="border border-border bg-background/70 p-5 sm:p-6">
              <h2 className="font-mono text-sm uppercase tracking-[0.14em] mb-3">
                What You Get
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <li>White-glove onboarding with direct migration support.</li>
                <li>Private Slack channel with founders for rapid fixes.</li>
                <li>Lifetime free tier for your participating team.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-serif text-3xl sm:text-4xl tracking-tight">
              Apply in under 2 minutes
            </h2>
            <DesignPartnerForm />
          </section>
        </div>
      </main>
    </div>
  );
}
