// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { signIn } from '@/lib/auth-client'
import { adminLoginSchema, corperLoginSchema } from '@/lib/schemas/auth'

export default function LoginPage() {
    const router = useRouter()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'corper' | 'admin'>('corper')

    async function handleCorperLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true); setError('')
        const fd = new FormData(e.currentTarget)
        const rawCallUpNumber = (fd.get('callUpNumber') as string | null)?.trim() ?? ''
        const rawStateCode = (fd.get('stateCode') as string | null)?.trim() ?? ''
        const parsed = corperLoginSchema.safeParse({
            callUpNumber: rawCallUpNumber,
            stateCode: rawStateCode,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Please enter valid credentials.')
            setLoading(false)
            return
        }

        const { callUpNumber, stateCode } = parsed.data
        const response = await fetch('/api/auth/sign-in/corper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callUpNumber, stateCode }),
        })

        if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: 'Unable to sign in' }))
            setError(payload.error ?? payload.message ?? 'Unable to sign in')
            setLoading(false)
            return
        }

        router.push(`/corper/${encodeURIComponent(callUpNumber)}`)
    }

    async function handleAdminLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true); setError('')
        const fd = new FormData(e.currentTarget)
        const rawStaffId = (fd.get('staffId') as string | null)?.trim() ?? ''
        const rawPassword = (fd.get('password') as string | null)?.trim() ?? ''
        const parsed = adminLoginSchema.safeParse({
            staffId: rawStaffId,
            password: rawPassword,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Please enter valid credentials.')
            setLoading(false)
            return
        }

        const { staffId, password } = parsed.data
        const { error } = await signIn.email({
            email: staffId,
            password,
        })

        if (error) { setError(error?.message ?? 'Unable to sign in'); setLoading(false); return }
        router.push('/panel')
    }

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50'>
            <div className='w-full max-w-md p-8 bg-white rounded-2xl shadow-lg'>
                <h1 className='text-2xl font-bold text-center mb-6 text-[#1F4E79]'>
                    NYSC Clearance Portal
                </h1>

                {/* ── Custom touch-safe tab switcher ── */}
                <div className='grid grid-cols-2 mb-6 bg-slate-100 rounded-lg p-1'>
                    <button
                        type='button'
                        onPointerDown={() => { setActiveTab('corper'); setError('') }}
                        className={`py-2 rounded-md text-sm font-medium transition-colors touch-manipulation
              ${activeTab === 'corper'
                                ? 'bg-white text-[#1F4E79] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Corps Member
                    </button>
                    <button
                        type='button'
                        onPointerDown={() => { setActiveTab('admin'); setError('') }}
                        className={`py-2 rounded-md text-sm font-medium transition-colors touch-manipulation
              ${activeTab === 'admin'
                                ? 'bg-white text-[#1F4E79] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        HR / Admin
                    </button>
                </div>

                {/* ── Corper Tab ── */}
                {activeTab === 'corper' && (
                    <form onSubmit={handleCorperLogin} className='space-y-4'>
                        <div>
                            <Label htmlFor='callUpNumber'>Call-Up Number</Label>
                            <Input id='callUpNumber' name='callUpNumber' placeholder='NYSC/FUW/2025/291616' />
                        </div>
                        <div>
                            <Label htmlFor='stateCode'>State Code</Label>
                            <Input id='stateCode' name='stateCode' placeholder='OY/25C/5371' />
                        </div>
                        {error && <p className='text-red-500 text-sm'>{error}</p>}
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                )}

                {/* ── Admin Tab ── */}
                {activeTab === 'admin' && (
                    <form onSubmit={handleAdminLogin} className='space-y-4'>
                        <div>
                            <Label htmlFor='staffId'>Staff ID</Label>
                            <Input id='staffId' name='staffId' placeholder='LCU/HR/001' />
                        </div>
                        <div>
                            <Label htmlFor='password'>Password</Label>
                            <Input id='password' name='password' type='password' />
                        </div>
                        {error && <p className='text-red-500 text-sm'>{error}</p>}
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}