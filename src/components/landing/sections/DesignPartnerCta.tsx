import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideUp } from "@/components/landing/animations/SlideUp";

export function DesignPartnerCta() {
  return (
    <section className="py-16 md:py-24 bg-bone dark:bg-void relative z-20">
      <div className="container px-4 md:px-6">
        <SlideUp className="border border-black/20 dark:border-white/20 bg-background/80 backdrop-blur-sm p-6 sm:p-10 md:p-12 max-w-5xl mx-auto">
          <div className="flex flex-col gap-6 items-center text-center">
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-primary">
                <FlaskConical className="h-3.5 w-3.5" />
                Design Partner Program
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
                Help us break Envault.
              </h2>
              <p className="font-mono text-sm sm:text-base uppercase tracking-wider text-muted-foreground leading-relaxed">
                WE ARE LOOKING FOR 5-10 FAST-MOVING DEV AGENCIES AND STARTUPS TO
                STRESS-TEST OUR CLI AND GITHUB JIT WORKFLOWS IN PRODUCTION. IN
                EXCHANGE, YOU GET ENVAULT FREE FOREVER.
              </p>
            </div>
            <Link href="/design-partners" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 rounded-none font-mono uppercase tracking-wider px-8"
              >
                Apply For Design Partner
                <ArrowRight className="h-4 w-4 -rotate-45" />
              </Button>
            </Link>
          </div>
        </SlideUp>
      </div>
    </section>
  );
}
