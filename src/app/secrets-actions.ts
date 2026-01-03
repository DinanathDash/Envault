'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveSecret(name: string, value: string, projectId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('secrets')
        .upsert({
            user_id: user.id,
            name,
            value,
            project_id: projectId,
        }, {
            onConflict: 'user_id,name'
        })

    if (error) {
        console.error('Error saving secret:', error)
        return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

export async function getSecrets(projectId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    let query = supabase
        .from('secrets')
        .select('*')
        .eq('user_id', user.id)

    if (projectId) {
        query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching secrets:', error)
        return { error: error.message }
    }

    return { data }
}

export async function deleteSecret(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('secrets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
}
