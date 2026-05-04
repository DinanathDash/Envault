import { Metadata } from "next";
import { featurePages } from "@/lib/data/seo-content";

export const metadata: Metadata = {
  title: "Features | Envault",
  description:
    "Developer-first secret workflows built for fast onboarding and clean terminal flows.",
};

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative blueprint-grid sharp">
      <main className="flex-1 relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight text-foreground mb-6">
            Features
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-mono">
            Fast terminal-first workflows for teams tired of manually sharing
            `.env` files.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-16">
          {featurePages.map((page, index) => (
            <div key={page.slug} id={page.slug} className="space-y-8 bg-background/50 backdrop-blur-sm border p-8 md:p-12 shadow-sm relative overflow-hidden rounded-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <span className="text-9xl font-bold">0{index + 1}</span>
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                  {page.h1}
                </h2>
                <p className="text-xl text-muted-foreground mb-12">
                  {page.metaDescription}
                </p>
                
                <div className="space-y-10">
                  {page.contentBlocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="space-y-3">
                      <h3 className="text-xl font-semibold text-foreground">
                        {block.heading}
                      </h3>
                      <p className="text-lg text-foreground/80 leading-relaxed">
                        {block.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
