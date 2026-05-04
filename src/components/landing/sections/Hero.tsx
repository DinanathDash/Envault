import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Timer, ArrowRight, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallTerminal } from "@/components/landing/ui/install-terminal";
import { SlideUp } from "@/components/landing/animations/SlideUp";
export function Hero() {
  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden pt-24 pb-12">
      <div className="container relative z-20 px-4 md:px-6 grid md:grid-cols-2 gap-12 items-center">
        <SlideUp className="flex flex-col items-start text-left space-y-8 max-w-2xl">
          <div className="flex items-center space-x-3 bg-primary/5 backdrop-blur-sm px-5 py-2 rounded-none border border-primary/10">
            <Timer className="w-5 h-5 text-primary" />
            <span className="text-sm font-mono uppercase tracking-wider text-primary">
              NEW DEV IN 10 SECONDS
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-serif font-bold tracking-tight leading-[0.95] text-foreground">
            Envault.
            <span className="sr-only">
              Fast developer onboarding for environment variables
            </span>
          </h1>

          <p className="text-sm md:text-base lg:text-lg font-mono text-muted-foreground max-w-lg leading-relaxed border-l-2 border-primary/20 pl-4">
            STOP PASSING .ENV FILES AROUND.
            <br />
            RUN `ENVAULT LOGIN` THEN `ENVAULT PULL`.
            <br />
            ONBOARD NEW DEVS IN ABOUT 10 SECONDS.
          </p>

          {/* Tabbed Installation UI */}
          <div className="w-full max-w-sm md:max-w-lg">
            <Tabs defaultValue="script" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-background/50 backdrop-blur-sm border border-primary/20 rounded-none h-auto p-1">
                <TabsTrigger
                  value="script"
                  className="font-mono text-xs rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  SCRIPT
                </TabsTrigger>
                <TabsTrigger
                  value="brew"
                  className="font-mono text-xs rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  BREW
                </TabsTrigger>
                <TabsTrigger
                  value="npm"
                  className="font-mono text-xs rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  NPM
                </TabsTrigger>
              </TabsList>

              <TabsContent value="script" className="mt-0">
                <InstallTerminal
                  command="curl -fsSL https://raw.githubusercontent.com/DinanathDash/Envault/main/install.sh | sh"
                  label="Universal Installer"
                />
              </TabsContent>

              <TabsContent value="brew" className="mt-0">
                <InstallTerminal
                  command="brew tap DinanathDash/envault && brew install --formula envault"
                  label="Homebrew (Formula)"
                />
              </TabsContent>

              <TabsContent value="npm" className="mt-0">
                <InstallTerminal
                  command="npm install -g @dinanathdash/envault"
                  label="NPM"
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/login">
              <Button
                size="lg"
                className="w-full sm:w-auto min-w-[180px] h-12 text-base font-mono uppercase tracking-wider rounded-none flex items-center gap-2"
              >
                ACCESS VAULT
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/docs/platform">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-w-[180px] h-12 text-base font-mono uppercase tracking-wider rounded-none border-primary/20 hover:bg-primary/5 flex items-center gap-2"
              >
                DOCUMENTATION
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 mt-8">
            <div className="text-left">
              <p className="text-xs font-mono text-muted-foreground mb-1">
                DESIGN PARTNER PROGRAM
              </p>
              <p className="text-sm font-medium">
                FREE TIER FOR AGENCIES AND STARTUPS THAT WANT TO STRESS TEST
                ENVAULT.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Wrench className="w-4 h-4 text-primary" />
            <span>Break our CLI. Probe GitHub JIT. Try to bypass HITL.</span>
          </div>
        </SlideUp>
        {/* Right column reserved for 3D model */}
        <div className="hidden md:block"></div>
      </div>
    </section>
  );
}
