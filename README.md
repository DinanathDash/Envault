# Envault

**Envault** is a secure, modern vault application built with Next.js, Supabase, and Tailwind CSS. It provides a robust authentication system and a sleek user interface for storing and managing sensitive information.

## Features

- **Secure Authentication**: Powered by Supabase Auth for robust user management.
- **Modern UI/UX**: Built with Tailwind CSS and Radix UI for a premium, accessible experience.
- **Responsive Design**: Fully responsive layout that works seamlessly on desktop and mobile.
- **Dark Mode Support**: Built-in support for light and dark themes.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **KV Store**: [Upstash Redis](https://upstash.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

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
    ```

4.  **Run the development server**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit a pull request and our code of conduct.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
