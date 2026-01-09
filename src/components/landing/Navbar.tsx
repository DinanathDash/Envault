"use client"

import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function Navbar() {
    const { scrollY } = useScroll()
    const [scrolled, setScrolled] = useState(false)

    useMotionValueEvent(scrollY, "change", (latest) => {
        setScrolled(latest > 50)
    })

    return (
        <motion.header
            className={cn(
                "fixed top-0 left-0 right-0 h-16 z-50 transition-all duration-300",
                scrolled
                    ? "bg-background/80 backdrop-blur-md border-b border-border/50"
                    : "bg-transparent"
            )}
        >
            <div className="container h-full flex items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    <span>Envault</span>
                </Link>

                <div className="flex items-center gap-4">
                    <nav className="hidden md:flex gap-6 text-sm font-medium">
                        <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            Features
                        </Link>
                        <Link href="https://github.com/dinanathdash/envault" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                            GitHub
                        </Link>
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant={scrolled ? "default" : "secondary"} size="sm" className="font-semibold">
                                Login
                            </Button>
                        </Link>
                        <AnimatedThemeToggler />
                    </div>
                </div>
            </div>
        </motion.header>
    )
}
