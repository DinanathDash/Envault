import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectDetailView from '@/components/editor/project-detail-view'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: PageProps) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    // Fetch the specific project with its secrets
    const { data: project, error } = await supabase
        .from('projects')
        .select(`
            *,
            secrets (*)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error || !project) {
        redirect('/dashboard')
    }

    // Transform to match local store format and decrypt values
    const { decrypt } = await import('@/lib/encryption')

    // Helper function to check if a value looks like encrypted data (base64)
    const isEncrypted = (value: string): boolean => {
        // Encrypted values are base64 strings with a minimum length
        // Base64 pattern: only contains A-Z, a-z, 0-9, +, /, and = for padding
        const base64Pattern = /^[A-Za-z0-9+/]+=*$/
        return value.length > 40 && base64Pattern.test(value)
    }

    const transformedProject = {
        id: project.id,
        name: project.name,
        createdAt: project.created_at,
        variables: project.secrets?.map((secret: any) => {
            let decryptedValue = secret.value

            // Only try to decrypt if it looks like encrypted data
            if (isEncrypted(secret.value)) {
                try {
                    decryptedValue = decrypt(secret.value)
                } catch (error) {
                    // If decryption fails, log error and keep original value
                    console.error(`Failed to decrypt value for key: ${secret.key}`, error)
                }
            }

            return {
                id: secret.id,
                key: secret.key,
                value: decryptedValue,
                isSecret: secret.is_secret,
            }
        }) || [],
    }

    return <ProjectDetailView project={transformedProject} />
}
