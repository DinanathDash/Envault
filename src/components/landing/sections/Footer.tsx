"use client";

import Link from "next/link";
import { Github, Mail, Copyright } from "lucide-react";
import { StatusBadge } from "@/components/landing/ui/StatusBadge";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";

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

interface FooterProps {
  user?: User | null;
}

const FooterLink = ({
  href,
  className,
  children,
  pathname,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  pathname: string;
}) => {
  if (pathname === href) {
    return (
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={className}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
};

export function Footer({ user }: FooterProps) {
  const pathname = usePathname();

  return (
    <footer className="border-t bg-background/80 backdrop-blur-sm">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-serif font-bold tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
                Envault.
              </span>
            </div>
            <p className="font-mono text-sm text-muted-foreground mb-4 max-w-md">
              Secure environment variable management for modern development
              teams. Built with true client-side decryption.
            </p>
            <div className="flex gap-4">
              <Link
                href="https://github.com/dinanathdash/envault"
                target="_blank"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-5 h-5" />
              </Link>
              <Link
                href="https://x.com/envault_tech"
                target="_blank"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XLogo className="w-5 h-5" />
              </Link>
              <Link
                href="mailto:connect@envault.tech?subject=Inquiry%20for%20Envault"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-5 h-5" />
              </Link>
            </div>
            <div className="mt-8">
              <StatusBadge />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <FooterLink
                  href="/docs/platform"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Documentation
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/features"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Features
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/changelog"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Changelog
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/support"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Support & FAQs
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href={user ? "/dashboard" : "/login"}
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  {user ? "Dashboard" : "Login"}
                </FooterLink>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Compare</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <FooterLink
                  href="/compare/envault-vs-doppler"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Envault vs Doppler
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/compare/envault-vs-infisical"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Envault vs Infisical
                </FooterLink>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <FooterLink
                  href="/licensing"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Licensing
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/privacy"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Privacy Policy
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/terms"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  Terms of Service
                </FooterLink>
              </li>
              <li>
                <FooterLink
                  href="/eula"
                  className="hover:text-foreground transition-colors"
                  pathname={pathname}
                >
                  EULA
                </FooterLink>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Built for Developers by{" "}
            <a
              href="https://github.com/dinanathdash"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Dinanath
            </a>{" "}
            &amp;{" "}
            <a
              href="https://github.com/RawJat"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Rajat
            </a>
            . Source-available on{" "}
            <a
              href="https://github.com/dinanathdash/envault"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <Copyright className="w-4 h-4" /> {new Date().getFullYear()}{" "}
            Envault. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
