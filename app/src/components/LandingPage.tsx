'use client'

import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LandingPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-start">
          <Image
            src="/logo.png"
            alt="Quilting Patterns"
            width={120}
            height={40}
            className="h-10 w-auto"
          />
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-8">
            <Image
              src="/logo.png"
              alt="Quilting Patterns"
              width={900}
              height={300}
              className="h-96 w-auto mx-auto"
              priority
            />
          </div>

          <h2 className="text-4xl sm:text-5xl font-bold text-stone-800 mb-4">
            Quilting Patterns
          </h2>
          <p className="text-xl text-stone-600 mb-8 max-w-2xl mx-auto">
            Browse and download over 15,000 quilting patterns.
            Sign in to access the full collection.
          </p>

          {/* Sign in button */}
          <button
            onClick={handleGoogleLogin}
            className="inline-flex items-center gap-3 bg-white border border-stone-300 rounded-lg px-6 py-3 text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-all font-medium shadow-sm"
          >
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
            Sign in with Google
          </button>

          <p className="mt-4 text-sm text-stone-500">
            Access is limited to authorized users only.
          </p>
        </div>

        {/* Features */}
        <div className="mt-20 grid sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-stone-800 mb-2">Search & Filter</h3>
            <p className="text-stone-600 text-sm">
              Find patterns by name, author, or browse by keywords
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-stone-800 mb-2">Preview Thumbnails</h3>
            <p className="text-stone-600 text-sm">
              See pattern previews before downloading
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 className="font-semibold text-stone-800 mb-2">Download Patterns</h3>
            <p className="text-stone-600 text-sm">
              Download .qli, .csq, .dxf, and .pat files
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-stone-500">
          15,651 patterns available
        </div>
      </footer>
    </div>
  )
}
