import { createAdminClient } from '@/lib/supabase/admin'
import { validateCliToken } from '@/lib/cli-auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    // Validate CLI token and get user ID
    const result = await validateCliToken(request)
    if (typeof result !== 'string') {
        return result // Return the error response
    }
    const userId = result

    // Parse request body
    let body: { owner?: string; repo?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { owner, repo } = body

    // Validate required fields
    if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
        return NextResponse.json(
            { error: 'Both owner and repo are required as strings' },
            { status: 400 }
        )
    }

    const supabase = createAdminClient()

    // Query project_integrations for matching GitHub repository
    const { data: integration, error: integrationError } = await supabase
        .from('project_integrations')
        .select('projects(id, name, user_id)')
        .eq('provider', 'github')
        .eq('owner', owner)
        .eq('repo_name', repo)
        .single()

    if (integrationError || !integration) {
        // No matching integration found
        return NextResponse.json(
            { error: 'No project found for this repository' },
            { status: 404 }
        )
    }

    // Extract project data (handle potential array from join)
    const project = Array.isArray(integration.projects) 
        ? integration.projects[0] 
        : integration.projects

    if (!project) {
        return NextResponse.json(
            { error: 'Project not found' },
            { status: 404 }
        )
    }

    const projectId = project.id
    const projectOwnerId = project.user_id

    // Check if user has access to this project
    // User has access if they are:
    // 1. The project owner
    // 2. A project member
    // 3. Have access to shared secrets

    let hasAccess = false

    // Check if owner
    if (projectOwnerId === userId) {
        hasAccess = true
    }

    // Check if member
    if (!hasAccess) {
        const { data: member } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single()

        if (member) {
            hasAccess = true
        }
    }

    // Check if has access to shared secrets in this project
    if (!hasAccess) {
        const { data: secretShares } = await supabase
            .from('secret_shares')
            .select('id, secrets!inner(project_id)')
            .eq('user_id', userId)
            .eq('secrets.project_id', projectId)
            .limit(1)

        if (secretShares && secretShares.length > 0) {
            hasAccess = true
        }
    }

    if (!hasAccess) {
        return NextResponse.json(
            { error: 'You do not have access to this project' },
            { status: 403 }
        )
    }

    // Return project information
    return NextResponse.json({
        projectId: project.id,
        projectName: project.name,
    })
}
