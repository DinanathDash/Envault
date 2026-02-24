"use client";

import {
  Shield,
  Lock,
  Users,
  Code,
  Keyboard,
  GitBranch,
} from "lucide-react";

const features = [
  {
    spec: "SPEC_01",
    title: "END-TO-END ENCRYPTION",
    value: "AES-256-GCM",
    description:
      "Your secrets are encrypted before they leave your device using military-grade encryption.",
    icon: Lock,
  },
  {
    spec: "SPEC_02",
    title: "AUTHENTICATION",
    value: "MULTI_AUTH",
    description:
      "WebAuthn passkeys, OAuth (Gmail, GitHub), and device flow authentication with zero knowledge.",
    icon: Shield,
  },
  {
    spec: "SPEC_03",
    title: "INTERFACE_MODE",
    value: "KEYBOARD_FIRST",
    description:
      "Navigate efficiently with fully customizable keyboard shortcuts for every action.",
    icon: Keyboard,
  },
  {
    spec: "SPEC_04",
    title: "DEVELOPER_TOOLS",
    value: "CLI + API",
    description:
      "Powerful CLI and simple API to manage secrets directly from your terminal workflow.",
    icon: Code,
  },
  {
    spec: "SPEC_05",
    title: "COLLABORATION",
    value: "TEAM_ACCESS",
    description:
      "Share projects with your team securely using granular permissions (Owner, Editor, Viewer).",
    icon: Users,
  },
  {
    spec: "SPEC_06",
    title: "ENVIRONMENT MANAGEMENT",
    value: "WORKSPACE_MODE",
    description:
      "Multi-environment scoping for dev, staging, and production with context-aware CLI commands.",
    icon: GitBranch,
  },
];

export function Features() {
  return (
    <section className="py-24 bg-bone dark:bg-void relative overflow-hidden">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-void dark:text-bone">
            Technical Specifications & Security Features
          </h2>
          <p className="max-w-[700px] mx-auto font-mono text-sm uppercase tracking-wider text-void/60 dark:text-bone/60">
            INDUSTRIAL-GRADE SECURITY / DEVELOPER-CENTRIC DESIGN
          </p>
        </div>

        {/* 3-Column Industrial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-black/20 dark:border-white/20">
          {features.map((feature, index) => (
            <div
              key={index}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
