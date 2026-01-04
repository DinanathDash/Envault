'use client'

import { useEffect } from 'react'
import { useEnvaultStore } from '@/lib/store'
import { User } from '@supabase/supabase-js'

export function AuthSync({ user }: { user: User }) {
    const login = useEnvaultStore((state) => state.login)

    useEffect(() => {
        if (user) {
            const meta = user.user_metadata || {}
            login({
                firstName: meta.first_name || meta.full_name?.split(' ')[0] || user.email?.split('@')[0] || '',
                lastName: meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || '',
                username: meta.username || user.email?.split('@')[0] || '',
                email: user.email!,
                avatar: meta.avatar_url,
                authProviders: user.identities?.map((id) => id.provider) || [],
            })
        }
    }, [user, login])

    return null
}
