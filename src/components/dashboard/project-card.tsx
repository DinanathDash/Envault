"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Folder, MoreVertical, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Project, useEnvaultStore } from "@/lib/store"
import { toast } from "sonner"

interface ProjectCardProps {
    project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
    const deleteProject = useEnvaultStore((state) => state.deleteProject)

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this project?")) {
            deleteProject(project.id)
            toast.success("Project deleted")
        }
    }

    return (
        <Link href={`/project/${project.id}`} className="block h-full">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md group relative overflow-hidden">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <Folder className="w-5 h-5 text-primary" />
                            </div>
                            <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground" onClick={(e) => e.preventDefault()}>
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <CardDescription className="line-clamp-2 mt-2">
                        {project.description || "No description provided."}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="absolute bottom-0 w-full bg-muted/20 border-t p-3">
                    <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                        <span>{project.variables.length} variables</span>
                        <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                    </div>
                </CardFooter>
                <div className="h-12" /> {/* Spacer for footer */}
            </Card>
        </Link>
    )
}
