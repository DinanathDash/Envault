"use client"

import { useState, useEffect } from "react"
import { useEnvaultStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { User, HelpCircle, Trash2, LogOut, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
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
import { createClient } from "@/lib/supabase/client"
import { deleteAccountAction, signInWithGoogle, signInWithGithub } from "@/app/actions"

export default function SettingsView() {
    const router = useRouter()
    const { user, updateUser, deleteAccount, logout, projects } = useEnvaultStore()

    // State for navigation
    const [activeTab, setActiveTab] = useState("profile")

    // State for form fields
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState("")
    const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false)

    // Initialize state from user store
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "")
            setLastName(user.lastName || "")
            setUsername(user.username || "")
            setEmail(user.email || "")
        }
    }, [user])

    const handleUpdateProfile = async () => {
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({
            data: {
                first_name: firstName,
                last_name: lastName,
                username,
                full_name: `${firstName} ${lastName}`.trim()
            }
        })

        if (error) {
            toast.error("Failed to update profile")
            return
        }

        updateUser({
            firstName,
            lastName,
            username
        })
        toast.success("Profile updated successfully")
    }

    const handleDeleteAccountClick = () => {
        setDeleteConfirmation("")
        setIsDeleteConfirmed(false)
        setDeleteDialogOpen(true)
    }

    const handleDeleteAccountConfirm = async () => {
        const result = await deleteAccountAction()
        if (result?.error) {
            toast.error(result.error)
            setDeleteDialogOpen(false)
            return
        }
        deleteAccount() // Clear local store
        toast.success("Account deleted")
        setDeleteDialogOpen(false)
    }

    const handleLogout = () => {
        logout()
        router.push("/")
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                            <ArrowLeft style={{ width: '24px', height: '24px' }} />
                        </Button>
                        <h1 className="text-xl font-semibold">Settings</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <AnimatedThemeToggler />
                        <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                <div className="flex flex-col md:flex-row gap-8">
                    <aside className="w-full md:w-64 space-y-2">
                        <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1">
                            <Button
                                variant={activeTab === "profile" ? "secondary" : "ghost"}
                                className="justify-start w-full"
                                onClick={() => setActiveTab("profile")}
                            >
                                <User className="mr-2 h-4 w-4" />
                                Profile
                            </Button>
                            <Button
                                variant={activeTab === "support" ? "secondary" : "ghost"}
                                className="justify-start w-full"
                                onClick={() => setActiveTab("support")}
                            >
                                <HelpCircle className="mr-2 h-4 w-4" />
                                Support
                            </Button>
                            <Button
                                variant={activeTab === "danger" ? "secondary" : "ghost"}
                                className="justify-start w-full text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-destructive/10"
                                onClick={() => setActiveTab("danger")}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Account
                            </Button>
                        </nav>
                    </aside>

                    <div className="flex-1 max-w-2xl">
                        {activeTab === "profile" && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-lg font-medium">Profile information</h2>
                                </div>

                                <Card>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid gap-2">
                                            <Label htmlFor="firstName">First name</Label>
                                            <Input
                                                id="firstName"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                className="bg-background"
                                                suppressHydrationWarning
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="lastName">Last name</Label>
                                            <Input
                                                id="lastName"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                className="bg-background"
                                                suppressHydrationWarning
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <div className="flex justify-between">
                                                <Label htmlFor="email">Primary email</Label>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                Primary email is used for account notifications.
                                            </p>
                                            <div className="relative">
                                                <Input
                                                    id="email"
                                                    value={email}
                                                    disabled
                                                    className="bg-muted pr-10"
                                                    suppressHydrationWarning
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3 border rounded-md mt-4 bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white dark:bg-muted p-1.5 rounded-full border shadow-sm flex items-center justify-center h-8 w-8">
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                        </svg>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <Label className="text-sm font-medium">Google</Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {user?.authProviders?.includes('google') ? "Connected to Google" : "Not connected"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={user?.authProviders?.includes('google')}
                                                    disabled={user?.authProviders?.includes('google')}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) signInWithGoogle()
                                                    }}
                                                    aria-label="Toggle Google connection"
                                                    className="data-[state=checked]:bg-green-500"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3 border rounded-md mt-4 bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white dark:bg-muted p-1.5 rounded-full border shadow-sm flex items-center justify-center h-8 w-8">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                                        </svg>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <Label className="text-sm font-medium">GitHub</Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {user?.authProviders?.includes('github') ? "Connected to GitHub" : "Not connected"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={user?.authProviders?.includes('github')}
                                                    disabled={user?.authProviders?.includes('github')}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) signInWithGithub()
                                                    }}
                                                    aria-label="Toggle GitHub connection"
                                                    className="data-[state=checked]:bg-green-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="username">Username</Label>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                Username appears as a display name throughout the dashboard.
                                            </p>
                                            <Input
                                                id="username"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="bg-background"
                                                suppressHydrationWarning
                                            />
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button
                                                onClick={handleUpdateProfile}
                                                className="px-8"
                                                disabled={
                                                    firstName === (user?.firstName || "") &&
                                                    lastName === (user?.lastName || "") &&
                                                    username === (user?.username || "")
                                                }
                                            >
                                                Save Changes
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "support" && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-lg font-medium">Support</h2>
                                </div>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Help & Support</CardTitle>
                                        <CardDescription>Get help with Envault</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            If you need assistance, please contact our support team.
                                        </p>
                                        <div className="flex items-center space-x-2 text-sm">
                                            <span className="font-semibold">Email:</span>
                                            <a href="mailto:dashdinanath056@gmail.com" className="text-blue-500 hover:underline">dashdinanath056@gmail.com</a>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "danger" && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-lg font-medium text-red-600 dark:text-red-500">Danger Zone</h2>
                                </div>
                                <Card className="border-destructive/20">
                                    <CardHeader>
                                        <CardTitle className="text-red-600 dark:text-red-500">Delete Account</CardTitle>
                                        <CardDescription>Permanently remove your account and all data.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            This action is irreversible. All your projects, environment variables, and personal data will be permanently deleted.
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button variant="destructive" onClick={handleDeleteAccountClick}>Delete Account</Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete your account? This action cannot be undone and will permanently delete your account and all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4 space-y-4">
                        {projects.length > 0 && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md space-y-3">
                                <p className="text-sm font-medium text-destructive">
                                    You have {projects.length} active project{projects.length === 1 ? '' : 's'}.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Please consider migrating them before deletion. If you proceed, they will be permanently lost.
                                </p>
                                <div className="flex items-center space-x-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="confirm-delete-projects"
                                        checked={isDeleteConfirmed}
                                        onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive"
                                    />
                                    <label htmlFor="confirm-delete-projects" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        I understand that my projects will be permanently deleted.
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="delete-confirmation" className="text-sm font-normal">
                                To confirm, type <span className="font-bold">{user?.username || user?.email}</span> below:
                            </Label>
                            <Input
                                id="delete-confirmation"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder={user?.username || user?.email}
                                className="bg-background"
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccountConfirm}
                            disabled={
                                deleteConfirmation !== (user?.username || user?.email) ||
                                (projects.length > 0 && !isDeleteConfirmed)
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
