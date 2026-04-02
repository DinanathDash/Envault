"use client";

import { useEffect, useState, useCallback } from "react";
import { Link } from "next-view-transitions";
import {
  Book,
  MessageCircle,
  Activity,
  Mail,
  Github,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { STATUS_CONFIG, type StatusLevel } from "@/lib/system/status-config";
import type { SystemStatusSummary } from "@/lib/system/system-status";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const XLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const faqs = [
  {
    question: "What is Envault?",
    answer:
      "Envault is a secure, zero-knowledge environment variable management platform designed for modern development teams. It allows you to safely store, share, and sync your secrets across your team and infrastructure.",
  },
  {
    question: "How secure is my data?",
    answer:
      "Extremely secure. Envault employs end-to-end encryption using AES-256-GCM. Your secrets are encrypted client-side before ever reaching our servers, meaning even we cannot read your environment variables.",
  },
  {
    question: "Can I self-host Envault?",
    answer:
      "Yes, Envault is source-available under the Functional Source License (FSL). You can clone the repository from GitHub and deploy it to your own infrastructure (like Vercel, Supabase, or custom servers) for complete control over your data. Commercial use to offer a competing service is restricted under FSL.",
  },
  {
    question: "How does team collaboration work?",
    answer:
      "You can invite team members to your projects and assign them roles (Owner, Editor, Viewer). Access to specific environment variables is strictly controlled through our role-based access control system.",
  },
  {
    question: "What integrations are supported?",
    answer:
      "Envault provides a powerful CLI for your local development workflow. We also provide seamless integration with major CI/CD providers through our native plugins and API.",
  },
];

interface SupportViewProps {
  inDashboard?: boolean;
}

const communityColors = {
  bg: "bg-violet-500/10",
  border: "hover:border-violet-500/50",
  text: "text-violet-500",
};

export function SupportView({ inDashboard = false }: SupportViewProps) {
  const [status, setStatus] = useState<StatusLevel>("operational");
  const [loading, setLoading] = useState(true);
  const [incidentCount, setIncidentCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const data: SystemStatusSummary = await fetch("/api/system-status", {
        cache: "default",
      }).then((r) => r.json());
      setStatus(data.level);
      setIncidentCount(data.incidentCount ?? 0);
    } catch (error) {
      console.error("Failed to fetch status:", error);
      setStatus("operational");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="max-w-4xl mx-auto w-full space-y-12">
      {!inDashboard && (
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-serif bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
            How can we help?
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to manage your secrets securely, resolve issues,
            and get the most out of Envault.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Card */}
        <Link href="/status" className="group block h-full">
          <div
            className={`h-full border bg-card text-card-foreground rounded-xl p-6 transition-all hover:shadow-md ${cfg.hoverBorder} relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
              <ExternalLink className="w-5 h-5 text-muted-foreground" />
            </div>
            <div
              className={`w-12 h-12 rounded-lg ${cfg.bg} flex items-center justify-center mb-4`}
            >
              <Activity className={`w-6 h-6 ${cfg.color}`} />
            </div>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
              System Status
              {!loading && (
                <span className="flex h-2 w-2 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`}
                  ></span>
                </span>
              )}
            </h3>
            <p className="text-muted-foreground mb-3">
              {cfg.message + " "} Check the real-time status of Envault&apos;s
              API, dashboard, and CLI services.
            </p>
            <div>
              <div className="flex items-center justify-between text-xs gap-8">
                <div className="flex items-center justify-between flex-1">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium text-foreground">99.9%</span>
                </div>
                <div className="text-muted-foreground">|</div>
                <div className="flex items-center justify-between flex-1">
                  <span className="text-muted-foreground">Response Time</span>
                  <span className="font-medium text-foreground">120ms</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground">Active Incidents</span>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold
                  ${incidentCount === 0 ? `${STATUS_CONFIG.operational.bg} ${STATUS_CONFIG.operational.color}` : `${STATUS_CONFIG.degraded.bg} ${STATUS_CONFIG.degraded.color}`}
                `}
                >
                  {incidentCount}
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Community Card */}
        <div
          className={`border bg-card text-card-foreground rounded-xl p-6 h-full transition-all hover:shadow-md ${communityColors.border}`}
        >
          <div
            className={`w-12 h-12 rounded-lg ${communityColors.bg} flex items-center justify-center mb-4`}
          >
            <MessageCircle className={`w-6 h-6 ${communityColors.text}`} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Community</h3>
          <p className="text-muted-foreground mb-4">
            Read the code, report issues, and follow development on GitHub.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a
                href="https://github.com/dinanathdash/envault"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4" /> GitHub
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a
                href="https://twitter.com/envault_tech"
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogo className="w-4 h-4" /> Twitter
              </a>
            </Button>
          </div>
        </div>

        {/* Documentation Card */}
        <Link href="/docs" className="group block h-full">
          <div className="h-full border bg-card text-card-foreground rounded-xl p-6 transition-all hover:shadow-md hover:border-primary/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
              <ExternalLink className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Book className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
              Documentation
            </h3>
            <p className="text-muted-foreground">
              Learn how to integrate Envault into your workflow, install the
              CLI, and manage team permissions.
            </p>
          </div>
        </Link>

        {/* Contact Card */}
        <a
          href="mailto:dashdinanath056@gmail.com"
          className="group block h-full"
        >
          <div className="h-full border bg-card text-card-foreground rounded-xl p-6 transition-all hover:shadow-md hover:border-blue-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
              <ExternalLink className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Contact Support</h3>
            <p className="text-muted-foreground">
              Need direct assistance? Email our team and we&apos;ll get back to
              you as soon as possible.
            </p>
          </div>
        </a>
      </div>

      {/* FAQs Section */}
      <div className="pt-8 border-t">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        </div>
        <div className="border bg-card rounded-xl p-1">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="px-5 border-b-0"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
                {index !== faqs.length - 1 && (
                  <div className="h-px bg-border w-full" />
                )}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
