"use client"

import Link from "next/link"
import { useEnvaultStore } from "@/lib/store"
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog"
import { ProjectCard } from "@/components/dashboard/project-card"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { ShieldCheck, User, Settings as SettingsIcon, LogOut } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
    const projects = useEnvaultStore((state) => state.projects)
    const { user, logout } = useEnvaultStore()
    const router = useRouter()

    const handleLogout = () => {
        logout()
        router.push("/")
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                        <span className="font-bold text-lg">Envault</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <AnimatedThemeToggler />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user?.firstName || "User"}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user?.email || "user@example.com"}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/settings" className="cursor-pointer flex w-full items-center">
                                        <SettingsIcon className="mr-2 h-4 w-4" />
                                        <span>Settings</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                        <p className="text-muted-foreground">Manage your environment variables securely.</p>
                    </div>
                    <CreateProjectDialog />
                </div>

                {projects.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl">
                        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No projects yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first project to get started.</p>
                        <div className="inline-block">
                            <CreateProjectDialog />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
