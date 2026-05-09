'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { corperSignupSchema } from '@/lib/schemas/auth'

function corperEmail(callUpNumber: string) {
  return `${callUpNumber.replace(/[^A-Z0-9]+/g, '.').toLowerCase()}@corper.local`
}

type VerifiedCorper = {
  callUpNumber: string
  fullName: string
  batch: string
  deploymentUnit: string
  status: string
}

export default function CorperSignupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState<VerifiedCorper | null>(null)

  const helperText = useMemo(() => {
    if (!verified) return 'Enter your call-up number and state code exactly as in the registry.'
    return `Verified: ${verified.fullName} (${verified.callUpNumber})`
  }, [verified])

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
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
      setError(parsed.error.issues[0]?.message ?? 'Please provide valid signup details.')
      setLoading(false)
      return
    }

    const { callUpNumber, stateCode, displayName } = parsed.data

    // 1) Verify against seeded Convex registry first
    const verifyRes = await fetch('/api/corpers/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callUpNumber, stateCode }),
    })
    const verifyJson = await verifyRes.json().catch(() => null)

    if (!verifyRes.ok) {
      setVerified(null)
      setError(verifyJson?.error ?? 'Unable to verify corper in registry.')
      setLoading(false)
      return
    }

    const vCorper: VerifiedCorper | undefined = verifyJson?.corper
    if (vCorper) setVerified(vCorper)

    // 2) Create Better Auth user using the built-in email sign-up endpoint.
    // We also pass username fields for the username plugin (call-up number login).
    const email = corperEmail(callUpNumber)
    const signUpRes = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: displayName || vCorper?.fullName || callUpNumber,
        username: callUpNumber,
        displayUsername: callUpNumber,
        password: stateCode,
      }),
    })

    // 409 usually means "user already exists" — send them to login.
    if (signUpRes.status === 409) {
      router.push('/login')
      return
    }

    const signUpJson = await signUpRes.json().catch(() => null)
    if (!signUpRes.ok) {
      setError(signUpJson?.error?.message ?? signUpJson?.message ?? 'Unable to create account.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-50'>
      <div className='w-full max-w-md p-8 bg-white rounded-2xl shadow-lg'>
        <h1 className='text-2xl font-bold text-center mb-2 text-[#1F4E79]'>Corps Member Signup</h1>
        <p className='text-sm text-slate-600 text-center mb-6'>{helperText}</p>

        <form onSubmit={handleSignup} className='space-y-4'>
          <div>
            <Label htmlFor='callUpNumber'>Call-Up Number</Label>
            <Input id='callUpNumber' name='callUpNumber' placeholder='NYSC/FUW/2025/291616' />
          </div>
          <div>
            <Label htmlFor='stateCode'>State Code</Label>
            <Input id='stateCode' name='stateCode' placeholder='OY/25C/5371' />
          </div>
          <div>
            <Label htmlFor='displayName'>Display Name</Label>
            <Input id='displayName' name='displayName' placeholder='Adebayo Samuel' />
          </div>
          <div>
            <Label htmlFor='batch'>Batch</Label>
            <Input id='batch' name='batch' placeholder='2026A' />
          </div>

          {error && <p className='text-red-500 text-sm'>{error}</p>}

          <Button type='submit' className='w-full' disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>

          <p className='text-sm text-slate-600 text-center'>
            Already have an account?{' '}
            <Link href='/login' className='font-semibold text-[#1F4E79] hover:underline'>
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

