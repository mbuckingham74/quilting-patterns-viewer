import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'

interface Pattern {
  id: number
  file_name: string
  file_extension: string | null
  author: string | null
  notes: string | null
  thumbnail_url: string | null
  is_staged: boolean
  created_at: string
  upload_batch_id: number | null
}

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
        {patterns && patterns.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {patterns.map((pattern: Pattern) => (
              <div
                key={pattern.id}
                className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <Link href={`/admin/patterns/${pattern.id}/edit`}>
                  <div className="aspect-square bg-stone-100 relative">
                    {pattern.thumbnail_url ? (
                      <Image
                        src={pattern.thumbnail_url}
                        alt={pattern.notes || pattern.file_name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Staged badge */}
                    {pattern.is_staged && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                          Staged
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-stone-800 text-sm truncate" title={pattern.notes || pattern.file_name}>
                    {pattern.notes || pattern.file_name}
                  </h3>
                  {pattern.author && (
                    <p className="text-xs text-stone-500 truncate">by {pattern.author}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-stone-400">
                      {new Date(pattern.created_at).toLocaleDateString()}
                    </span>
                    {pattern.file_extension && (
                      <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
                        {pattern.file_extension}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Link
                      href={`/admin/patterns/${pattern.id}/edit`}
                      className="flex-1 text-center px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded transition-colors"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/patterns/${pattern.id}`}
                      className="flex-1 text-center px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
            <svg className="w-16 h-16 text-stone-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium text-stone-600">No patterns found</p>
            <p className="text-stone-500 mt-1">Upload some patterns to see them here.</p>
            <Link
              href="/admin/upload"
              className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Upload Patterns
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
