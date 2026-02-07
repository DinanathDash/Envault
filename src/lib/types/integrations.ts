// Integration types for project integrations

export type IntegrationProvider = 'github'

export interface ProjectIntegration {
    id: string
    project_id: string
    provider: IntegrationProvider
    owner: string
    repo_name: string
    repo_id?: string
    created_at: string
    created_by: string
}

export interface GitHubIntegration {
    owner: string
    repo_name: string
    repo_id?: string
}
