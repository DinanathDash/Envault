import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { Footer } from "@/components/landing/Footer"
import { Scene } from "@/components/landing/Scene"

export default function LandingPage() {
    return (
        <div className="flex min-h-screen flex-col font-sans selection:bg-primary/20 relative">
            <Scene />
            <Navbar />
            <main className="flex-1">
                <Hero />
                <div id="features">
                    <Features />
                </div>
            </main>
            <Footer />
        </div>
    )
}
