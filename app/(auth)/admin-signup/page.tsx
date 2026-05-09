'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/auth-client'
import { adminSignupSchema } from '@/lib/schemas/auth'

function staffIdToEmail(staffId: string) {
    return `${staffId.replace(/[^A-Z0-9]+/g, '.').toLowerCase()}@admin.local`
}

export default function SignupPage() {
    const router = useRouter()
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
            email: staffIdToEmail(staffId),
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

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50'>
            <div className='w-full max-w-md p-8 bg-white rounded-2xl shadow-lg'>
                <h1 className='text-2xl font-bold text-center mb-6 text-[#1F4E79]'>Register HR Account</h1>
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
            </div>
        </div>
    )
}
