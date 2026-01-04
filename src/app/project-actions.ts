'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProject(name: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: user.id,
            name,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating project:', error)
        return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { data }
}

export async function getProjects() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { data, error } = await supabase
        .from('projects')
        .select(`
      *,
      secrets(count)
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching projects:', error)
        return { error: error.message }
    }

    return { data }
}

export async function deleteProject(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

export async function addVariable(projectId: string, key: string, value: string, isSecret: boolean = true) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Import encryption utility
    const { encrypt } = await import('@/lib/encryption')

    // Encrypt the value before storing
    const encryptedValue = encrypt(value)

    const { data, error } = await supabase
        .from('secrets')
        .insert({
            user_id: user.id,
            project_id: projectId,
            key,
            value: encryptedValue,
            is_secret: isSecret,
        })
        .select()
        .single()

    if (error) {
        console.error('Error adding variable:', error)
        return { error: error.message }
    }

    revalidatePath(`/project/${projectId}`)
    return { data }
}

export async function updateVariable(id: string, projectId: string, updates: { key?: string; value?: string; is_secret?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // If updating the value, encrypt it first
    let finalUpdates = { ...updates }
    if (updates.value) {
        const { encrypt } = await import('@/lib/encryption')
        finalUpdates.value = await encrypt(updates.value)
    }

    const { error } = await supabase
        .from('secrets')
        .update(finalUpdates)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath(`/project/${projectId}`)
    return { success: true }
}

export async function deleteVariable(id: string, projectId: string) {
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

    revalidatePath(`/project/${projectId}`)
    return { success: true }
}

export interface BulkImportVariable {
    key: string
    value: string
    isSecret: boolean
}

export interface BulkImportResult {
    added: number
    updated: number
    skipped: number
    error?: string
}

export async function addVariablesBulk(projectId: string, variables: BulkImportVariable[]): Promise<BulkImportResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { added: 0, updated: 0, skipped: 0, error: 'Not authenticated' }
    }

    // Import encryption utility
    const { encrypt, decrypt } = await import('@/lib/encryption')

    // Fetch existing variables for this project
    // Fetch existing variables for this project to map Keys to IDs (for Upsert)
    const { data: existingSecrets } = await supabase
        .from('secrets')
        .select('id, key')
        .eq('project_id', projectId)
        .eq('user_id', user.id)

    const keyToIdMap = new Map(
        (existingSecrets || []).map(s => [s.key, s.id])
    )

    const upsertPayload = []
    let added = 0
    let updated = 0
    let skipped = 0 // Concept of "skipped" is harder in batch upsert unless we check values. 
    // For massive bulk, we usually just overwrite (update).
    // If we want to strictly skip unchanged, we'd need to decrypt and compare.
    // Given the goal is "Scalability", skipping the decryption/comparison is faster.
    // We will just overwrite everything.

    // Pre-process and encrypt parallelly (Promise.all) if massive? 
    // For JS single-thread, map is fine.

    // We need to async helper for encryption if it was async? 
    // In `encryption.ts`, `encrypt` IS async (returns Promise<string>).
    // So we need Promise.all.

    const processVariable = async (variable: BulkImportVariable) => {
        const encryptedValue = await encrypt(variable.value)
        const existingId = keyToIdMap.get(variable.key)

        if (existingId) updated++
        else added++

        return {
            id: existingId, // If undefined, Supabase will treat as Insert (if no other unique constraint conflict)
            // WAIT: If we pass `undefined` ID, Supabase ignores it? Or fails?
            // Safest to NOT include `id` key if it's undefined.
            ...(existingId ? { id: existingId } : {}),
            user_id: user.id,
            project_id: projectId,
            key: variable.key,
            value: encryptedValue,
            is_secret: variable.isSecret
        }
    }

    const payload = await Promise.all(variables.map(processVariable))

    if (payload.length > 0) {
        const { error } = await supabase
            .from('secrets')
            .upsert(payload)

        if (error) {
            console.error('Bulk upsert error:', error)
            return { added: 0, updated: 0, skipped: 0, error: error.message }
        }
    }

    revalidatePath(`/project/${projectId}`)
    return { added, updated, skipped }
}

