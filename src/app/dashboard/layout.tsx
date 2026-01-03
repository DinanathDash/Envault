import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthSync } from '@/components/auth/auth-sync'
import { ProjectsSync } from '@/components/dashboard/projects-sync'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    return (
        <>
            <AuthSync user={user} />
            <ProjectsSync />
            {children}
        </>
    )
}
