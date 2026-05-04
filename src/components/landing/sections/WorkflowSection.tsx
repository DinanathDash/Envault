import { Database, Terminal, Users } from "lucide-react";
import { AnimatedStat } from "@/components/landing/ui/AnimatedStat";
import { AnimatedWorkflow } from "@/components/landing/animations/AnimatedWorkflow";
import { SlideUp } from "@/components/landing/animations/SlideUp";
import { FadeIn } from "@/components/landing/animations/FadeIn";

const workflowSteps = [
  {
    title: "Connect Repo Once",
    description:
      "Project owners run `envault init`, choose a default environment (for example `development`), and commit `envault.json` so the repo is linked and teammates can pull without `--env` flags.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    icon: Database,
  },
  {
    title: "Login And Pull",
    description:
      "A new teammate runs `envault login` then `envault pull` inside the repo. No `.env` handoff, no manual copy/paste.",
    color: "text-green-500",
    bg: "bg-green-500/10",
    icon: Users,
  },
  {
    title: "Stress-Test The Guardrails",
    description:
      "Design partners get free access to hammer CLI flows, GitHub JIT auto-provisioning, and HITL approval fencing with direct feedback loops to our team.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    icon: Terminal,
  },
];

export function WorkflowSection() {
  return (
    <section className="py-16 md:py-24 bg-bone dark:bg-void relative overflow-hidden">
      <div className="container px-4 md:px-6">
        <SlideUp className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-foreground leading-[1.1]">
            From zero setup to synced secrets
            <br />
            in about 10 seconds.
          </h2>
          <p className="max-w-[700px] mx-auto font-mono text-sm uppercase tracking-wider text-muted-foreground">
            LINK. LOGIN. PULL. SHIP.
            <br />
            BUILT FOR DAILY DEVELOPER ONBOARDING.
          </p>
        </SlideUp>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-stretch mb-16">
          {/* Left Column: Image Placeholder */}
          <FadeIn className="relative border border-border min-h-[250px] sm:min-h-[300px] md:min-h-[350px] aspect-square sm:aspect-[5/4] lg:aspect-auto lg:h-full max-h-[500px] lg:max-h-none">
            <AnimatedWorkflow />
          </FadeIn>

          {/* Right Column: Workflow Steps */}
          <div className="grid gap-4 auto-rows-fr lg:h-full">
            {workflowSteps.map((step, index) => (
              <SlideUp
                key={index}
                delay={index * 0.15}
                className="group h-full border border-border p-3 md:p-6 rounded-none bg-background hover:bg-secondary/30 transition-colors"
              >
                <div className="flex h-full items-start space-x-4 md:space-x-6">
                  <div
                    className={`p-3 md:p-4 rounded-none ${step.bg} ${step.color} flex-shrink-0 border border-black/5 dark:border-white/5`}
                  >
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-mono text-sm uppercase tracking-wider font-bold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                      {step.description}
                    </p>
                  </div>
                </div>
              </SlideUp>
            ))}
          </div>
        </div>

        {/* Bottom Stats Row */}
        <SlideUp delay={0.6} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Onboarding Flow", value: "10s" },
            { label: "Core Commands", value: "2" },
            { label: "Design Partners", value: "5-10" },
            { label: "Program Cost", value: "$0" },
          ].map((stat, index) => (
            <div
              key={index}
              className="text-center p-8 border border-border rounded-none bg-background hover:bg-secondary/30 transition-colors"
            >
              <AnimatedStat value={stat.value} />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </SlideUp>
      </div>
    </section>
  );
}
