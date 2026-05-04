import { Star, Quote } from "lucide-react";
import Image from "next/image";
import { AnimatedTestimonials } from "@/components/landing/animations/animated-testimonials";
import { FadeIn } from "@/components/landing/animations/FadeIn";
import { SlideUp } from "@/components/landing/animations/SlideUp";
const testimonials = [
  {
    name: "Karthik Iyer",
    role: "Lead Backend Engineer",
    company: "PayStream",
    content:
      "Used to rely on a shared 1Password vault for .env files. Absolute nightmare when someone left the company. Envault handles the rotation so I don't have to panic every time a junior dev quits. Does exactly what it says on the tin.",
    rating: 5,
  },
  {
    name: "Rohan Desai",
    role: "DevOps Lead",
    company: "FinStack",
    content:
      "Look, HashiCorp Vault is great, but managing it is a full-time job. Envault gave us exactly what we needed without the infrastructure headache. It took my team maybe 10 minutes to migrate. The CLI is solid and gets out of your way.",
    rating: 5,
  },
  {
    name: "Marcus Thorne",
    role: "Site Reliability Engineer",
    company: "Vantage",
    content:
      "We outgrew GitHub Secrets, and AWS Secrets Manager was too clunky for our frontend team. Envault sits in the middle and gets out of the way.",
    rating: 4,
  },
  {
    name: "Ananya Desai",
    role: "Freelance Full-Stack",
    company: "Self-employed",
    content:
      "Juggling 10 different client projects and keeping their env vars straight used to break my brain. Dropped Envault into my workflow last month. Now I just `envault run npm run dev` and it pulls the right keys. Simple, stupid, works.",
    rating: 5,
  },
  {
    name: "Vikram Singh",
    role: "Co-founder & CTO",
    company: "SynthAI",
    content:
      "If I catch one more dev pasting production database URIs into Slack, I'm going to lose it. Envault fixed our onboarding. New hires get access instantly, and we revoke it just as fast. It's infrastructure I don't have to build myself.",
    rating: 5,
  },
  {
    name: "Priya Sharma",
    role: "Backend Developer",
    company: "ZeptoNova",
    content:
      "I usually hate adding new tools to our stack, but Envault actually solves a real problem. Hooked it up to our microservices and it handles the secrets silently. Giving it 4 stars only because the web dashboard can be a bit sluggish sometimes.",
    rating: 4,
  },
  {
    name: "Tomáš Novák",
    role: "DevOps Engineer",
    company: "Shift",
    content:
      "Was skeptical about moving away from Doppler. Envault's UI is cleaner and their client-side decryption model actually checks out. We had a weird edge case with Docker Compose caching, but their support sorted it out in a day. Solid tool.",
    rating: 5,
  },
  {
    name: "Elena Rostova",
    role: "Platform Engineer",
    company: "MetricFlow",
    content:
      "Good tool. Beats writing custom bash scripts to sync vars across Vercel and our custom EC2 instances. The UI is a bit barebones right now, but the CLI does the heavy lifting anyway so I don't really care.",
    rating: 4,
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-muted/30 overflow-hidden relative z-20">
      <div className="container px-4 md:px-6">
        <SlideUp className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold mb-4">
            Teams Replacing `.env` Slack Threads
          </h2>
          <p className="text-lg font-mono text-muted-foreground max-w-2xl mx-auto">
            Direct feedback from developers using Envault in day-to-day shipping
            workflows
          </p>
        </SlideUp>

        {/* Static Grid for Mobile */}
        <div className="grid grid-cols-1 md:hidden gap-8">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <SlideUp
              key={index}
              delay={index * 0.15}
              className="bg-background border border-border/50 rounded-none p-6 relative min-h-[240px] flex flex-col"
            >
              <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
              <div className="flex-1">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                  &quot;{testimonial.content}&quot;
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Image
                  src={`https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(testimonial.name)}&backgroundColor=transparent`}
                  alt={testimonial.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-none"
                />
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </div>
            </SlideUp>
          ))}
        </div>

        {/* Scrolling Testimonials for Desktop (Client Component) */}
        <FadeIn delay={0.2}>
          <AnimatedTestimonials testimonials={testimonials} />
        </FadeIn>
      </div>
    </section>
  );
}
