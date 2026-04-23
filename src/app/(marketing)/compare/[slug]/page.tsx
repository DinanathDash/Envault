import { Metadata } from "next";
import { notFound } from "next/navigation";
import { comparisonPages } from "@/lib/data/seo-content";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return comparisonPages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pageData = comparisonPages.find((p) => p.slug === slug);

  if (!pageData) {
    return {};
  }

  return {
    title: pageData.title,
    description: pageData.metaDescription,
  };
}

export default async function ComparePage({ params }: PageProps) {
  const { slug } = await params;
  const pageData = comparisonPages.find((p) => p.slug === slug);

  if (!pageData) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative blueprint-grid sharp">
      <main className="flex-1 relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-foreground mb-6">
            {pageData.h1}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-mono">
            {pageData.metaDescription}
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-12 bg-background/50 backdrop-blur-sm border p-8 md:p-12 shadow-sm rounded-2xl">
          {pageData.contentBlocks.map((block, index) => (
            <div key={index} className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                {block.heading}
              </h2>
              <p className="text-lg text-foreground/80 leading-relaxed">
                {block.content}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
