// Copyright (c) 2026 Dinanath (dinanath.dev). All rights reserved.
// Use is governed by the LICENSE file in the project root.

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthSync } from "@/components/auth/auth-sync";
import { AccountRevivalToastListener } from "@/components/auth/account-revival-toast-listener";
import { createClient } from "@/lib/supabase/server";
import { Analytics } from "@vercel/analytics/react";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { ShortcutProvider } from "@/components/providers/shortcut-provider";
import { HmacProvider } from "@/components/hmac-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getServerOS } from "@/lib/utils/os";
import { cn } from "@/lib/utils/utils";
import { headers } from "next/headers";
import { SystemStatusBanner } from "@/components/ui/system-status-banner";
import { GlobalScene } from "@/components/landing/ui/GlobalScene";
import { RootRefreshHandler } from "@/components/RootRefreshHandler";
import { FreeTierNotification } from "@/components/free-tier-notification";
import { HapticProvider } from "@/components/providers/haptics-provider";
import Script from "next/script";
import {
  JetBrains_Mono,
  Instrument_Serif,
  Google_Sans,
} from "next/font/google";

const googleSans = Google_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
  fallback: [
    "system-ui",
    "Segoe UI",
    "Roboto",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
  variable: "--font-google-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "Times", "serif"],
  variable: "--font-instrument-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "monospace",
  ],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.envault.tech"),
  title: {
    default: "Envault | Secure Environment Variable Storage & Secrets Manager",
    template: "%s | Envault",
  },
  description:
    "Envault is a secure vault for your environment variables featuring end-to-end encryption. Manage secrets with confidence using AES-256-GCM and simplify team collaboration for developers.",
  keywords: [
    "secrets management",
    ".env management",
    "env management",
    ".env storage",
    "env storage",
    ".env viewer",
    "env viewer",
    ".env editor",
    "env editor",
    ".env sync",
    "env sync",
    ".env sync",
    "env sync",
    "env vault",
    "envvault",
    "envault.tech",
    "env secure storage",
    "env secure vault",
    "environment variables",
    "secure vault",
    "end-to-end encryption",
    "developer CLI",
    "AES-256-GCM",
    "team collaboration security",
    "developer tools",
  ],
  authors: [{ name: "Envault Team" }],
  creator: "Envault",
  verification: {
    google: "3TJJp9KaT8xn84Rn-kxxru-6GnR20ZQQBiPhbtiS2vc",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Envault - Secure Environment Variables",
    description:
      "Manage your environment variables securely with Envault. End-to-end encryption for your peace of mind.",
    siteName: "Envault",
    images: [
      {
        url: "/open-graph/Landing%20OG.png",
        width: 1200,
        height: 630,
        alt: "Envault - Secure Environment Variables",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Envault - Secure Environment Variables",
    description: "Premium, secure vault for your environment variables.",
    creator: "@envault",
    images: ["/open-graph/Landing%20OG.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
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

  const os = await getServerOS();
  const headersList = await headers();
  const showBanner = headersList.get("x-show-status-banner") === "1";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-os={os}
      className={cn(
        jetbrainsMono.variable,
        instrumentSerif.variable,
        googleSans.variable,
      )}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <SystemStatusBanner show={showBanner} />
        <Script
          id="envault-jsonld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Envault",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Any",
              description:
                "Envault is a secure vault for your environment variables featuring end-to-end encryption.",
              featureList:
                "Secure Secret Storage, End-to-End Encryption, Team Collaboration, CLI Integration, AES-256-GCM",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        <RootRefreshHandler />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <ShortcutProvider>
              <HmacProvider>
                <HapticProvider>
                  <GlobalScene />
                  {children}
                </HapticProvider>
                <Toaster />
                <AccountRevivalToastListener />
                <FreeTierNotification />
                {user && (
                  <>
                    <AuthSync user={user} />
                    <NotificationProvider />
                  </>
                )}
                <Analytics />
              </HmacProvider>
            </ShortcutProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
