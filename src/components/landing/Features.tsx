"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Lock, Smartphone, Zap, Code, Globe } from "lucide-react"

const features = [
    {
        title: "End-to-End Encryption",
        description: "Your secrets are encrypted before they leave your device using AES-256-GCM encryption.",
        icon: Lock,
    },
    {
        title: "Secure Authentication",
        description: "Powered by Supabase Auth, ensuring industry-standard security for user management.",
        icon: Shield,
    },
    {
        title: "Modern Architecture",
        description: "Built with Next.js App Router and React Server Components for optimal performance.",
        icon: Zap,
    },
    {
        title: "Developer First",
        description: "Simple API and CLI (coming soon) to integrate secrets into your development workflow.",
        icon: Code,
    },
    {
        title: "Responsive Design",
        description: "Manage your environment variables from any device with our fully responsive UI.",
        icon: Smartphone,
    },
    {
        title: "Global Edge Network",
        description: "Low-latency access to your secrets from anywhere in the world.",
        icon: Globe,
    },
]

export function Features() {
    return (
        <section className="py-24 bg-background/50 relative overflow-hidden">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">
                        Why Choose Envault?
                    </h2>
                    <p className="max-w-[700px] mx-auto text-muted-foreground md:text-xl">
                        Built for developers who care about security and experience.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <Card key={index} className="bg-card/50 backdrop-blur-sm border-muted/20 hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <feature.icon className="w-10 h-10 text-primary mb-2" />
                                <CardTitle>{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    {feature.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}
