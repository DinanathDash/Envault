'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { forgotPassword } from '@/app/actions'

const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const router = useRouter()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordValues>({
        resolver: zodResolver(forgotPasswordSchema),
    })

    async function onSubmit(data: ForgotPasswordValues) {
        setIsLoading(true)
        const formData = new FormData()
        formData.append('email', data.email)

        const result = await forgotPassword(formData)

        if (result?.error) {
            toast.error(result.error)
            setIsLoading(false)
        } else {
            setIsSubmitted(true)
            toast.success('Reset email sent')
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md p-4">
            <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-center">
                        Reset Password
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isSubmitted
                            ? "Check your email for the reset link"
                            : "Enter your email to receive reset instructions"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSubmitted ? (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                We have sent a password reset link to your email address.
                                Please check your inbox and click the link to reset your password.
                            </p>
                            <Button asChild className="w-full" variant="outline">
                                <Link href="/login">
                                    Return to Login
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    suppressHydrationWarning
                                    id="email"
                                    placeholder="name@example.com"
                                    type="email"
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p className="text-xs text-destructive">{errors.email.message}</p>
                                )}
                            </div>
                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Reset Instructions
                            </Button>
                        </form>
                    )}
                </CardContent>
                {!isSubmitted && (
                    <CardFooter className="justify-center">
                        <Link
                            href="/login"
                            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </Link>
                    </CardFooter>
                )}
            </Card>
        </div>
    )
}
