"use client"

import Link from "next/link"
import { ShieldCheck, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export function Navbar() {
    const { scrollY } = useScroll()
    const [scrolled, setScrolled] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    useMotionValueEvent(scrollY, "change", (latest) => {
        setScrolled(latest > 50)
    })

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => { document.body.style.overflow = "unset" }
    }, [isOpen])

    return (
        <motion.header
            className={cn(
                "fixed top-0 left-0 right-0 h-16 z-50 transition-all duration-300",
                scrolled || isOpen
                    ? "bg-background backdrop-blur-md border-b border-border/50"
                    : "bg-transparent"
            )}
        >
            <div className="container h-full flex items-center justify-between px-4 md:px-6 relative z-50">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl" onClick={() => setIsOpen(false)}>
                    <ShieldCheck className="w-6 h-6 text-amber-500" />
                    <span>Envault</span>
                </Link>

                <div className="flex items-center gap-4">
                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex gap-6 text-sm font-medium items-center">
                        <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            Features
                        </Link>
                        <Link href="https://github.com/dinanathdash/envault" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                            GitHub
                        </Link>
                        <Link href="/login">
                            <Button variant={scrolled ? "default" : "secondary"} size="sm" className="font-semibold">
                                Login
                            </Button>
                        </Link>
                    </nav>

                    <AnimatedThemeToggler className="hidden md:flex items-center justify-center" />

                    {/* Mobile Toggle */}
                    <div className="flex items-center gap-4 md:hidden">
                        <AnimatedThemeToggler />
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-foreground focus:outline-none relative w-6 h-6"
                            aria-label="Toggle menu"
                        >
                            <AnimatePresence mode="wait">
                                {isOpen ? (
                                    <motion.div
                                        key="close"
                                        initial={{ opacity: 0, rotate: -90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: 90 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute inset-0"
                                    >
                                        <X className="w-6 h-6" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="menu"
                                        initial={{ opacity: 0, rotate: 90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: -90 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute inset-0"
                                    >
                                        <Menu className="w-6 h-6" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed top-16 left-0 right-0 bottom-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex flex-col cursor-pointer"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            className="w-full bg-background border-b border-border/50 px-6 py-8 flex flex-col gap-8 shadow-xl cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <nav className="flex flex-col gap-6 text-lg font-medium">
                                <Link
                                    href="#features"
                                    className="text-muted-foreground hover:text-foreground transition-colors py-2 border-b border-muted/20"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setIsOpen(false)
                                        setTimeout(() => {
                                            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                                        }, 300)
                                    }}
                                >
                                    Features
                                </Link>
                                <Link
                                    href="https://github.com/dinanathdash/envault"
                                    target="_blank"
                                    className="text-muted-foreground hover:text-foreground transition-colors py-2 border-b border-muted/20"
                                    onClick={() => setIsOpen(false)}
                                >
                                    GitHub
                                </Link>
                            </nav>
                            <div className="flex flex-col gap-4">
                                <Link href="/login" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full" size="lg">
                                        Login
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header >
    )
}
