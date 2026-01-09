import { ShieldCheck } from "lucide-react"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { HeroIllustration } from "@/components/landing/hero-illustration"
import Link from "next/link"

interface AuthLayoutProps {
    children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden font-sans">
            <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            {/* Theme Toggler */}
            <div className="absolute top-4 right-4 z-50">
                <AnimatedThemeToggler />
            </div>

            {/* Logo Area - Absolute positioned for consistent visibility */}
            <Link href="/" className="absolute top-8 left-8 z-50 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <ShieldCheck className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold tracking-tight text-primary">Envault</h1>
            </Link>

            {/* LEFT COLUMN: Visuals / Brand */}
            <div className="hidden lg:flex flex-col justify-center p-8 lg:p-12 relative overflow-hidden text-muted-foreground pointer-events-none">
                {/* Illustration Area */}
                <div className="z-10 flex flex-col items-center justify-center relative">
                    <HeroIllustration />
                    <p className="mt-8 text-lg font-medium text-center max-w-sm text-foreground/80">
                        Securely manage your environment variables with end-to-end encryption.
                    </p>
                </div>
            </div>

            {/* RIGHT COLUMN: Auth Form */}
            <div className="flex flex-col items-center justify-center p-8 lg:p-24 relative">
                {children}
            </div>
        </main>
    )
}
