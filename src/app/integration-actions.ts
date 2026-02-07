'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkReauthRequired } from '@/lib/auth-check'
import type { ProjectIntegration, GitHubIntegration } from '@/lib/types/integrations'

/**
 * Link a project to a GitHub repository
 */
export async function linkProjectToGitHub(
    projectId: string,
    integration: GitHubIntegration
): Promise<{ data?: ProjectIntegration; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Check if user is project owner
    const { data: project } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()

    if (!project) {
        return { error: 'Project not found' }
    }

    if (project.user_id !== user.id) {
        return { error: 'Only project owners can link GitHub repositories' }
    }

    // Validate input
    if (!integration.owner || !integration.repo_name) {
        return { error: 'Owner and repository name are required' }
    }

    // Check for reauth requirement
    if (await checkReauthRequired(supabase)) {
        return { error: 'REAUTH_REQUIRED' }
    }

    // Insert the integration
    const { data, error } = await supabase
        .from('project_integrations')
        .insert({
            project_id: projectId,
            provider: 'github',
            owner: integration.owner,
            repo_name: integration.repo_name,
            repo_id: integration.repo_id,
            created_by: user.id,
        })
        .select()
        .single()

    if (error) {
        console.error('Error linking GitHub repository:', error)
        // Handle unique constraint violation
        if (error.code === '23505') {
            if (error.message.includes('unique_github_repo')) {
                return { error: 'This GitHub repository is already linked to another project' }
            }
            return { error: 'This project is already linked to a GitHub repository' }
        }
        return { error: error.message }
    }

    revalidatePath(`/project/${projectId}`)
    return { data }
}

/**
 * Unlink a project from GitHub
 */
export async function unlinkProjectFromGitHub(
    projectId: string
): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Check if user is project owner
    const { data: project } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()

    if (!project) {
        return { error: 'Project not found' }
    }

    if (project.user_id !== user.id) {
        return { error: 'Only project owners can unlink GitHub repositories' }
    }

    // Check for reauth requirement
    if (await checkReauthRequired(supabase)) {
        return { error: 'REAUTH_REQUIRED' }
    }

    // Delete the integration
    const { error } = await supabase
        .from('project_integrations')
        .delete()
        .eq('project_id', projectId)
        .eq('provider', 'github')

    if (error) {
        console.error('Error unlinking GitHub repository:', error)
        return { error: error.message }
    }

    revalidatePath(`/project/${projectId}`)
    return { success: true }
}

/**
 * Get the GitHub integration for a project
 */
export async function getProjectIntegration(
    projectId: string
): Promise<{ data?: ProjectIntegration; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Query the integration - RLS will handle access control
    const { data, error } = await supabase
        .from('project_integrations')
        .select('*')
        .eq('project_id', projectId)
        .eq('provider', 'github')
        .single()

    if (error) {
        // Not found is not really an error
        if (error.code === 'PGRST116') {
            return { data: undefined }
        }
        console.error('Error fetching integration:', error)
        return { error: error.message }
    }

    return { data }
}
