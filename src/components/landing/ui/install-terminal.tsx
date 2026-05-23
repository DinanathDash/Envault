"use client";

import { CodeBlockCommand } from "@/components/code-block-command";

// --- ENVAULT INSTALLER WRAPPER ---
export function EnvaultInstaller() {
  return (
    <div className="w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 rounded-none shadow-sm overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 font-mono text-xs flex items-center justify-between border-b border-zinc-800 dark:border-zinc-200">
        <span className="font-bold tracking-tight">[UNIVERSAL INSTALLER]</span>
        <div className="text-zinc-500 dark:text-zinc-400 text-[10px] font-semibold">ENVAULT CLI</div>
      </div>
      <CodeBlockCommand
        script="curl -fsSL https://raw.githubusercontent.com/DinanathDash/Envault/main/install.sh | sh"
        brew="brew tap DinanathDash/envault && brew install --formula envault"
        npm="npm install -g envault"
      />
    </div>
  );
}

export default EnvaultInstaller;
