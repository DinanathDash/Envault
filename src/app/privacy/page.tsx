import { LegalLayout } from "@/components/legal/LegalLayout";
import { createClient } from "@/lib/supabase/server";

const sections = [
  { id: "introduction", title: "Introduction" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "data-security", title: "Data Security & Encryption" },
  { id: "authentication-methods", title: "Modern Authentication Methods" },
  { id: "environment-management", title: "Environment Management Data" },
  { id: "cli-data", title: "CLI Data Collection" },
  { id: "team-data", title: "Team Collaboration Data" },
  { id: "notification-data", title: "Notification Data" },
  { id: "use-of-data", title: "Use of Data" },
  { id: "third-party-providers", title: "Third-Party Service Providers" },
  { id: "data-retention", title: "Data Retention" },
  { id: "your-rights", title: "Your Data Rights" },
  { id: "policy-changes", title: "Changes to This Privacy Policy" },
  { id: "contact", title: "Contact Us" },
];

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="24 February 2026"
      sections={sections}
      user={user}
    >
      <section
        id="introduction"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          1. Introduction
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Welcome to Envault (&quot;we,&quot; &quot;our,&quot; or
          &quot;us&quot;). We respect your privacy and are committed to
          protecting your personal data. This privacy policy will inform you as
          to how we look after your personal data when you visit our website and
          tell you about your privacy rights and how the law protects you. By
          using our Service, you agree to the collection and use of information
          in accordance with this policy.
        </p>
      </section>

      <section
        id="information-we-collect"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          2. Information We Collect
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          We collect several different types of information for various purposes
          to provide and improve our Service to you.
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong className="text-foreground">Personal Data:</strong> While
            using our Service, we may ask you to provide us with certain
            personally identifiable information that can be used to contact or
            identify you (&quot;Personal Data&quot;). Personally identifiable
            information may include, but is not limited to: Email address, First
            name and last name, Cookies and Usage Data.
          </li>
          <li className="leading-relaxed">
            <strong className="text-foreground">Usage Data:</strong> We may also
            collect information how the Service is accessed and used
            (&quot;Usage Data&quot;). This Usage Data may include information
            such as your computer&apos;s Internet Protocol address (e.g. IP
            address), browser type, browser version, the pages of our Service
            that you visit, the time and date of your visit, the time spent on
            those pages, unique device identifiers and other diagnostic data.
          </li>
        </ul>
      </section>

      <section
        id="data-security"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          3. Data Security & Encryption
        </h2>
        <div className="bg-accent/30 border border-border/50 rounded-lg p-6 mb-4">
          <p className="text-muted-foreground leading-relaxed">
            The security of your data is important to us. Envault employs
            end-to-end encryption for your stored environment variables. Your
            secrets are encrypted on the client-side before being transmitted to
            our servers (if applicable) or stored securely using our
            provider&apos;s infrastructure.
          </p>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We use industry-standard{" "}
          <code className="font-mono text-sm bg-accent/50 px-2 py-0.5 rounded">
            AES-256-GCM
          </code>{" "}
          encryption. However, please remember that no method of transmission
          over the Internet, or method of electronic storage is 100% secure.
          While we strive to use commercially acceptable means to protect your
          Personal Data, we cannot guarantee its absolute security.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Our encryption model uses a hierarchical key system:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
          <li>
            <strong>Master Key</strong>: A 32-byte key stored in server
            environment variables, used solely to encrypt/decrypt Data Keys.
          </li>
          <li>
            <strong>Data Keys</strong>: Unique keys for each project, encrypted
            with the Master Key and stored in our database.
          </li>
          <li>
            <strong>Key Rotation</strong>: Data keys can be rotated periodically
            to limit the impact of potential compromises.
          </li>
        </ul>
      </section>

      <section
        id="authentication-methods"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          4. Modern Authentication Methods
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Envault supports multiple secure authentication methods to protect
          your account:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong>WebAuthn Passkeys:</strong> When you register or
            authenticate with passkeys, we store cryptographic public keys and
            device metadata. No passwords or private keys are stored by Envault.
          </li>
          <li className="leading-relaxed">
            <strong>OAuth Providers (Gmail, GitHub):</strong> When linking OAuth
            providers, we receive your email address, name, and OAuth profile ID
            from the provider. These are used solely for account linking and
            authentication purposes. We do not store your OAuth tokens or access
            sensitive OAuth scopes.
          </li>
          <li className="leading-relaxed">
            <strong>Device Flow Authentication:</strong> For CLI authentication,
            we generate temporary device codes and authorization tokens with
            short expiration times. Tokens are sent over HTTPS only and are
            never logged or stored in plaintext.
          </li>
          <li className="leading-relaxed">
            <strong>Authentication Logs:</strong> We maintain security logs of
            authentication attempts and successful logins for 1 year to detect
            suspicious activities and prevent unauthorized access.
          </li>
        </ul>
      </section>

      <section
        id="environment-management"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          5. Environment Management Data
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Envault enables managing multiple environments (development, staging,
          production) with workspace-aware scoping:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong>Environment Metadata:</strong> We store environment names,
            descriptions, types, and creation timestamps for organizational
            purposes.
          </li>
          <li className="leading-relaxed">
            <strong>Environment-Level Permissions:</strong> Access control data
            for each environment, including which team members can view or
            modify secrets in specific environments.
          </li>
          <li className="leading-relaxed">
            <strong>Environment Context:</strong> CLI and API usage data that
            tracks which environment is being accessed during operations for
            audit and security purposes.
          </li>
          <li className="leading-relaxed">
            <strong>Environment State:</strong> Workspace mode context data that
            remembers your last-used environment to streamline your workflow.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          Environment data is encrypted consistently with your secrets and is
          subject to the same access control and retention policies.
        </p>
      </section>

      <section
        id="cli-data"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          6. CLI Data Collection
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          When you use the Envault CLI, we may collect certain information to
          provide and improve the service:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong>Usage Analytics</strong>: Anonymous usage statistics such as
            command frequency, error rates, and performance metrics to improve
            CLI functionality. This can be disabled in your account settings.
          </li>
          <li className="leading-relaxed">
            <strong>Device Information</strong>: Basic device identifiers,
            operating system, and CLI version for compatibility and support
            purposes.
          </li>
          <li className="leading-relaxed">
            <strong>Authentication Data</strong>: Temporary authentication
            tokens for CLI sessions, which are encrypted and have short
            expiration times.
          </li>
          <li className="leading-relaxed">
            <strong>Error Logs</strong>: Error messages and stack traces
            (without sensitive data) to diagnose and fix issues.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          All CLI communications occur over HTTPS, and sensitive operations
          require proper authentication.
        </p>
      </section>

      <section
        id="team-data"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          7. Team Collaboration Data
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Envault enables secure team collaboration. When you participate in
          team features, we process additional data:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong>Project Membership</strong>: Information about team members,
            their roles (Owner, Editor, Viewer), and access permissions.
          </li>
          <li className="leading-relaxed">
            <strong>Access Requests</strong>: Records of pending and approved
            access requests to projects, including timestamps and approval
            history.
          </li>
          <li className="leading-relaxed">
            <strong>Collaboration Activity</strong>: Logs of team activities
            such as secret modifications, project sharing, and member management
            (for audit purposes).
          </li>
          <li className="leading-relaxed">
            <strong>Shared Projects</strong>: Metadata about projects
            you&apos;ve been invited to, including project names and your access
            level.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          Team data is encrypted and access is strictly controlled by role-based
          permissions. Project owners have control over member access and data
          visibility.
        </p>
      </section>

      <section
        id="notification-data"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          8. Notification Data
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Envault provides notifications for team collaboration, security
          alerts, and service updates:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong>Notification Preferences</strong>: Your choices regarding
            email and in-app notifications, which you can manage in account
            settings.
          </li>
          <li className="leading-relaxed">
            <strong>Notification History</strong>: Records of notifications
            sent, including delivery status and interaction data.
          </li>
          <li className="leading-relaxed">
            <strong>Security Alerts</strong>: Critical security notifications
            that cannot be disabled, such as account access from new devices.
          </li>
          <li className="leading-relaxed">
            <strong>Service Communications</strong>: Updates about new features,
            maintenance, or policy changes.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          Notification data helps us keep you informed about important account
          and security matters while respecting your communication preferences.
        </p>
      </section>

      <section
        id="use-of-data"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          9. Use of Data
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Envault uses the collected data for various purposes:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>To provide and maintain the Service</li>
          <li>To notify you about changes to our Service</li>
          <li>
            To allow you to participate in interactive features of our Service
            when you choose to do so
          </li>
          <li>To provide customer care and support</li>
          <li>
            To provide analysis or valuable information so that we can improve
            the Service
          </li>
          <li>To monitor the usage of the Service</li>
          <li>To detect, prevent and address technical issues</li>
        </ul>
      </section>

      <section
        id="third-party-providers"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          10. Third-Party Service Providers
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We may employ third party companies and individuals to facilitate our
          Service (&quot;Service Providers&quot;), to provide the Service on our
          behalf, to perform Service-related services or to assist us in
          analyzing how our Service is used. These third parties have access to
          your Personal Data only to perform these tasks on our behalf and are
          obligated not to disclose or use it for any other purpose.
        </p>
        <div className="bg-accent/30 border border-border/50 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold mb-3 text-foreground">
            Key Service Providers:
          </h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="leading-relaxed">
              <strong className="text-foreground">Supabase</strong>: Provides
              database services, authentication, and real-time features. Your
              encrypted data and authentication information are stored here.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">
                OAuth Providers (Gmail, GitHub)
              </strong>
              : Used for optional account linking and multi-provider
              authentication. We receive your email and profile ID for identity
              verification only.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Upstash Redis</strong>: Used
              for high-performance caching of permissions and temporary data
              storage to improve application performance.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Vercel Analytics</strong>:
              Collects anonymous usage analytics to help us improve the user
              experience (optional and can be disabled).
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">
                Email Service Providers
              </strong>
              : Used for sending transactional emails like password resets and
              notifications, with your email address processed securely.
            </li>
          </ul>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          All third-party providers are selected for their strong security
          practices and compliance with data protection regulations. We
          regularly review our service providers to ensure they meet our
          security and privacy standards.
        </p>
      </section>

      <section
        id="data-retention"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          11. Data Retention
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We will retain your Personal Data only for as long as is necessary for
          the purposes set out in this Privacy Policy. We will retain and use
          your Personal Data to the extent necessary to comply with our legal
          obligations (for example, if we are required to retain your data to
          comply with applicable laws), resolve disputes, and enforce our legal
          agreements and policies.
        </p>
        <div className="bg-accent/30 border border-border/50 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold mb-3 text-foreground">
            Retention Periods by Data Type:
          </h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="leading-relaxed">
              <strong className="text-foreground">Account Data</strong>:
              Retained for the duration of your account. Deleted within 30 days
              of account deletion, except where required for legal compliance.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Encrypted Secrets</strong>:
              Retained until you delete them or terminate your account. Backup
              copies may be retained for up to 90 days for disaster recovery.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Authentication Logs</strong>:
              Security-related logs retained for 1 year for audit and security
              purposes.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">CLI Usage Analytics</strong>:
              Anonymous analytics data retained for 2 years to improve service
              quality.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Notification History</strong>:
              Retained for 6 months, or until you delete your account.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Team Activity Logs</strong>:
              Project-related activity logs retained for 1 year for audit
              purposes.
            </li>
          </ul>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          You can request deletion of your data at any time by contacting us.
          Some data may be retained longer if required by law or for legitimate
          business purposes.
        </p>
      </section>

      <section
        id="your-rights"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          12. Your Data Rights
        </h2>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Depending on your location, you may have the following rights
          regarding your personal data:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>
            The right to access, update or to delete the information we have on
            you.
          </li>
          <li>The right of rectification.</li>
          <li>The right to object.</li>
          <li>The right of restriction.</li>
          <li>The right to data portability.</li>
          <li>The right to withdraw consent.</li>
        </ul>
      </section>

      <section
        id="policy-changes"
        className="scroll-mt-28 mb-12 pb-8 border-b border-border/30"
      >
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          13. Changes to This Privacy Policy
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update our Privacy Policy from time to time. We will notify you
          of any changes by posting the new Privacy Policy on this page. We will
          let you know via email and/or a prominent notice on our Service, prior
          to the change becoming effective and update the &quot;effective
          date&quot; at the top of this Privacy Policy. You are advised to
          review this Privacy Policy periodically for any changes. Changes to
          this Privacy Policy are effective when they are posted on this page.
        </p>
      </section>

      <section id="contact" className="scroll-mt-28 mb-12">
        <h2 className="text-2xl font-semibold mb-4 font-serif">
          14. Contact Us
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have any questions about this privacy policy, please contact us
          at{" "}
          <a
            href="mailto:dashdinanath056@gmail.com"
            className="font-mono text-sm text-foreground hover:text-primary transition-colors underline underline-offset-4"
          >
            dashdinanath056@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
