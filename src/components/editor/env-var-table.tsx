"use client"

import * as React from "react"
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { EnvironmentVariable, useEnvaultStore } from "@/lib/store"
import { VariableDialog } from "./variable-dialog"

interface EnvVarTableProps {
    projectId: string
    variables: EnvironmentVariable[]
}

export function EnvVarTable({ projectId, variables }: EnvVarTableProps) {
    const deleteVariable = useEnvaultStore((state) => state.deleteVariable)
    const [editingVariable, setEditingVariable] = React.useState<EnvironmentVariable | null>(null)

    // Local state for visibility toggles map: variableId -> boolean (true = visible)
    const [visibleSecrets, setVisibleSecrets] = React.useState<Record<string, boolean>>({})

    const toggleVisibility = (id: string) => {
        setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this variable?")) {
            deleteVariable(projectId, id)
            toast.success("Variable deleted")
        }
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Key</TableHead>
                            <TableHead className="min-w-[300px]">Value</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {variables.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    No variables added yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            variables.map((variable) => {
                                const isVisible = !variable.isSecret || visibleSecrets[variable.id];
                                return (
                                    <TableRow key={variable.id}>
                                        <TableCell className="font-mono font-medium">{variable.key}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-2 container-type-normal">
                                                <div className="font-mono text-sm break-all line-clamp-1 max-w-[400px]">
                                                    {isVisible ? variable.value : "•".repeat(Math.min(variable.value.length, 20) || 8)}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() =>
                                                        variable.isSecret ? toggleVisibility(variable.id) : copyToClipboard(variable.value)
                                                    }
                                                >
                                                    {variable.isSecret ? (
                                                        isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />
                                                    ) : (
                                                        // If not secret, just show copy button immediately?
                                                        // Design choice: keep consistent spacing.
                                                        // Actually, let's allow copying transparently.
                                                        null
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => copyToClipboard(variable.value)}
                                                    title="Copy Value"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => copyToClipboard(variable.key)}>
                                                        Copy Key
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => copyToClipboard(variable.value)}>
                                                        Copy Value
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setEditingVariable(variable)}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(variable.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <VariableDialog
                projectId={projectId}
                existingVariable={editingVariable || undefined}
                open={!!editingVariable}
                onOpenChange={(open) => !open && setEditingVariable(null)}
            />
        </>
    )
}
