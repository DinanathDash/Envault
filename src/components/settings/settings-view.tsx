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

export default function SettingsView() {
    const router = useRouter()
    const { user, updateUser, deleteAccount, logout } = useEnvaultStore()

    // State for navigation
    const [activeTab, setActiveTab] = useState("profile")

    // State for form fields
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    // Initialize state from user store
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "")
            setLastName(user.lastName || "")
            setUsername(user.username || "")
            setEmail(user.email || "")
        }
    }, [user])

    const handleUpdateProfile = () => {
        updateUser({
            firstName,
            lastName,
            username
        })
        toast.success("Profile updated successfully")
    }

    const handleDeleteAccountClick = () => {
        setDeleteDialogOpen(true)
    }

    const handleDeleteAccountConfirm = () => {
        deleteAccount()
        toast.error("Account deleted")
        setDeleteDialogOpen(false)
        router.push("/")
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
                            <LogOut className="w-5 h-5 text-muted-foreground" />
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
                                className="justify-start w-full text-destructive hover:text-destructive hover:bg-destructive/10"
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
                                                            {user?.authProvider === 'google' ? "Connected to Google" : "Not connected"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={user?.authProvider === 'google'}
                                                    disabled
                                                    aria-label="Toggle Google connection"
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
                                            <Button onClick={handleUpdateProfile} className="px-8">
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
                                    <h2 className="text-lg font-medium text-destructive">Danger Zone</h2>
                                </div>
                                <Card className="border-destructive/20">
                                    <CardHeader>
                                        <CardTitle className="text-destructive">Delete Account</CardTitle>
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
                            Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your projects and environment variables.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccountConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
