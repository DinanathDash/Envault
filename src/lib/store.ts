import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from './encryption'

export type EnvironmentVariable = {
    id: string
    key: string
    value: string
    isSecret: boolean
}

export type Project = {
    id: string
    name: string
    description: string
    variables: EnvironmentVariable[]
    createdAt: string
}

interface EnvaultState {
    projects: Project[]
    user: User | null
    login: (user: User) => void
    logout: () => void
    updateUser: (updates: Partial<User>) => void
    addProject: (name: string, description: string) => string
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
    authProvider: 'email' | 'google'
}

export const useEnvaultStore = create<EnvaultState>()(
    persist(
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

            addProject: (name, description) => {
                const newProject: Project = {
                    id: uuidv4(),
                    name,
                    description,
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
        }),
        {
            name: 'envault-storage',
            storage: {
                getItem: (name: string) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    try {
                        const decrypted = decrypt(str);
                        if (!decrypted) return null;
                        return JSON.parse(decrypted);
                    } catch {
                        return null;
                    }
                },
                setItem: (name: string, value: unknown) => {
                    const encrypted = encrypt(JSON.stringify(value));
                    localStorage.setItem(name, encrypted);
                },
                removeItem: (name: string) => localStorage.removeItem(name),
            },
        }
    )
)
