import { Lock, Users, Fingerprint, Activity, UserCheck, Github } from "lucide-react";
import { SlideUp } from "@/components/landing/animations/SlideUp";
import { FadeIn } from "@/components/landing/animations/FadeIn";

const features = [
  {
    spec: "SPEC_01",
    title: "END-TO-END ENCRYPTION",
    value: "AES-256-GCM",
    description:
      "Secrets are encrypted before they leave your machine, then decrypted locally in CLI workflows.",
    icon: Lock,
  },
  {
    spec: "SPEC_02",
    title: "PASSWORDLESS AUTH",
    value: "PASSKEY + OAUTH",
    description:
      "Use passkeys and OAuth so teammates can authenticate quickly without password resets or token juggling.",
    icon: Fingerprint,
  },
  {
    spec: "SPEC_03",
    title: "GITHUB-INTEGRATED ACCESS",
    value: "MULTI-ACCOUNT READY",
    description:
      "Link one repo and let GitHub collaborator status drive JIT access during `envault pull`.",
    icon: Github,
  },
  {
    spec: "SPEC_04",
    title: "ENVIRONMENT-SCOPED PERMISSIONS",
    value: "LEAST PRIVILEGE",
    description:
      "Gate read/write access by environment so teams move fast without exposing every key to every person.",
    icon: Users,
  },
  {
    spec: "SPEC_05",
    title: "REAL-TIME SYNC RELIABILITY",
    value: "HYBRID REFRESH",
    description:
      "Realtime plus focus-aware refresh keeps your local and dashboard views in sync while you ship.",
    icon: Activity,
  },
  {
    spec: "SPEC_06",
    title: "ACCOUNT LIFECYCLE SAFETY",
    value: "SOFT DELETE + RECOVERY",
    description:
      "Recovery windows and controlled purge flows help teams recover from bad deletes without chaos.",
    icon: UserCheck,
  },
];

export function Features() {
  return (
    <section className="py-24 bg-bone dark:bg-void relative overflow-hidden">
      <div className="container px-4 md:px-6">
        <SlideUp className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-void dark:text-bone">
            Built For Fast Daily Use
          </h2>
          <p className="max-w-[700px] mx-auto font-mono text-sm uppercase tracking-wider text-void/60 dark:text-bone/60">
            LOGIN / PULL / RUN / SHIP
          </p>
        </SlideUp>

        {/* 3-Column Industrial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-black/20 dark:border-white/20">
          {features.map((feature, index) => (
            <FadeIn
              key={index}
              delay={index * 0.1}
              className="border-r border-b border-black/20 dark:border-white/20 last:border-r-0 p-8 bg-bone dark:bg-void hover:bg-void/5 dark:hover:bg-bone/5 transition-colors relative group"
            >
              {/* Spec Label */}
              <div className="absolute top-3 right-3 font-mono text-[10px] text-void/30 dark:text-bone/30 tracking-wider">
                [{feature.spec}]
              </div>

              {/* Icon */}
              <feature.icon
                className="w-8 h-8 text-void dark:text-bone mb-4"
                strokeWidth={1.5}
              />

              {/* Title */}
              <h3 className="font-mono text-sm uppercase tracking-wider mb-2 text-void dark:text-bone">
                {feature.title}
              </h3>

              {/* Value Badge */}
              <div className="inline-block bg-void dark:bg-bone text-bone dark:text-void px-3 py-1 rounded-none font-mono text-xs mb-4">
                {feature.value}
              </div>

              {/* Description */}
              <p className="text-sm text-void/70 dark:text-bone/70 leading-relaxed font-sans">
                {feature.description}
              </p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
