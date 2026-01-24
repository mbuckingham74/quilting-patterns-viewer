import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import PatternEditForm from '@/components/PatternEditForm'
import { getSafeReturnUrl } from '@/lib/url-utils'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnUrl?: string | string[] }>
}

export default async function AdminPatternEditPage({ params, searchParams }: Props) {
  const { id } = await params
  const { returnUrl: rawReturnUrl } = await searchParams
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  // Validate returnUrl to prevent open redirects
  const defaultUrl = `/patterns/${patternId}`
  const safeReturnUrl = getSafeReturnUrl(rawReturnUrl, defaultUrl)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/browse')
  }

  // Fetch pattern
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', patternId)
    .single()

  if (patternError || !pattern) {
    notFound()
  }

  // Fetch keywords for this pattern
  const { data: patternKeywords } = await supabase
    .from('pattern_keywords')
    .select('keyword_id, keywords(id, value)')
    .eq('pattern_id', patternId)

  // Supabase returns keywords as a single object (not array) when using foreign key join
  const keywords: { id: number; value: string }[] = []
  if (patternKeywords) {
    for (const pk of patternKeywords) {
      // Cast through unknown to handle Supabase's type inference
      const kw = pk.keywords as unknown as { id: number; value: string } | null
      if (kw) {
        keywords.push(kw)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Quilting Patterns"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <Link href="/admin" className="text-purple-600 hover:text-purple-700 font-medium">
                Admin Panel
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/browse"
                className="text-stone-600 hover:text-purple-700 transition-colors text-sm font-medium"
              >
                Browse Patterns
              </Link>
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-stone-600 mb-6">
          <Link href="/admin" className="hover:text-purple-600">
            Admin Panel
          </Link>
          <span>/</span>
          <Link href={`/patterns/${patternId}`} className="hover:text-purple-600">
            Pattern #{patternId}
          </Link>
          <span>/</span>
          <span className="text-stone-800 font-medium">Edit</span>
        </div>

        {/* Page Title */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={safeReturnUrl}
            className="text-stone-500 hover:text-purple-600 transition-colors"
            title={safeReturnUrl.startsWith('/admin/triage') ? 'Back to Triage' : 'Back to Pattern'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Edit Pattern</h1>
            <p className="mt-1 text-stone-600">
              {pattern.file_name || `Pattern #${patternId}`}
            </p>
          </div>
        </div>

        {/* Edit Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
          <PatternEditForm
            patternId={patternId}
            initialPattern={pattern}
            initialKeywords={keywords}
            returnUrl={safeReturnUrl}
          />
        </div>
      </div>
    </div>
  )
}
