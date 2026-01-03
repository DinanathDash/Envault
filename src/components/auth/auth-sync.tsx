'use client'

import { useEffect } from 'react'
import { useEnvaultStore } from '@/lib/store'
import { User } from '@supabase/supabase-js'

export function AuthSync({ user }: { user: User }) {
    const login = useEnvaultStore((state) => state.login)

    useEffect(() => {
        if (user) {
            login({
                firstName: user.user_metadata.full_name?.split(' ')[0] || user.email?.split('@')[0] || '',
                lastName: user.user_metadata.full_name?.split(' ').slice(1).join(' ') || '',
                username: user.email?.split('@')[0] || '',
                email: user.email!,
                avatar: user.user_metadata.avatar_url,
                authProvider: user.app_metadata.provider === 'google' ? 'google' : 'email',
            })
        }
    }, [user, login])

    return null
}
