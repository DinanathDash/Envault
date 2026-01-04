import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type EnvironmentVariable = {
    id: string
    key: string
    value: string
    isSecret: boolean
}

export type Project = {
    id: string
    name: string
    variables: EnvironmentVariable[]
    createdAt: string
}

interface EnvaultState {
    projects: Project[]
    user: User | null
    login: (user: User) => void
    logout: () => void
    updateUser: (updates: Partial<User>) => void
    setProjects: (projects: Project[]) => void
    addProject: (name: string) => string
    deleteProject: (id: string) => void
    addVariable: (projectId: string, variable: Omit<EnvironmentVariable, 'id'>) => void
    deleteVariable: (projectId: string, variableId: string) => void
    updateVariable: (projectId: string, variableId: string, updates: Partial<EnvironmentVariable>) => void
    deleteAccount: () => void
}

export type User = {
    firstName: string
    lastName: string
    username: string
    email: string
    avatar?: string
    authProviders: string[]
}

export const useEnvaultStore = create<EnvaultState>()(
    (set) => ({
        projects: [],
        user: null,
        login: (user) => set({ user }),
        logout: () => set({ user: null }),
        updateUser: (updates) =>
            set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
            })),
        deleteAccount: () => set({ user: null, projects: [] }),
        setProjects: (projects) => set({ projects }),

        addProject: (name) => {
            const newProject: Project = {
                id: uuidv4(),
                name,
                variables: [],
                createdAt: new Date().toISOString(),
            }
            set((state) => ({
                projects: [...state.projects, newProject],
            }))
            return newProject.id
        },
        deleteProject: (id) =>
            set((state) => ({
                projects: state.projects.filter((p) => p.id !== id),
            })),
        addVariable: (projectId, variable) =>
            set((state) => ({
                projects: state.projects.map((p) =>
                    p.id === projectId
                        ? {
                            ...p,
                            variables: [
                                ...p.variables,
                                { ...variable, id: uuidv4() },
                            ],
                        }
                        : p
                ),
            })),
        deleteVariable: (projectId, variableId) =>
            set((state) => ({
                projects: state.projects.map((p) =>
                    p.id === projectId
                        ? {
                            ...p,
                            variables: p.variables.filter((v) => v.id !== variableId),
                        }
                        : p
                ),
            })),
        updateVariable: (projectId, variableId, updates) =>
            set((state) => ({
                projects: state.projects.map((p) =>
                    p.id === projectId
                        ? {
                            ...p,
                            variables: p.variables.map((v) =>
                                v.id === variableId ? { ...v, ...updates } : v
                            ),
                        }
                        : p
                ),
            })),
    })
)
