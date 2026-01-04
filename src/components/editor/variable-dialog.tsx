"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Plus, Save, CheckCircle2, Info, AlertCircle } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EnvironmentVariable, useEnvaultStore } from "@/lib/store"
import { toast } from "sonner"
import { addVariable as addVariableAction, updateVariable as updateVariableAction } from "@/app/project-actions"
import { useRouter } from "next/navigation"

const variableSchema = z.object({
    key: z.string().min(1, "Key is required").regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric characters and underscores"),
    value: z.string().min(1, "Value is required"),
})

type VariableValues = z.infer<typeof variableSchema>

interface VariableDialogProps {
    projectId: string
    existingVariable?: EnvironmentVariable
    existingVariables?: EnvironmentVariable[]
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function VariableDialog({ projectId, existingVariable, existingVariables = [], trigger, open: controlledOpen, onOpenChange }: VariableDialogProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange! : setInternalOpen
    const router = useRouter()

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<VariableValues>({
        resolver: zodResolver(variableSchema),
        defaultValues: {
            key: existingVariable?.key || "",
            value: existingVariable?.value || "",
        },
    })

    const key = watch("key")
    const value = watch("value")

    const status = React.useMemo(() => {
        if (existingVariable || !key) return null

        const collision = existingVariables?.find(v => v.key === key)
        if (!collision) return { type: 'new', message: 'New Variable' }

        if (collision.value === value) {
            return { type: 'skip', message: 'Variable exists with same value' }
        }

        return { type: 'update', message: 'Variable exists (Will Update)' }
    }, [key, value, existingVariable, existingVariables])

    // Update form if existingVariable changes
    React.useEffect(() => {
        if (existingVariable) {
            setValue("key", existingVariable.key)
            setValue("value", existingVariable.value)
        } else {
            reset({ key: "", value: "" })
        }
    }, [existingVariable, setValue, reset])

    // Reset form when dialog closes
    React.useEffect(() => {
        if (!open) {
            reset({ key: "", value: "" })
        }
    }, [open, reset])

    async function onSubmit(data: VariableValues) {
        if (existingVariable) {
            const result = await updateVariableAction(existingVariable.id, projectId, {
                key: data.key,
                value: data.value,
                is_secret: true,
            })
            if (result.error) {
                toast.error(result.error)
                return
            }
            toast.success("Variable updated")
        } else {
            const collision = existingVariables?.find(v => v.key === data.key)

            if (collision) {
                // Upsert/Update existing
                const result = await updateVariableAction(collision.id, projectId, {
                    key: data.key,
                    value: data.value,
                    is_secret: true,
                })
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success("Variable updated")
            } else {
                // Create new
                const result = await addVariableAction(projectId, data.key, data.value, true)
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success("Variable created")
            }
        }
        setOpen(false)
        if (!existingVariable) reset()
        router.refresh()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{existingVariable ? "Edit Variable" : "Add Variable"}</DialogTitle>
                    <DialogDescription>
                        {existingVariable ? "Update the variable details." : "Add a new environment variable to this project."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="key">Key</Label>
                        <Input
                            id="key"
                            placeholder="DATABASE_URL"
                            {...register("key")}
                            className="font-mono uppercase"
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "");
                                setValue("key", val);
                            }}
                        />
                        {errors.key && (
                            <p className="text-xs text-destructive">{errors.key.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="value">Value</Label>
                        <Input
                            id="value"
                            placeholder="postgres://..."
                            type="password"
                            {...register("value")}
                            className="font-mono"
                        />
                        {errors.value && (
                            <p className="text-xs text-destructive">{errors.value.message}</p>
                        )}
                    </div>

                    {status && (
                        <div className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium ${status.type === 'new'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : status.type === 'update'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                            }`}>
                            {status.type === 'new' && <CheckCircle2 className="w-4 h-4" />}
                            {status.type === 'update' && <Info className="w-4 h-4" />}
                            {status.type === 'skip' && <AlertCircle className="w-4 h-4" />}
                            <span>{status.message}</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting || status?.type === 'skip'}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {existingVariable
                                ? "Save Changes"
                                : status?.type === 'update'
                                    ? "Update Variable"
                                    : status?.type === 'skip'
                                        ? "No Changes"
                                        : "Add Variable"
                            }
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
