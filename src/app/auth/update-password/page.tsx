import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { UpdatePasswordForm } from './update-password-form'

export default async function UpdatePasswordPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <AuthLayout>
            <UpdatePasswordForm />
        </AuthLayout>
    )
}
