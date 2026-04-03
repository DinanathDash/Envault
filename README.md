# Envault

**Envault** is a secure, modern vault application built with Next.js, Supabase, and Tailwind CSS. It provides a robust authentication system and a sleek user interface for storing and managing sensitive information.

## Features

- **Bank-Grade Security**: AES-256-GCM encryption with master/data key hierarchy and automatic key rotation.
- **Project Workspaces**: Organize secrets into distinct projects for better management.
- **Semantic Routing**: Clean, GitHub-style URLs (`/[username]/[project-slug]`) for easy sharing and navigation.
- **Team Collaboration**: Secure project sharing with strict Role-Based Access Control:
  - _Owner_: Full administrative control (Rename, Delete, Manage Team).
  - _Editor_: Active contributor (Read/Write secrets, request to Share).
  - _Viewer_: Read-only access to variables.
- **Secure Authentication**: Powered by Supabase Auth for robust user management, including **Passkey** support for passwordless, biometric login.
- **Modern UI/UX**: Built with Tailwind CSS, Shadcn UI, and Framer Motion for a premium experience.
- **Interactive 3D Elements**: High-performance 3D visuals powered by React Three Fiber.
- **Keyboard First**: Navigate efficiently with fully customizable, conflict-free hotkeys.
- **Responsive Design**: Fully responsive layout that works seamlessly on desktop and mobile.
- **Dark Mode Support**: Built-in support for light and dark themes.
- **CLI Support**: Manage your secrets directly from your terminal, featuring automatic non-blocking background update checks.
- **Real-time System Status**: Monitor system health, active incidents, and historical uptime with a dedicated status page.
- **Dedicated Support Page**: Integrated support features directly within the app to help users manage troubleshooting options efficiently.
- **Comprehensive Documentation**: Integrated docs site with guides, API reference, and CLI documentation.

## CLI

Envault comes with a high-performance Go CLI to manage your secrets without leaving your terminal.

### Installation

**macOS & Linux (Universal)**

```bash
curl -fsSL https://raw.githubusercontent.com/DinanathDash/Envault/main/install.sh | sh
```

**macOS (Homebrew)**

```bash
brew tap DinanathDash/envault
brew install --formula envault
```

Homebrew cask installs are deprecated. If you installed via cask, migrate with:

```bash
brew uninstall --cask dinanathdash/envault/envault
brew install --formula envault
```

For more details, check out the [CLI Documentation](./cli-go/README.md).

### Local Testing

Envault local development now uses `portless` with HTTPS hostnames.

```bash
npm install -g portless
```

To use the Envault CLI with the local development server, set the `ENVAULT_CLI_URL` environment variable:

```bash
export ENVAULT_CLI_URL="https://envault.localhost/api/cli"
envault login
```

## Security Architecture

Envault uses a hybrid encryption model to ensure maximum security:

1.  **Master Key**: A 32-byte key stored in environment variables, used solely to encrypt/decrypt Data Keys.
2.  **Data Keys**: Unique keys for encrypting actual data. These are stored encrypted in the database.
3.  **Key Rotation**: Data keys can be rotated. The active key is cached in Redis for high performance without compromising security.
4.  **AES-256-GCM**: Industry-standard authenticated encryption for all secrets.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **KV Store**: [Upstash Redis](https://upstash.com/)
- **Documentation**: [Fumadocs](https://www.fumadocs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **3D & Graphics**: [React Three Fiber](https://r3f.docs.pmnd.rs/) / [Three.js](https://threejs.org/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
- **Analytics**: [Vercel Analytics](https://vercel.com/analytics)

## Getting Started

Follow these steps to get the project running locally.

### Prerequisites

- Node.js 18+ installed
- A Supabase project set up

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/dinanathdash/envault.git
    cd envault
    ```

2.  **Install dependencies**

    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    # or
    bun install
    ```

3.  **Environment Setup**

    Copy the example environment file:

    ```bash
    cp .env.example .env.local
    ```

    Open `.env.local` and add your Supabase credentials:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

    # Generate a secure key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ENCRYPTION_KEY=your-64-char-hex-key

    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

    UPSTASH_REDIS_REST_URL=your-upstash-url
    UPSTASH_REDIS_REST_TOKEN=your-upstash-token

    # Used for securely signing and verifying frontend API mutations (POST, PUT, DELETE, PATCH)
    NEXT_PUBLIC_API_SIGNATURE_SALT=your-secure-random-hmac-secret

    ```

4.  **Run the development server**

    ```bash
    npm run dev
    ```

    Open [https://envault.localhost:1355](https://envault.localhost:1355) with your browser to see the result.

5.  **Test Email Configuration (Optional)**

    To verify that your Resend API configuration is working, you can send a test email to yourself:

    ```bash
    npm run test:email -- your-email@example.com
    ```

## Monorepo Setup Map

This repository contains multiple publishable/runtime components. Use this map when cloning and contributing.

| Folder | Purpose | Install | Common Commands |
|---|---|---|---|
| `./` | Main Next.js app | `npm install` | `npm run dev`, `npm run build`, `npm run lint`, `npm run test:all` |
| `cli-go/` | Go CLI (`envault`) | `go mod download` | `go test ./...`, `go build ./...` |
| `src/lib/sdk/` | npm SDK package (`@dinanathdash/envault-sdk`) | `npm install` | `npm run typecheck`, `npm run build` |
| `mcp-server/` | npm MCP package (`@dinanathdash/envault-mcp-server`) | `npm install` | `npm run check`, `npm start` |
| `cli-wrapper/` | npm wrapper for CLI install/bootstrap | `npm install` | `node install.js` |

### First-time contributor flow

1. Clone and install root dependencies:

```bash
git clone https://github.com/dinanathdash/envault.git
cd envault
npm install
```

2. Copy env file and configure required keys:

```bash
cp .env.example .env.local
```

3. Install package-local dependencies for publishable subpackages:

```bash
cd src/lib/sdk && npm install
cd ../../.. && cd mcp-server && npm install
cd ..
```

4. Validate everything in one pass:

```bash
npm run lint
npm run test:all
npm run build
```

## Package Publishing + Workflows

### npm packages

- SDK: `@dinanathdash/envault-sdk` (source: `src/lib/sdk/`)
- MCP: `@dinanathdash/envault-mcp-server` (source: `mcp-server/`)

### GitHub Actions workflows

- CLI release workflow: `.github/workflows/publish.yml`
- SDK publish workflow: `.github/workflows/publish-sdk.yml`
- MCP publish workflow: `.github/workflows/publish-mcp.yml`

Each package versions independently via semantic-release when changes occur in its own folder:

- CLI tags: `v<version>`
- SDK tags: `sdk-v<version>`
- MCP tags: `mcp-v<version>`

This keeps SDK and MCP release streams decoupled from CLI version bumps.

### Local prepublish checks

```bash
npm run sdk:check
npm run mcp:check
```

### Manual publish commands

```bash
npm run sdk:publish
npm run mcp:publish
```

## Version and Update Commands

Use these commands so users can quickly verify what version they are on and update safely.

### CLI (`envault`)

Check installed CLI version:

```bash
envault --version
```

Update via Homebrew formula:

```bash
brew update
brew untap dinanathdash/envault || true
brew tap dinanathdash/envault
brew upgrade --formula envault
```

### SDK (`@dinanathdash/envault-sdk`)

Check installed and latest SDK versions:

```bash
npm ls @dinanathdash/envault-sdk
npm view @dinanathdash/envault-sdk version
```

Update SDK:

```bash
npm install @dinanathdash/envault-sdk@latest
```

Runtime behavior:
- SDK prints a warning when a newer SDK version exists.
- SDK blocks execution when below minimum supported version configured by server.

### MCP (`@dinanathdash/envault-mcp-server`)

Check installed MCP version:

```bash
npx -y @dinanathdash/envault-mcp-server --version
```

Check MCP update availability:

```bash
npx -y @dinanathdash/envault-mcp-server --check-update
```

Update MCP globally:

```bash
npm install -g @dinanathdash/envault-mcp-server@latest
```

## License

Envault is source-available under the Functional Source License (FSL). You are free to read the code, audit it for security, and self-host it for your own internal use. You are strictly prohibited from using this code to offer a competing commercial service. After 24 months, the license for specific versions automatically converts to the MIT License.

See the [LICENSE](LICENSE) file for the complete license text.
