'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type AuthTab = 'signin' | 'register'

export default function AuthTabs() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AuthTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
  }

  const handleTabChange = (tab: AuthTab) => {
    setActiveTab(tab)
    resetForm()
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      const user = data?.user
      if (!user) {
        setError('Failed to sign in')
        setLoading(false)
        return
      }

      // Check if user is approved
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single()

      if (profile?.is_approved) {
        router.push('/browse')
      } else {
        router.push('/pending-approval')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      const user = signUpData?.user
      if (!user) {
        setError('Failed to create account')
        setLoading(false)
        return
      }

      // Create profile with safe defaults
      // Database trigger handles admin detection server-side
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: email,
          is_approved: false,
          is_admin: false,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
      }

      // Fetch the profile to check if trigger marked as admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved, is_admin')
        .eq('id', user.id)
        .single()

      const isApproved = profile?.is_approved ?? false

      // Send admin notification for new non-admin users
      if (!profile?.is_admin) {
        try {
          await fetch('/api/admin/notify-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
        } catch (e) {
          console.error('Failed to send admin notification:', e)
        }
      }

      // Redirect based on approval status
      if (isApproved) {
        router.push('/browse')
      } else {
        router.push('/pending-approval')
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => handleTabChange('signin')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'signin'
                ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabChange('register')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
            }`}
          >
            Register
          </button>
        </div>

        <div className="p-6">
          {/* Google OAuth - shown on both tabs */}
          <Link
            href="/auth/signin"
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 rounded-lg px-4 py-3 text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors font-medium"
          >
            <GoogleIcon />
            {activeTab === 'signin' ? 'Continue with Google' : 'Register with Google'}
          </Link>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-stone-500">
                {activeTab === 'signin' ? 'or sign in with email' : 'or register with email'}
              </span>
            </div>
          </div>

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="block text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="signin-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="signin-password" className="block text-sm font-medium text-stone-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="signin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="Your password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg transition-colors font-medium"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="register-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-stone-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="register-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label htmlFor="register-confirm" className="block text-sm font-medium text-stone-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="register-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="Confirm your password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg transition-colors font-medium"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 text-center">
                  New accounts require admin approval before accessing patterns.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-500 text-center">
        Access is limited to authorized users only.
      </p>
    </div>
  )
}
