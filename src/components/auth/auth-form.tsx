"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion } from "framer-motion"
import { Loader2, Lock } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { useEnvaultStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { signInWithGoogle, signInWithGithub, signInWithPassword, signUp } from "@/app/actions"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

const authSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
})

type AuthValues = z.infer<typeof authSchema>

export function AuthForm() {
    const [isLoading, setIsLoading] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState("login")
    const router = useRouter()
    const login = useEnvaultStore((state) => state.login)
    const searchParams = useSearchParams()

    React.useEffect(() => {
        if (searchParams.get("accountDeleted")) {
            setTimeout(() => {
                toast.success("Account deleted successfully")
                // Clean up the URL
                router.replace("/")
            }, 100)
        }
        if (searchParams.get("emailConfirmed")) {
            setTimeout(() => {
                toast.success("Email confirmed! You can now sign in.")
                // Clean up the URL
                router.replace("/")
            }, 100)
        }
    }, [searchParams, router])

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<AuthValues>({
        resolver: zodResolver(authSchema),
    })

    async function onLogin(data: AuthValues) {
        setIsLoading(true)
        const formData = new FormData()
        formData.append("email", data.email)
        formData.append("password", data.password)

        const result = await signInWithPassword(formData)

        if (result?.error) {
            toast.error(result.error)
            setIsLoading(false)
        }
    }

    async function onSignup(data: AuthValues) {
        setIsLoading(true)
        const formData = new FormData()
        formData.append("email", data.email)
        formData.append("password", data.password)

        const result = await signUp(formData)

        if (result?.error) {
            toast.error(result.error)
            setIsLoading(false)
        } else {
            toast.success("Check your email to confirm your account")
            setIsLoading(false)
            setActiveTab("login")
        }
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="w-full max-w-md mx-auto">
                <div>
                    <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold tracking-tight text-center">
                                Welcome back
                            </CardTitle>
                            <CardDescription className="text-center">
                                Enter your credentials to access your vault
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="login">Login</TabsTrigger>
                                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                                </TabsList>

                                <form action={signInWithGoogle} className="mb-2">
                                    <Button variant="outline" type="submit" className="w-full">
                                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                        </svg>
                                        Sign in with Google
                                    </Button>
                                </form>
                                <form action={signInWithGithub} className="mb-4">
                                    <Button variant="outline" type="submit" className="w-full">
                                        <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
                                        </svg>
                                        Sign in with GitHub
                                    </Button>
                                </form>

                                <div className="relative mb-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            OR
                                        </span>
                                    </div>
                                </div>

                                <TabsContent value="login">
                                    <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                suppressHydrationWarning
                                                id="email"
                                                placeholder="name@example.com"
                                                type="email"
                                                {...register("email")}
                                            />
                                            {errors.email && (
                                                <p className="text-xs text-destructive">{errors.email.message}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password</Label>
                                            <PasswordInput
                                                suppressHydrationWarning
                                                id="password"
                                                placeholder="••••••••"
                                                {...register("password")}
                                            />
                                            {errors.password && (
                                                <p className="text-xs text-destructive">
                                                    {errors.password.message}
                                                </p>
                                            )}
                                            <div className="flex justify-end mt-1">
                                                <Link
                                                    href="/forgot-password"
                                                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                                >
                                                    Forgot password?
                                                </Link>
                                            </div>
                                        </div>
                                        <Button className="w-full" type="submit" disabled={isLoading}>
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Sign In
                                        </Button>
                                    </form>
                                </TabsContent>

                                <TabsContent value="signup">
                                    <form onSubmit={handleSubmit(onSignup)} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-email">Email</Label>
                                            <Input
                                                suppressHydrationWarning
                                                id="signup-email"
                                                placeholder="name@example.com"
                                                type="email"
                                                {...register("email")}
                                            />
                                            {errors.email && (
                                                <p className="text-xs text-destructive">{errors.email.message}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-password">Password</Label>
                                            <PasswordInput
                                                suppressHydrationWarning
                                                id="signup-password"
                                                placeholder="••••••••"
                                                {...register("password")}
                                            />
                                            {errors.password && (
                                                <p className="text-xs text-destructive">
                                                    {errors.password.message}
                                                </p>
                                            )}
                                        </div>
                                        <Button className="w-full" type="submit" disabled={isLoading}>
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Account
                                        </Button>
                                    </form>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                        <CardFooter className="justify-center text-xs text-muted-foreground">
                            <Lock className="w-3 h-3 mr-1" />
                            End-to-end encrypted environment
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    )
}
