"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Folder, MoreVertical, Trash2 } from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Card,
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Project, useEnvaultStore } from "@/lib/store"
import { toast } from "sonner"
import { deleteProject as deleteProjectAction } from "@/app/project-actions"

interface ProjectCardProps {
    project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
    const deleteProject = useEnvaultStore((state) => state.deleteProject)
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const router = useRouter()

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        const result = await deleteProjectAction(project.id)
        if (result.error) {
            toast.error(result.error)
            return
        }
        deleteProject(project.id)
        toast.success("Project deleted")
        setDeleteDialogOpen(false)
        router.refresh()
    }

    return (
        <>
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
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteClick}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
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

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{project.name}"? This will permanently delete all environment variables in this project.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
