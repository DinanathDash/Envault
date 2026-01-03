"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion } from "framer-motion"
import { Loader2, Lock } from "lucide-react"
import { useRouter } from "next/navigation"

import { useEnvaultStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/app/actions"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
    const router = useRouter()
    const login = useEnvaultStore((state) => state.login)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<AuthValues>({
        resolver: zodResolver(authSchema),
    })

    async function onLogin(data: AuthValues) {
        setIsLoading(true)
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false)
            const namePart = data.email.split('@')[0]
            login({
                firstName: namePart,
                lastName: "",
                username: namePart,
                email: data.email,
                authProvider: 'email',
            })
            toast.success("Successfully authenticated!")
            router.push("/dashboard")
        }, 1500)
    }

    async function onSignup(data: AuthValues) {
        setIsLoading(true)
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false)
            const namePart = data.email.split('@')[0]
            login({
                firstName: namePart,
                lastName: "",
                username: namePart,
                email: data.email,
                authProvider: 'email',
            })
            toast.success("Account created successfully!")
            router.push("/settings")
        }, 1500)
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
                            <Tabs defaultValue="login" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="login">Login</TabsTrigger>
                                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                                </TabsList>

                                <form action={signInWithGoogle} className="mb-4">
                                    <Button variant="outline" type="submit" className="w-full">
                                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                        </svg>
                                        Sign in with Google
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
                                            <Input
                                                suppressHydrationWarning
                                                id="password"
                                                type="password"
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
                                            <Input
                                                suppressHydrationWarning
                                                id="signup-password"
                                                type="password"
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
