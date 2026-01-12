import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { ForgotPasswordForm } from './forgot-password-form'

export default async function ForgotPasswordPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        redirect('/dashboard')
    }

    return (
        <AuthLayout>
            <ForgotPasswordForm />
        </AuthLayout>
    )
}
