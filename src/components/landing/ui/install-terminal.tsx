"use client";

import { CodeBlockCommand } from "@/components/code-block-command";

export function EnvaultInstaller() {
  return (
    <div className="w-full max-w-2xl border border-primary/20 bg-background/50 backdrop-blur-sm rounded-none shadow-sm overflow-hidden">
      <CodeBlockCommand
        script="curl -fsSL https://raw.githubusercontent.com/DinanathDash/Envault/main/install.sh | sh"
        brew="brew tap DinanathDash/envault && brew install --formula envault"
        npm="npm install -g envault"
      />
    </div>
  );
}

export default EnvaultInstaller;
