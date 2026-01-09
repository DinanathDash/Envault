import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthSync } from "@/components/auth/auth-sync";
import { createClient } from "@/lib/supabase/server";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://envault-zero.vercel.app"),
  title: {
    default: "Envault - Secure Environment Variables",
    template: "%s | Envault",
  },
  description: "Envault is a premium, secure vault for your environment variables. Share and manage secrets with confidence using end-to-end encryption.",
  keywords: ["environment variables", "security", "secrets management", "developer tools", "encryption"],
  authors: [{ name: "Envault Team" }],
  creator: "Envault",
  verification: {
    google: "3TJJp9KaT8xn84Rn-kxxru-6GnR20ZQQBiPhbtiS2vc",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://envault-zero.vercel.app",
    title: "Envault - Secure Environment Variables",
    description: "Manage your environment variables securely with Envault. End-to-end encryption for your peace of mind.",
    siteName: "Envault",
  },
  twitter: {
    card: "summary_large_image",
    title: "Envault - Secure Environment Variables",
    description: "Premium, secure vault for your environment variables.",
    creator: "@envault",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          {user && <AuthSync user={user} />}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
