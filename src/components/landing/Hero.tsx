"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShieldCheck, ArrowRight, Star } from "lucide-react"

export function Hero() {
    return (
        <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
            <div className="container relative z-10 px-4 md:px-6 grid md:grid-cols-2 gap-12 items-center">
                <div className="flex flex-col items-start text-left space-y-6 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="flex items-center space-x-2 bg-secondary/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-secondary"
                    >
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium">Bank-grade Encryption for your Environment Variables</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1]"
                    >
                        Secure Your{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500 animate-gradient">
                            Secrets
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed"
                    >
                        Envault provides a secure, encrypted vault for your development secrets.
                        Share and manage environment variables with confidence and ease.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
                    >
                        <Link href="/login">
                            <Button size="lg" className="w-full sm:w-auto min-w-[160px] h-12 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                                Get Started
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                        <Link href="https://github.com/dinanathdash/envault" target="_blank">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[160px] h-12 text-base backdrop-blur-sm bg-background/50">
                                <Star className="w-4 h-4 mr-2" />
                                Star on GitHub
                            </Button>
                        </Link>
                    </motion.div>
                </div>
                {/* Right column is empty, space reserved for 3D model */}
                <div className="hidden md:block"></div>
            </div>
        </section>
    )
}
