"use client"

import { motion, useInView } from "framer-motion"
import { Terminal, Clipboard, Check, GitBranch, Zap, Shield, ArrowRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { toast } from "sonner"

export function CliSection() {
    const [copied, setCopied] = useState(false)
    const [cursorVisible, setCursorVisible] = useState(true)
    const [version, setVersion] = useState("1.1.0") // Default fallback
    const [authCode, setAuthCode] = useState("HZ4E-QSRZ")

    // Animation states
    const [typedCommand, setTypedCommand] = useState("")
    const [step, setStep] = useState(0) // 0: initial, 1: typing done, 2: output start, 3: banner done, etc.
    const containerRef = useRef(null)
    const isInView = useInView(containerRef, { once: true, margin: "-100px" })

    const fullCommand = "envault login"

    useEffect(() => {
        // Blinking cursor
        const interval = setInterval(() => {
            setCursorVisible(v => !v)
        }, 500)

        // Generate random auth code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
        code += '-'
        for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
        setAuthCode(code)

        // Fetch latest version from internal API
        fetch('/api/cli-version')
            .then(res => res.json())
            .then(data => {
                if (data.version) {
                    setVersion(data.version)
                }
            })
            .catch(err => console.error("Failed to fetch CLI version:", err))

        return () => clearInterval(interval)
    }, [])

    // Typing sequence effect
    useEffect(() => {
        if (!isInView) return


        let charIndex = 0

        // Initial delay before typing starts
        const startTimeout = setTimeout(() => {
            const typingInterval = setInterval(() => {
                if (charIndex < fullCommand.length) {
                    setTypedCommand(fullCommand.slice(0, charIndex + 1))
                    charIndex++
                } else {
                    clearInterval(typingInterval)
                    // Typing finished, wait before showing output
                    setTimeout(() => {
                        setStep(1) // Command entered
                        setTimeout(() => setStep(2), 800) // Show Banner
                        setTimeout(() => setStep(3), 1600) // Show Device Flow msg
                        setTimeout(() => setStep(4), 2400) // Show Device Code
                        setTimeout(() => setStep(5), 3500) // Show Authenticated msg
                    }, 400)
                }
            }, 50) // Typing speed
        }, 500)

        return () => clearTimeout(startTimeout)
    }, [isInView])

    const copyToClipboard = () => {
        navigator.clipboard.writeText(fullCommand)
        toast.success("Command copied to clipboard")
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const workflowSteps = [
        {
            icon: GitBranch,
            title: "Workspace-Aware Context Switching",
            desc: "Switch between projects and environments seamlessly. The CLI remembers your context and prevents accidental cross-project operations.",
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            icon: Zap,
            title: "Smart Environment Selection",
            desc: "Default environment selection during `init` and automatic context-aware command execution. No more manual flag juggling.",
            color: "text-primary",
            bg: "bg-primary/10"
        },
        {
            icon: Shield,
            title: "Secure Device Flow",
            desc: "Authenticate securely via browser without handling long-lived tokens manually. Multi-environment aware authentication.",
            color: "text-green-500",
            bg: "bg-green-500/10"
        }
    ]

    return (
        <section className="py-16 md:py-32 relative z-20">
            <div className="container px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">

                    {/* Left Column: Content */}
                    <div className="space-y-4 order-2 lg:order-1">
                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 text-sm font-medium"
                            >
                                <Terminal className="w-4 h-4" />
                                <span>Command Line Interface</span>
                            </motion.div>

                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.1] text-void dark:text-bone">
                                Manage Environment Variables from your Terminal.
                            </h2>
                            <p className="max-w-lg font-mono text-sm uppercase tracking-wider text-void/60 dark:text-bone/60">
                                Experience the speed of command-line secret management. Push, pull, and sync your environment variables without leaving your workflow.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {workflowSteps.map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.15 }}
                                    viewport={{ once: true }}
                                    className="group flex items-start space-x-4 p-4 rounded-none bg-card/50 backdrop-blur-sm border border-muted/20 hover:border-primary/50 transition-colors shadow-sm"
                                >
                                    <div className={`mt-1 p-3 rounded-none ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg mb-1 text-void dark:text-bone">{item.title}</h3>
                                        <p className="text-void/70 dark:text-bone/70 leading-relaxed">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="pt-4 flex items-center gap-4">
                            <Link href="/docs/cli/reference">
                                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20 rounded-none">
                                    Read the Docs
                                    <ArrowRight className="w-4 h-4 -rotate-45" />
                                </Button>
                            </Link>
                            <div className="text-sm text-muted-foreground">
                                v{version} released
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Premium Terminal visualization */}
                    <div className="order-1 lg:order-2 perspective-1000">
                        <motion.div
                            ref={containerRef}
                            initial={{ opacity: 0, rotateY: -10, scale: 0.9 }}
                            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            viewport={{ once: true }}
                            className="relative"
                        >
                            {/* Solid background container to block 3D elements */}
                            <motion.div
                                layout
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="relative rounded-none overflow-hidden bg-[#0c0c0c] border border-white/10 shadow-2xl z-30"
                            >
                                {/* Terminal Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-[#18181b] border-b border-white/5">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors shadow-sm" />
                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 transition-colors shadow-sm" />
                                        <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 transition-colors shadow-sm" />
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs font-mono text-white/40">
                                        <Terminal className="w-4 h-4" />
                                        <span>zsh — 80 x 24</span>
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        className="text-white/40 hover:text-white transition-colors"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Terminal Content */}
                                <motion.div
                                    layout
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="p-6 font-mono text-sm leading-relaxed text-white/90"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-green-400">➜</span>
                                            <span className="text-blue-400">~</span>
                                            <span className="text-muted-foreground mr-1">$</span>
                                            <span>
                                                <span className="text-purple-400">{typedCommand.split(' ')[0]}</span> {typedCommand.split(' ').slice(1).join(' ')}
                                                {step === 0 && (
                                                    <span className={`w-2 h-4 bg-white/50 inline-block align-middle ml-1 ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
                                                )}
                                            </span>
                                        </div>

                                        {step >= 2 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="space-y-1"
                                            >
                                                {/* ASCII Art Banner */}
                                                <div className="overflow-x-auto w-full -ml-2 sm:ml-0 no-scrollbar">
                                                    <pre
                                                        className="text-[#22c55e] whitespace-pre text-[8px] sm:text-xs leading-none my-4 select-none opacity-100 font-mono pl-2 sm:pl-0"
                                                        style={{ fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                                                    >
                                                        {`███████╗███╗   ██╗██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
██╔════╝████╗  ██║██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
█████╗  ██╔██╗ ██║██║   ██║███████║██║   ██║██║     ██║   
██╔══╝  ██║╚██╗██║╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   
███████╗██║ ╚████║ ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   
╚══════╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   `}
                                                    </pre>
                                                </div>

                                                <div className="pb-1 text-[#a3a3a3]">
                                                    Secure Environment Variable Management
                                                </div>
                                            </motion.div>
                                        )}

                                        {step >= 3 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="py-1 text-blue-400 font-medium"
                                            >
                                                Starting Device Authentication Flow...
                                            </motion.div>
                                        )}

                                        {step >= 4 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="space-y-2"
                                            >
                                                <div className="flex items-center space-x-2 text-white/90">
                                                    <span className="text-green-500">✔</span>
                                                    <span>Device code generated.</span>
                                                </div>

                                                <div className="py-2 text-blue-400">
                                                    Please visit: <a href="http://envault.tech/auth/device" className="text-blue-400 hover:underline">http://envault.tech/auth/device</a>
                                                </div>

                                                <div className="py-1">
                                                    <div className="inline-block border border-[#22c55e] rounded-lg p-3 text-center min-w-[170px]">
                                                        <div className="text-[#22c55e] text-xs mb-1">Authentication Code</div>
                                                        <div className="text-[#22c55e] text-xl font-bold tracking-widest">
                                                            {authCode}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-[#737373] text-xs">
                                                    (Code copied to clipboard)
                                                </div>
                                            </motion.div>
                                        )}

                                        {step >= 5 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="flex items-center space-x-2 mt-2 text-green-400"
                                            >
                                                <span>✔</span>
                                                <span>Successfully authenticated as dinanath@envault.tech</span>
                                            </motion.div>
                                        )}

                                        {step >= 5 && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.4, delay: 0.2 }}
                                                className="flex items-center space-x-2 pt-2"
                                            >
                                                <span className="text-green-400">➜</span>
                                                <span className="text-blue-400">~</span>
                                                <span className="text-muted-foreground mr-1">$</span>
                                                <span className={`w-2 h-4 bg-white/50 inline-block ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </div >
        </section >
    )
}
