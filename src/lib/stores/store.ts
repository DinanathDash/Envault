import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export type EnvironmentVariable = {
  id: string;
  key: string;
  value: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  isShared?: boolean;
  sharedAt?: string;
  userInfo?: {
    creator?: { email: string; id: string; avatar?: string; username?: string };
    updater?: { email: string; id: string; avatar?: string; username?: string };
  };
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  agent_access_enabled?: boolean | null;
  ui_mode?: "simple" | "advanced";
  default_environment_slug?: string;
  active_environment_slug?: string;
  github_repo_full_name?: string | null;
  environments?: Array<{
    id: string;
    slug: string;
    name: string;
    is_default?: boolean;
    can_access?: boolean;
  }>;
  owner_username?: string | null;
  variables: EnvironmentVariable[];
  secretCount: number;
  createdAt: string;
  role?: "owner" | "editor" | "viewer";
  isShared?: boolean;
};

interface EnvaultState {
  projects: Project[];
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (name: string) => string;
  deleteProject: (id: string) => void;
  addVariable: (
    projectId: string,
    variable: Omit<EnvironmentVariable, "id">,
  ) => void;
  deleteVariable: (projectId: string, variableId: string) => void;
  updateVariable: (
    projectId: string,
    variableId: string,
    updates: Partial<EnvironmentVariable>,
  ) => void;
  deleteAccount: () => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatar?: string;
  authProviders: string[];
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export const useEnvaultStore = create<EnvaultState>()((set, get) => ({
  projects: [],
  isLoading: true,
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
  deleteAccount: () => set({ user: null, projects: [] }),
  setProjects: (projects) => set({ projects, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),

  addProject: (name) => {
    const userId = get().user?.email || "local"; // Fallback for local
    const newProject: Project = {
      id: uuidv4(),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      user_id: userId,
      variables: [],
      secretCount: 0,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      projects: [...state.projects, newProject],
    }));
    return newProject.id;
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
              variables: [...p.variables, { ...variable, id: uuidv4() }],
              secretCount: (p.secretCount || 0) + 1,
            }
          : p,
      ),
    })),
  deleteVariable: (projectId, variableId) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              variables: p.variables.filter((v) => v.id !== variableId),
              secretCount: Math.max(0, (p.secretCount || 0) - 1),
            }
          : p,
      ),
    })),
  updateVariable: (projectId, variableId, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              variables: p.variables.map((v) =>
                v.id === variableId ? { ...v, ...updates } : v,
              ),
            }
          : p,
      ),
    })),
}));
