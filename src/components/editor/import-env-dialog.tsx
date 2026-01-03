"use client"

import * as React from "react"
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parseEnvContent, ParsedVariable, ParseError } from "@/lib/env-parser"
import { addVariablesBulk, BulkImportVariable } from "@/app/project-actions"
import { useRouter } from "next/navigation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { EnvironmentVariable } from "@/lib/store"

interface ImportEnvDialogProps {
    projectId: string
    existingVariables: EnvironmentVariable[]
    trigger?: React.ReactNode
}

export function ImportEnvDialog({ projectId, existingVariables, trigger }: ImportEnvDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState("upload")
    const [pastedContent, setPastedContent] = React.useState("")
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
    const [parsedVariables, setParsedVariables] = React.useState<ParsedVariable[]>([])
    const [parseErrors, setParseErrors] = React.useState<ParseError[]>([])
    const [isImporting, setIsImporting] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const router = useRouter()

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setSelectedFile(file)
        const content = await file.text()
        parseContent(content)
    }

    const handlePasteChange = (content: string) => {
        setPastedContent(content)
        if (content.trim()) {
            parseContent(content)
        } else {
            setParsedVariables([])
            setParseErrors([])
        }
    }

    const parseContent = (content: string) => {
        const result = parseEnvContent(content)
        setParsedVariables(result.variables)
        setParseErrors(result.errors)
    }

    const getImportStats = () => {
        const existingKeys = new Set(existingVariables.map(v => v.key))
        let willAdd = 0
        let willUpdate = 0
        let willSkip = 0

        parsedVariables.forEach(v => {
            const existing = existingVariables.find(ev => ev.key === v.key)
            if (existing) {
                if (existing.value !== v.value) {
                    willUpdate++
                } else {
                    willSkip++
                }
            } else {
                willAdd++
            }
        })

        return { willAdd, willUpdate, willSkip }
    }

    const handleImport = async () => {
        if (parsedVariables.length === 0) {
            toast.error("No variables to import")
            return
        }

        setIsImporting(true)

        try {
            const variables: BulkImportVariable[] = parsedVariables.map(v => ({
                key: v.key,
                value: v.value,
                isSecret: v.isSecret,
            }))

            const result = await addVariablesBulk(projectId, variables)

            if (result.error) {
                toast.error(result.error)
            } else {
                const messages = []
                if (result.added > 0) messages.push(`${result.added} added`)
                if (result.updated > 0) messages.push(`${result.updated} updated`)
                if (result.skipped > 0) messages.push(`${result.skipped} skipped`)

                toast.success(`Import complete: ${messages.join(', ')}`)
                setOpen(false)
                resetDialog()
                router.refresh()
            }
        } catch (error) {
            console.error('Import error:', error)
            toast.error("Failed to import variables")
        } finally {
            setIsImporting(false)
        }
    }

    const resetDialog = () => {
        setPastedContent("")
        setSelectedFile(null)
        setParsedVariables([])
        setParseErrors([])
        setActiveTab("upload")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            resetDialog()
        }
    }

    const stats = getImportStats()
    const hasContent = parsedVariables.length > 0 || parseErrors.length > 0

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-b">
                <div className="px-6 pt-6">
                    <DialogHeader>
                        <DialogTitle>Import Environment Variables</DialogTitle>
                        <DialogDescription>
                            Upload a .env file or paste its content to import variables.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upload">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload File
                            </TabsTrigger>
                            <TabsTrigger value="paste">
                                <FileText className="w-4 h-4 mr-2" />
                                Paste Content
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="file-upload">Select .env file</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={fileInputRef}
                                        id="file-upload"
                                        type="file"
                                        accept=".env,.env.local,.env.example,.env.production,.env.development,text/plain"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        {selectedFile ? selectedFile.name : "Choose file"}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="paste" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="paste-content">Paste .env content</Label>
                                <Textarea
                                    id="paste-content"
                                    placeholder="DATABASE_URL=postgres://...&#10;API_KEY=your-api-key&#10;SECRET_TOKEN=secret"
                                    value={pastedContent}
                                    onChange={(e) => handlePasteChange(e.target.value)}
                                    className="font-mono text-sm min-h-[150px] max-h-[250px] custom-scrollbar"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    {hasContent && (
                        <div className="space-y-4 mt-4">
                            {/* Stats Summary */}
                            <div className="grid grid-cols-3 gap-2">
                                {stats.willAdd > 0 && (
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-sm font-medium">{stats.willAdd} New</span>
                                    </div>
                                )}
                                {stats.willUpdate > 0 && (
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        <Info className="w-4 h-4" />
                                        <span className="text-sm font-medium">{stats.willUpdate} Updated</span>
                                    </div>
                                )}
                                {stats.willSkip > 0 && (
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-gray-500/10 text-gray-600 dark:text-gray-400">
                                        <Info className="w-4 h-4" />
                                        <span className="text-sm font-medium">{stats.willSkip} Skipped</span>
                                    </div>
                                )}
                            </div>

                            {/* Parse Errors */}
                            {parseErrors.length > 0 && (
                                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-destructive">
                                                {parseErrors.length} invalid line{parseErrors.length > 1 ? 's' : ''}
                                            </p>
                                            <div className="mt-2 space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                                                {parseErrors.map((err, idx) => (
                                                    <p key={idx} className="text-xs text-muted-foreground font-mono">
                                                        Line {err.line}: {err.error}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            {parsedVariables.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Preview ({parsedVariables.length} variable{parsedVariables.length > 1 ? 's' : ''})</Label>
                                    <div className="border rounded-md max-h-[250px] overflow-y-auto custom-scrollbar">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead className="w-[200px]">Key</TableHead>
                                                    <TableHead>Value</TableHead>
                                                    <TableHead className="w-[80px]">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {parsedVariables.map((variable, idx) => {
                                                    const existing = existingVariables.find(v => v.key === variable.key)
                                                    const status = existing
                                                        ? existing.value === variable.value
                                                            ? 'Skip'
                                                            : 'Update'
                                                        : 'New'

                                                    return (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-mono text-sm font-medium">
                                                                {variable.key}
                                                            </TableCell>
                                                            <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-[300px]">
                                                                {variable.isSecret ? '••••••••' : variable.value}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`text-xs px-2 py-1 rounded-full ${status === 'New'
                                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                                    : status === 'Update'
                                                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                                                                    }`}>
                                                                    {status}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 pb-4 pt-4 border-t bg-background">
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={parsedVariables.length === 0 || isImporting}
                        >
                            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Import
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
