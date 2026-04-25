import { LegalLayout } from "@/components/legal/LegalLayout";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licensing",
  description:
    "Learn how Envault source code and package subdirectories are licensed, including repository scope exceptions.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Licensing.png"],
  },
};

const sections = [
  { id: "overview", title: "Overview" },
  { id: "what-you-can-do", title: "What You Can Do" },
  { id: "what-you-cannot-do", title: "What You Cannot Do" },
  { id: "faq", title: "Frequently Asked Questions" },
  { id: "full-license", title: "Full License Text" },
  { id: "contact", title: "Contact" },
];

export default async function LicensingPage() {
  return (
    <LegalLayout
      title="Licensing"
      lastUpdated="22 April 2026"
      sections={sections}
    >
      <section
        id="overview"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">Overview</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Envault source code is distributed under a{" "}
          <strong>proprietary, all-rights-reserved inspection license</strong>.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Most of this repository is <strong>not open source</strong>. You may
          inspect the code for transparency and security auditing, but you may
          not run, modify, redistribute, or deploy proprietary portions unless
          you have prior written permission from the copyright holder.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-4">
          <strong>Scope exception:</strong> the <code>mcp-server/</code> and{" "}
          <code>src/lib/sdk/</code> directories are distributed under the MIT
          License. The repository root LICENSE applies to all other paths.
        </p>
      </section>

      <section
        id="what-you-can-do"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          What You Can Do
        </h2>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <h3 className="font-semibold text-foreground">Read the Code</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              View, read, and inspect the repository for transparency,
              educational reference, and architecture understanding.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <h3 className="font-semibold text-foreground">
                Audit Security Practices
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Analyze the source code to verify security controls or identify
              vulnerabilities.
            </p>
          </div>
        </div>
      </section>

      <section
        id="what-you-cannot-do"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          What You Cannot Do
        </h2>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h3 className="font-semibold text-foreground">
                Execute, Compile, Run, or Deploy
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You may not execute, compile, run, or deploy proprietary
              repository components in any environment.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h3 className="font-semibold text-foreground">
                Copy, Modify, Fork, or Derive
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You may not copy, modify, fork, or create derivative works.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h3 className="font-semibold text-foreground">
                Redistribute or Commercialize
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You may not distribute, publish, sublicense, share, sell, or use
              the Licensed Work to provide any commercial or non-commercial
              service.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h3 className="font-semibold text-foreground">Remove Notices</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You may not remove or alter copyright, proprietary, or license
              notices.
            </p>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Is Envault open source?
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              No. Envault is source-visible for inspection and security
              auditing, but it is not licensed as open-source software.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Can I self-host or run Envault locally?
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Proprietary parts of the repository require prior explicit written
              permission. The <code>mcp-server/</code> and{" "}
              <code>src/lib/sdk/</code> directories are MIT-licensed exceptions.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Can I fork or modify this repository?
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Proprietary repository sections cannot be forked or modified
              without written permission. MIT-licensed subdirectories follow
              their own license terms.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Can I audit the code for security?
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Yes. Security review and vulnerability analysis are explicitly
              permitted.
            </p>
          </div>
        </div>
      </section>

      <section
        id="full-license"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          Full License Text
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Read the complete legal terms in the{" "}
          <Link
            href="/LICENSE.txt"
            className="font-mono text-sm text-foreground hover:text-primary transition-colors underline underline-offset-4"
          >
            LICENSE.txt
          </Link>{" "}
          file, or in the repository root{" "}
          <a
            href="https://github.com/DinanathDash/Envault/blob/main/LICENSE"
            className="font-mono text-sm text-foreground hover:text-primary transition-colors underline underline-offset-4"
          >
            LICENSE
          </a>
          .
        </p>
      </section>

      <section id="contact" className="scroll-mt-28 mb-12">
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          Questions About Licensing?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          For written permissions or licensing clarifications, contact us.
        </p>
        <a
          href="mailto:connect@envault.tech?subject=Licensing%20Inquiry&body=Hi%20Envault%20Team%2C%0A%0AI%20have%20a%20question%20about%20licensing%3A%0A%0A"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-none hover:bg-primary/90 transition-colors font-medium"
        >
          Contact Us
        </a>
      </section>
    </LegalLayout>
  );
}
