"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Plus, Upload } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EnvVarTable } from "@/components/editor/env-var-table"
import { VariableDialog } from "@/components/editor/variable-dialog"
import { ImportEnvDialog } from "@/components/editor/import-env-dialog"
import { Project } from "@/lib/store"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

interface ProjectDetailViewProps {
    project: Project
}

export default function ProjectDetailView({ project }: ProjectDetailViewProps) {
    const params = useParams()
    const projectId = params.id as string

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-background/95 backdrop-blur z-50">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft style={{ width: '24px', height: '24px' }} />
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
                    </div>
                    <div className="flex items-center gap-2">
                        <ImportEnvDialog
                            projectId={projectId}
                            existingVariables={project.variables}
                            trigger={
                                <Button variant="outline">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import .env
                                </Button>
                            }
                        />
                        <VariableDialog
                            projectId={projectId}
                            trigger={
                                <Button variant="secondary">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Variable
                                </Button>
                            }
                        />
                    </div>
                </div>

                <EnvVarTable projectId={projectId} variables={project.variables} />
            </main>
        </div>
    )
}
