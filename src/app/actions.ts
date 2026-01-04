'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function signInWithGoogle() {
    const supabase = await createClient()
    const origin = (await headers()).get('origin')

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    })

    if (error) {
        console.error(error)
        redirect('/error')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInWithGithub() {
    const supabase = await createClient()
    const origin = (await headers()).get('origin')

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    })

    if (error) {
        console.error(error)
        redirect('/error')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInWithPassword(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect('/dashboard')
}

export async function signUp(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()
    const origin = (await headers()).get('origin')

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback?next=/auth/confirm`,
        },
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

export async function deleteAccountAction() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminSupabase = createAdminClient()

    // 1. Delete user's secrets
    const { error: secretsError } = await adminSupabase
        .from('secrets')
        .delete()
        .eq('user_id', user.id)

    if (secretsError) {
        console.error('Error deleting user secrets:', secretsError)
        return { error: 'Failed to clean up user data (secrets)' }
    }

    // 2. Delete user's projects
    const { error: projectsError } = await adminSupabase
        .from('projects')
        .delete()
        .eq('user_id', user.id)

    if (projectsError) {
        console.error('Error deleting user projects:', projectsError)
        return { error: 'Failed to clean up user data (projects)' }
    }

    // 3. Delete the user account
    const { error } = await adminSupabase.auth.admin.deleteUser(user.id)

    if (error) {
        console.error('Error deleting user:', error)
        return { error: error.message }
    }

    await supabase.auth.signOut()
    redirect('/?accountDeleted=true')
}

export async function forgotPassword(formData: FormData) {
    const email = formData.get('email') as string
    const supabase = await createClient()
    const origin = (await headers()).get('origin')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function updatePassword(formData: FormData) {
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
        password,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}
