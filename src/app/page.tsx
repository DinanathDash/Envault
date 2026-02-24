import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { CliSection } from "@/components/landing/CliSection";
import { Footer } from "@/components/landing/Footer";
import { RegMark } from "@/components/landing/RegMark";
import { Testimonials } from "@/components/landing/Testimonials";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative blueprint-grid sharp">
      {/* <Preloader /> */}
      <Navbar user={user} />
      <main className="flex-1 relative">
        <RegMark position="top-left" />
        <RegMark position="top-right" />
        <Hero />
        <WorkflowSection />
        <CliSection />
        <Features />
        <Testimonials />
        <RegMark position="bottom-left" />
        <RegMark position="bottom-right" />
      </main>
      <Footer />
    </div>
  );
}
