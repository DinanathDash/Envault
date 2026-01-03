"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EnvVarTable } from "@/components/editor/env-var-table"
import { VariableDialog } from "@/components/editor/variable-dialog"
import { useEnvaultStore } from "@/lib/store"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export default function ProjectDetailView() {
    const params = useParams()
    const router = useRouter()
    const projectId = params.id as string

    const project = useEnvaultStore((state) =>
        state.projects.find((p) => p.id === projectId)
    )

    React.useEffect(() => {
        // Small timeout to allow hydration
        const timer = setTimeout(() => {
            if (!project) {
                // If checking fails after hydration
                // router.push("/dashboard") 
                // Note: Since we are using persist, it might take a ms. 
                // Better handling would be a loading state if we were async.
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [project, router])

    if (!project) {
        return <div className="p-8 text-center">Loading project...</div>
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-background/95 backdrop-blur z-50">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="font-bold text-lg">{project.name}</h1>
                            <span className="text-xs text-muted-foreground">Environment Variables</span>
                        </div>
                    </div>
                    <AnimatedThemeToggler />
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Variables ({project.variables.length})</h2>
                        <p className="text-muted-foreground">{project.description}</p>
                    </div>
                    <VariableDialog
                        projectId={projectId}
                        trigger={
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Variable
                            </Button>
                        }
                    />
                </div>

                <EnvVarTable projectId={projectId} variables={project.variables} />
            </main>
        </div>
    )
}
