"use client";

import { motion, useInView } from "framer-motion";
import {
  Terminal,
  Clipboard,
  Check,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export function AnimatedTerminal() {
  const [copied, setCopied] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [authCode, setAuthCode] = useState("HZ4E-QSRZ");
  const [typedCommand, setTypedCommand] = useState("");
  const [step, setStep] = useState(0);

  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const fullCommand = "envault login";

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++)
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += "-";
    for (let i = 0; i < 4; i++)
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    setAuthCode(code);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isInView) return;

    let charIndex = 0;
    const startTimeout = setTimeout(() => {
      const typingInterval = setInterval(() => {
        if (charIndex < fullCommand.length) {
          setTypedCommand(fullCommand.slice(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          setTimeout(() => {
            setStep(1);
            setTimeout(() => setStep(2), 800);
            setTimeout(() => setStep(3), 1600);
            setTimeout(() => setStep(4), 2400);
            setTimeout(() => setStep(5), 3500);
          }, 400);
        }
      }, 50);
    }, 500);

    return () => clearTimeout(startTimeout);
  }, [isInView, fullCommand]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullCommand);
    toast.success("Command copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, rotateY: -10, scale: 0.9 }}
      whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      viewport={{ once: true }}
      className="relative perspective-1000"
    >
      <motion.div
        layout
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative rounded-none overflow-hidden bg-[#0c0c0c] border border-white/10 shadow-2xl z-30"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#18181b] border-b border-white/5">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 transition-colors shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 transition-colors shadow-sm" />
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-white/40">
            <Terminal className="w-4 h-4" />
            <span>zsh - 80 x 24</span>
          </div>
          <button
            onClick={copyToClipboard}
            className="text-white/40 hover:text-white transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Clipboard className="w-4 h-4" />
            )}
          </button>
        </div>

        <motion.div
          layout
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="p-6 font-mono text-sm leading-relaxed text-white/90"
        >
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <ChevronRight className="text-green-400 h-4 w-4" />
              <span className="text-blue-400">~</span>
              <span className="text-muted-foreground mr-1">$</span>
              <span>
                <span className="text-purple-400">
                  {typedCommand.split(" ")[0]}
                </span>{" "}
                {typedCommand.split(" ").slice(1).join(" ")}
                {step === 0 && (
                  <span
                    className={`w-2 h-4 bg-white/50 inline-block align-middle ml-1 ${cursorVisible ? "opacity-100" : "opacity-0"}`}
                  />
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
                <div className="overflow-x-auto w-full -ml-2 sm:ml-0 no-scrollbar">
                  <pre
                    className="text-[#22c55e] whitespace-pre text-[8px] sm:text-xs leading-none my-4 select-none opacity-100 font-mono pl-2 sm:pl-0"
                    style={{
                      fontFamily:
                        'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                  >
                    {`███████╗███╗   ██╗██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗\n██╔════╝████╗  ██║██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝\n█████╗  ██╔██╗ ██║██║   ██║███████║██║   ██║██║     ██║   \n██╔══╝  ██║╚██╗██║╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   \n███████╗██║ ╚████║ ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   \n╚══════╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   `}
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
                  <CheckCircle2 className="text-green-500 h-4 w-4" />
                  <span>Device code generated.</span>
                </div>
                <div className="py-2 text-blue-400">
                  Please visit:{" "}
                  <a
                    href="http://envault.tech/auth/device"
                    className="text-blue-400 hover:underline"
                  >
                    http://envault.tech/auth/device
                  </a>
                </div>
                <div className="py-1">
                  <div className="inline-block border border-[#22c55e] rounded-lg p-3 text-center min-w-[170px]">
                    <div className="text-[#22c55e] text-xs mb-1">
                      Authentication Code
                    </div>
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
                <CheckCircle2 className="h-4 w-4" />
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
                <ChevronRight className="text-green-400 h-4 w-4" />
                <span className="text-blue-400">~</span>
                <span className="text-muted-foreground mr-1">$</span>
                <span
                  className={`w-2 h-4 bg-white/50 inline-block ${cursorVisible ? "opacity-100" : "opacity-0"}`}
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
