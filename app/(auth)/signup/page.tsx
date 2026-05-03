'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/auth-client'
import { adminSignupSchema, corperSignupSchema } from '@/lib/schemas/auth'

export default function SignupPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'corper' | 'admin'>('corper')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleAdminSignup(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const rawStaffId = (formData.get('staffId') as string | null)?.trim() ?? ''
        const rawDisplayName = (formData.get('displayName') as string | null)?.trim() ?? ''
        const rawPassword = (formData.get('password') as string | null)?.trim() ?? ''

        const parsed = adminSignupSchema.safeParse({
            staffId: rawStaffId,
            displayName: rawDisplayName,
            password: rawPassword,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Please provide valid signup details.')
            setLoading(false)
            return
        }

        const { staffId, displayName, password } = parsed.data
        const { error } = await signUp.email({
            email: staffId,
            password,
            name: displayName,
        })

        if (error) {
            setError(error.message ?? 'Unable to create account')
            setLoading(false)
            return
        }

        router.push('/panel')
    }

    async function handleCorperSignup(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const rawCallUpNumber = (formData.get('callUpNumber') as string | null)?.trim() ?? ''
        const rawStateCode = (formData.get('stateCode') as string | null)?.trim() ?? ''
        const rawDisplayName = (formData.get('displayName') as string | null)?.trim() ?? ''
        const rawBatch = (formData.get('batch') as string | null)?.trim() ?? ''

        const parsed = corperSignupSchema.safeParse({
            callUpNumber: rawCallUpNumber,
            stateCode: rawStateCode,
            displayName: rawDisplayName,
            batch: rawBatch,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Please provide valid corper signup details.')
            setLoading(false)
            return
        }

        const { callUpNumber, stateCode, displayName, batch } = parsed.data
        const response = await fetch('/api/auth/sign-up/corper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callUpNumber, stateCode, displayName, batch }),
        })

        const payload = await response.json().catch(() => ({ error: 'Unable to create corps account' }))
        if (!response.ok) {
            setError(payload.error ?? payload.message ?? 'Unable to create corps account')
            setLoading(false)
            return
        }

        router.push(`/corper/${encodeURIComponent(callUpNumber)}`)
    }

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50'>
            <div className='w-full max-w-md p-8 bg-white rounded-2xl shadow-lg'>
                <h1 className='text-2xl font-bold text-center mb-6 text-[#1F4E79]'>Register Account</h1>
                <div className='grid grid-cols-2 mb-6 bg-slate-100 rounded-lg p-1'>
                    <button
                        type='button'
                        onPointerDown={() => { setActiveTab('corper'); setError('') }}
                        className={`py-2 rounded-md text-sm font-medium transition-colors touch-manipulation ${activeTab === 'corper'
                            ? 'bg-white text-[#1F4E79] shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Corps Member
                    </button>
                    <button
                        type='button'
                        onPointerDown={() => { setActiveTab('admin'); setError('') }}
                        className={`py-2 rounded-md text-sm font-medium transition-colors touch-manipulation ${activeTab === 'admin'
                            ? 'bg-white text-[#1F4E79] shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        HR / Admin
                    </button>
                </div>

                {activeTab === 'corper' ? (
                    <form onSubmit={handleCorperSignup} className='space-y-4'>
                        <div>
                            <Label htmlFor='callUpNumber'>Call-Up Number</Label>
                            <Input id='callUpNumber' name='callUpNumber' placeholder='NYSC/FUW/2025/291616' />
                        </div>
                        <div>
                            <Label htmlFor='stateCode'>State Code</Label>
                            <Input id='stateCode' name='stateCode' placeholder='OY/25C/5371' />
                        </div>
                        <div>
                            <Label htmlFor='batch'>Batch</Label>
                            <select
                                id='batch'
                                name='batch'
                                className='mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-2 focus:ring-[#1F4E79]/20'
                                defaultValue='2026A'
                            >
                                <option value='2026A'>2026A</option>
                                <option value='2026B'>2026B</option>
                                <option value='2026C'>2026C</option>
                                <option value='2026D'>2026D</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor='displayName'>Display Name</Label>
                            <Input id='displayName' name='displayName' placeholder='Mrs. Adeyemi' />
                        </div>
                        {error && <p className='text-red-500 text-sm'>{error}</p>}
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Processing...' : 'Create Corps Account'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleAdminSignup} className='space-y-4'>
                        <div>
                            <Label htmlFor='staffId'>Staff ID</Label>
                            <Input id='staffId' name='staffId' placeholder='LCU/HR/001' />
                        </div>
                        <div>
                            <Label htmlFor='displayName'>Display Name</Label>
                            <Input id='displayName' name='displayName' placeholder='Mrs. Adeyemi' />
                        </div>
                        <div>
                            <Label htmlFor='password'>Password</Label>
                            <Input id='password' name='password' type='password' />
                        </div>
                        {error && <p className='text-red-500 text-sm'>{error}</p>}
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
