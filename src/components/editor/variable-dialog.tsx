"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Plus, Save } from "lucide-react"

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

const variableSchema = z.object({
    key: z.string().min(1, "Key is required").regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric characters and underscores"),
    value: z.string().min(1, "Value is required"),
    isSecret: z.boolean(),
})

type VariableValues = z.infer<typeof variableSchema>

interface VariableDialogProps {
    projectId: string
    existingVariable?: EnvironmentVariable
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function VariableDialog({ projectId, existingVariable, trigger, open: controlledOpen, onOpenChange }: VariableDialogProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange! : setInternalOpen

    const addVariable = useEnvaultStore((state) => state.addVariable)
    const updateVariable = useEnvaultStore((state) => state.updateVariable)

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
            isSecret: existingVariable?.isSecret ?? true,
        },
    })

    // Update form if existingVariable changes
    React.useEffect(() => {
        if (existingVariable) {
            setValue("key", existingVariable.key)
            setValue("value", existingVariable.value)
            setValue("isSecret", existingVariable.isSecret)
        } else {
            reset({ key: "", value: "", isSecret: true })
        }
    }, [existingVariable, setValue, reset])

    async function onSubmit(data: VariableValues) {
        if (existingVariable) {
            updateVariable(projectId, existingVariable.id, data)
            toast.success("Variable updated")
        } else {
            addVariable(projectId, data)
            toast.success("Variable created")
        }
        setOpen(false)
        if (!existingVariable) reset()
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
                            type={watch("isSecret") ? "password" : "text"}
                            {...register("value")}
                            className="font-mono"
                        />
                        {errors.value && (
                            <p className="text-xs text-destructive">{errors.value.message}</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="is-secret"
                            checked={watch("isSecret")}
                            onCheckedChange={(checked) => setValue("isSecret", checked)}
                        />
                        <Label htmlFor="is-secret">Mask value in dashboard</Label>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {existingVariable ? "Save Changes" : "Add Variable"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
