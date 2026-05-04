export interface ContentBlock {
  heading: string;
  content: string;
}

export interface SeoPageData {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  contentBlocks: ContentBlock[];
}

export const comparisonPages: SeoPageData[] = [
  {
    slug: 'envault-vs-doppler',
    title: 'Envault vs Doppler | The Developer-First Secrets Manager',
    metaDescription: 'Compare Envault and Doppler. See why developers are switching to Envault for lightweight, secure environment variable management without enterprise bloat.',
    h1: 'Envault vs. Doppler: Skip the Enterprise Bloat',
    contentBlocks: [
      {
        heading: 'Built for Developers, Not Procurement Teams',
        content: 'Doppler forces you into complex project hierarchies and pricing models designed for massive enterprises, rapidly scaling up per-user costs. Envault is built strictly for the developer experience. We provide the exact CLI tooling and workflow automation your team needs, natively integrated into your current stack, without charging a premium for features you will never use.'
      },
      {
        heading: 'Zero-Knowledge Security vs Cloud Trust',
        content: 'Doppler operates as a centralized cloud service where you trust their infrastructure with your plaintext secrets. Envault uses envelope encryption with strict client-side decryption boundaries for secret payloads. Our servers never process plaintext environment variables.'
      },
      {
        heading: 'Native AI Agent Support',
        content: 'Envault ships native MCP support with a hybrid open-source execution layer. The cloud core is proprietary, but the MIT-licensed mcp-server/ and src/lib/sdk/ paths are fully auditable, including the HITL interceptor and short-lived envault_agt_ delegated JWT flow. Your team gets AI speed with verifiable human control.'
      },
      {
        heading: 'Lightweight and Blazing Fast',
        content: 'Envault does not demand massive operational overhead or cumbersome web dashboards for every action. Designed to run lean, it integrates directly into your terminal via our highly optimized Go CLI, ensuring secrets are injected at runtime without slowing down your local development cycle.'
      }
    ]
  },
  {
    slug: 'envault-vs-infisical',
    title: 'Envault vs Infisical | Seamless Next.js Secrets Management',
    metaDescription: 'Evaluate Envault against Infisical. Discover how Envault provides superior Vercel integration and AES-256-GCM encryption with strict client-side decryption boundaries.',
    h1: 'Envault vs. Infisical: Zero-Friction Secrets',
    contentBlocks: [
      {
        heading: 'Client-Side Encryption Architecture',
        content: 'Envault ensures your environment variables are encrypted at rest and in transit. AES-256-GCM encryption with strict client-side decryption boundaries keeps plaintext secret values out of server-side processing. With Infisical, complex self-hosting is often required to achieve true data sovereignty.'
      },
      {
        heading: 'Operational Simplicity over Self-Hosting Complexities',
        content: 'Infisical offers self-hosting which can quickly become a burden—demanding you maintain uptime, scale databases, patch security vulnerabilities, and manage backups. Envault provides the ultimate managed experience with end-to-end encryption, giving you the security of self-hosting without the massive operational overhead.'
      },
      {
        heading: 'Frictionless Vercel Syncing',
        content: 'Stop maintaining manual scripts to push secrets to your hosting provider. Envault connects directly to your Vercel projects. Map your Envault environments to your Vercel deployments and automatically sync secrets on every push, seamlessly integrating into your modern frontend workflows.'
      },
      {
        heading: 'Local Runtime Injection',
        content: 'Stop maintaining complex local .env files. Run your dev server wrapped in the Envault CLI to inject secrets directly into the runtime process securely and cleanly, ensuring your local environment always matches production without the risk of accidentally committing secrets to git.'
      }
    ]
  }
];

export const featurePages: SeoPageData[] = [
  {
    slug: 'environment-variable-storage',
    title: 'Secure Environment Variable Storage | Envault',
    metaDescription: 'Store, sync, and inject your environment variables securely across your entire team. AES-256-GCM encryption with client-side decryption.',
    h1: 'Secure Environment Variable Storage',
    contentBlocks: [
      {
        heading: 'Military-Grade Client-Side Encryption (CSE)',
        content: 'Stop sharing vulnerable .env files over Slack or email. Envault ensures your environment variables are encrypted at rest and in transit using AES-256-GCM with strict client-side decryption boundaries.'
      },
      {
        heading: 'Instant Cross-Team Synchronization',
        content: 'When a lead developer updates a staging database URL, the entire team receives the update instantly via the Envault CLI. Eliminate the hours wasted debugging "it works on my machine" issues caused by outdated local variables. Envault keeps everyone perfectly synced.'
      },
      {
        heading: 'Version History and Point-in-Time Recovery',
        content: 'Accidentally overwrote a critical production API key? Envault maintains a comprehensive version history of all your environment variables. Easily audit changes to see who modified what, and instantly rollback to previous states with a single click or CLI command.'
      }
    ]
  },
  {
    slug: 'team-secrets-management',
    title: 'Team Secrets Management | Envault',
    metaDescription: 'Manage team access to production secrets with granular access controls and seamless environment mapping.',
    h1: 'Bulletproof Team Secrets Management',
    contentBlocks: [
      {
        heading: 'Granular Role-Based Access Control (RBAC)',
        content: 'Not everyone needs access to production Stripe keys. Envault allows you to segment secrets by environment (Development, Staging, Production) and assign role-based access to specific team members, ensuring your team adheres strictly to the principle of least privilege.'
      },
      {
        heading: 'Secure Secret Sharing',
        content: 'Need to grant temporary access to a contractor or pass a database credential to a specific microservice? Envault allows you to securely route credentials without ever exposing your root environment variables to unauthorized personnel. Revoke access instantly when the job is done.'
      },
      {
        heading: 'Comprehensive Audit Logs',
        content: 'Maintain complete visibility over your organization\'s security posture. Envault logs every secret access, modification, and sync event. Track down precisely when a secret was rotated and by whom, satisfying complex compliance requirements with ease.'
      }
    ]
  },
  {
    slug: 'nextjs-secrets',
    title: 'Next.js Secrets Management | Envault',
    metaDescription: 'The most seamless way to manage environment variables for Next.js applications. Natively sync with Vercel and local development environments.',
    h1: 'The Ultimate Secrets Manager for Next.js',
    contentBlocks: [
      {
        heading: 'Native Vercel Integration',
        content: 'Envault connects directly to your Vercel projects via our secure OAuth integration. Map your Envault development, preview, and production environments directly to your Vercel deployments. Envault automatically syncs secrets on every push—never manually copy-paste a production key into the Vercel dashboard again.'
      },
      {
        heading: 'Local Runtime Injection for Next.js',
        content: 'Stop maintaining complex local .env files. Run your Next.js dev server wrapped in the Envault CLI to securely and cleanly inject secrets directly into the Node.js runtime process, perfectly matching your production environment without writing secrets to disk.'
      },
      {
        heading: 'Seamless Edge Compatibility',
        content: 'Modern Next.js applications run on the Edge. Envault\'s secrets are seamlessly injected into Vercel\'s infrastructure, ensuring your Edge functions and middleware have instantaneous access to the environment variables they need without latency penalties or cold boot delays.'
      }
    ]
  }
];
