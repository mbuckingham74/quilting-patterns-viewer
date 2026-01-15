import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import RecentImportsGrid from '@/components/RecentImportsGrid'

export default async function RecentImportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/browse')
  }

  // Fetch 25 most recently imported patterns (using service client to include staged)
  const serviceClient = createServiceClient()
  const { data: patterns } = await serviceClient
    .from('patterns')
    .select(`
      id,
      file_name,
      file_extension,
      author,
      notes,
      thumbnail_url,
      is_staged,
      created_at,
      upload_batch_id
    `)
    .order('created_at', { ascending: false })
    .limit(25)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-stone-500 hover:text-purple-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Recent Imports</h1>
            <p className="mt-1 text-stone-600">Last 25 patterns added to the library</p>
          </div>
        </div>

        {/* Pattern Grid */}
        <RecentImportsGrid initialPatterns={patterns || []} />
      </div>
    </div>
  )
}
