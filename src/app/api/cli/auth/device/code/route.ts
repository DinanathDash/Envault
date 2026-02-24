import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
    try {
        const supabase = createAdminClient()
        const body = await request.json().catch(() => ({}))
        const { device_info } = body

        // 0. Cleanup expired sessions (Opportunistic cleanup)
        await supabase
            .from('device_flow_sessions')
            .delete()
            .lt('expires_at', new Date().toISOString())

        // 1. Generate codes
        const deviceCode = crypto.randomUUID()
        // ... (existing code gen logic) ...
        const generateCode = (length: number) => {
            let result = '';
            const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const charactersLength = characters.length;
            for (let i = 0; i < length; i++) {
                const randomByte = crypto.randomBytes(1)[0]
                result += characters.charAt(randomByte % charactersLength);
            }
            return result;
        }

        const part1 = generateCode(4)
        const part2 = generateCode(4)
        const userCode = `${part1}-${part2}`

        const expiresIn = 10 * 60 // 10 minutes
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        // 2. Store in DB
        const { error } = await supabase
            .from('device_flow_sessions')
            .insert({
                device_code: deviceCode,
                user_code: userCode,
                status: 'pending',
                expires_at: expiresAt,
                device_info: device_info || {} // Store device info
            })

        if (error) {
            console.error('Error creating device session:', error)
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envault.tech'
        const verificationUri = `${appUrl}/auth/device`

        return NextResponse.json({
            device_code: deviceCode,
            user_code: userCode,
            verification_uri: verificationUri,
            expires_in: expiresIn,
            interval: 2
        })

    } catch (error) {
        console.error('Device flow init error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
