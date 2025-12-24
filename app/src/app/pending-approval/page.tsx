'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Check current user and approval status
    const checkApproval = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in, redirect to home
        router.push('/')
        return
      }

      setUserEmail(user.email || null)

      // Check if user is now approved
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single()

      if (profile?.is_approved) {
        // User was approved! Redirect to browse
        router.push('/browse')
        return
      }

      setChecking(false)
    }

    checkApproval()

    // Poll for approval every 10 seconds
    const interval = setInterval(checkApproval, 10000)

    return () => clearInterval(interval)
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto"></div>
          <p className="mt-4 text-stone-600">Checking approval status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <Link href="/" className="inline-block mb-6">
          <Image
            src="/logo.png"
            alt="Quilting Patterns"
            width={150}
            height={50}
            className="h-12 w-auto mx-auto"
          />
        </Link>

        <div className="mb-6">
          <svg
            className="mx-auto w-16 h-16 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Account Pending Approval
        </h1>

        <p className="text-stone-600 mb-4">
          Thank you for signing up! Your account is currently awaiting approval from an administrator.
        </p>

        {userEmail && (
          <p className="text-sm text-stone-500 mb-6">
            Signed in as: <span className="font-medium text-stone-700">{userEmail}</span>
          </p>
        )}

        <div className="bg-purple-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-purple-700">
            You&apos;ll be automatically redirected once your account is approved.
            This page checks every few seconds.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
