import { LegalLayout } from "@/components/legal/LegalLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "End User License Agreement",
  description:
    "Read the End User License Agreement (EULA) for Envault software, integrations, and services.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Terms%20OG.png"],
  },
};

const sections = [
  { id: "acknowledgment", title: "Acknowledgment & Acceptance" },
  { id: "license-grant", title: "License Grant" },
  { id: "restrictions", title: "Restrictions" },
  { id: "intellectual-property", title: "Intellectual Property Rights" },
  { id: "third-party", title: "Third-Party Services & Integrations" },
  { id: "termination", title: "Termination" },
  { id: "warranty", title: "Disclaimer of Warranty" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "governing-law", title: "Governing Law" },
  { id: "contact", title: "Contact Information" },
];

export default async function EulaPage() {
  return (
    <LegalLayout
      title="End User License Agreement (EULA)"
      lastUpdated="21 April 2026"
      sections={sections}
    >
      <section
        id="acknowledgment"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          1. Acknowledgment and Acceptance
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          This End-User License Agreement (&quot;EULA&quot;) is a legal
          agreement between you (either an individual or a single entity) and
          Envault. By installing, copying, or otherwise using the Envault
          software, CLI, APIs, or Vercel Integration, you agree to be bound by
          the terms of this EULA.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          If you do not agree to the terms of this EULA, do not install or use
          the Software.
        </p>
      </section>

      <section
        id="license-grant"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          2. License Grant
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Envault grants you a revocable, non-exclusive, non-transferable,
          limited license to download, install, and use the Software, including
          but not limited to its official Vercel Integration and Command Line
          Interfaces, strictly in accordance with the terms of this Agreement
          and our published documentation.
        </p>
      </section>

      <section
        id="restrictions"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          3. Restrictions
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          You agree not to, and you will not permit others to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>
            License, sell, rent, lease, assign, distribute, transmit, host,
            outsource, disclose, or otherwise commercially exploit the Software.
          </li>
          <li>
            Modify, make derivative works of, disassemble, decrypt, reverse
            compile, or reverse engineer any part of the Software where such
            restriction is permitted by law.
          </li>
          <li>
            Remove, alter, or obscure any proprietary notice (including any
            notice of copyright or trademark) of Envault or its affiliates.
          </li>
          <li>
            Use the integration tools to violate the security, encryption
            models, or Terms of Service of third-party platforms (like Vercel).
          </li>
        </ul>
      </section>

      <section
        id="intellectual-property"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          4. Intellectual Property Rights
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          The Software, and all intellectual property rights therein, are owned
          by Envault. This EULA does not grant you any rights to trademarks or
          service marks of Envault.
        </p>
      </section>

      <section
        id="third-party"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          5. Third-Party Services and Integrations
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The Software may display, include, or make available third-party
          content or provide links to third-party integrations (such as the
          Vercel platform).
        </p>
        <p className="text-muted-foreground leading-relaxed">
          You acknowledge and agree that Envault shall not be responsible for
          any Third-Party Services, including their accuracy, completeness,
          timeliness, validity, copyright compliance, legality, or any other
          aspect thereof. We do not assume and shall not have any liability or
          responsibility to you or any other person or entity for any
          Third-Party Services.
        </p>
      </section>

      <section
        id="termination"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          6. Termination
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          This EULA shall remain in effect until terminated by you or Envault.
          Envault may, in its sole discretion, at any time and for any or no
          reason, suspend or terminate this Agreement with or without prior
          notice.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          This Agreement will terminate immediately, without prior notice from
          Envault, in the event that you fail to comply with any provision. Upon
          termination, you shall cease all use of the Software and delete all
          copies from your devices.
        </p>
      </section>

      <section
        id="warranty"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          7. Disclaimer of Warranty
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          The software is provided &quot;AS IS&quot; and &quot;AS
          AVAILABLE&quot; and with all faults and defects without warranty of
          any kind. To the maximum extent permitted under applicable law,
          Envault expressly disclaims all warranties, whether express, implied,
          statutory, or otherwise, with respect to the Software.
        </p>
      </section>

      <section
        id="liability"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          8. Limitation of Liability
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Notwithstanding any damages that you might incur, the entire liability
          of Envault and any of its suppliers under any provision of this EULA
          and your exclusive remedy for all of the foregoing shall be limited to
          the amount actually paid by you for the Software or one USD ($1.00) if
          you haven&apos;t bought anything.
        </p>
      </section>

      <section
        id="governing-law"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          9. Governing Law
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          The laws of the jurisdiction where Envault operates, excluding its
          conflicts of law rules, shall govern this EULA and your use of the
          Software. Your use of the Application may also be subject to other
          local, state, national, or international laws.
        </p>
      </section>

      <section id="contact" className="scroll-mt-28 mb-12 pb-8">
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          10. Contact Information
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have any questions about this Agreement, please contact us at{" "}
          <a
            href="mailto:connect@envault.tech?subject=EULA%20Inquiry"
            className="text-foreground hover:underline"
          >
            connect@envault.tech
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
