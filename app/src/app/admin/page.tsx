import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import UploadLogsSection from '@/components/UploadLogsSection'

export default async function AdminDashboardPage() {
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

  // Get user counts
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, is_approved')

  const pendingUsers = allProfiles?.filter(p => !p.is_approved).length || 0
  const approvedUsers = allProfiles?.filter(p => p.is_approved).length || 0

  // Get staged batches (pending review)
  const serviceClient = createServiceClient()
  const { data: stagedBatches } = await serviceClient
    .from('upload_logs')
    .select('id, zip_filename, uploaded_at, uploaded_count')
    .eq('status', 'staged')
    .order('uploaded_at', { ascending: false })
    .limit(5)

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
              <span className="text-purple-600 font-medium">Admin Panel</span>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">Admin Dashboard</h1>
          <p className="mt-1 text-stone-600">Manage users and site settings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/admin/users"
            className="bg-white rounded-xl shadow-sm border border-amber-100 p-6 hover:shadow-md hover:border-amber-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-stone-500">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{pendingUsers}</p>
              </div>
              <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            href="/admin/approved-users"
            className="bg-white rounded-xl shadow-sm border border-green-100 p-6 hover:shadow-md hover:border-green-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-stone-500">Approved Users</p>
                <p className="text-2xl font-bold text-green-600">{approvedUsers}</p>
              </div>
              <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Pending Reviews Alert */}
        {stagedBatches && stagedBatches.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 mb-8 text-white shadow-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Pending Upload Reviews</h3>
                <p className="text-amber-100 text-sm mt-1">
                  You have {stagedBatches.length} upload{stagedBatches.length !== 1 ? 's' : ''} waiting to be reviewed
                </p>
                <div className="mt-4 space-y-2">
                  {stagedBatches.map(batch => (
                    <Link
                      key={batch.id}
                      href={`/admin/batches/${batch.id}/review`}
                      className="flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-lg p-3 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{batch.zip_filename}</p>
                        <p className="text-xs text-amber-100">
                          {batch.uploaded_count} patterns • {new Date(batch.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/admin/users"
              className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Manage Users</p>
                <p className="text-sm text-stone-500">Approve or reject accounts</p>
              </div>
              {pendingUsers > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {pendingUsers}
                </span>
              )}
            </Link>

            <Link
              href="/admin/upload"
              className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Upload Patterns</p>
                <p className="text-sm text-stone-500">Add new patterns from ZIP</p>
              </div>
            </Link>

            <Link
              href="/admin/recent-imports"
              className="flex items-center gap-3 p-4 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-teal-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Recent Imports</p>
                <p className="text-sm text-stone-500">Last 25 patterns added</p>
              </div>
            </Link>

            <Link
              href="/browse"
              className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Browse Patterns</p>
                <p className="text-sm text-stone-500">View the pattern library</p>
              </div>
            </Link>

            <Link
              href="/admin/keywords"
              className="flex items-center gap-3 p-4 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-pink-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Manage Keywords</p>
                <p className="text-sm text-stone-500">Add, edit, merge keywords</p>
              </div>
            </Link>

            <Link
              href="/admin/duplicates"
              className="flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Find Duplicates</p>
                <p className="text-sm text-stone-500">Review similar patterns</p>
              </div>
            </Link>

            <Link
              href="/admin/analytics"
              className="flex items-center gap-3 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Pattern Analytics</p>
                <p className="text-sm text-stone-500">View usage statistics</p>
              </div>
            </Link>

            <Link
              href="/admin/exceptions"
              className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Pattern Exceptions</p>
                <p className="text-sm text-stone-500">Missing thumbnails/embeddings</p>
              </div>
            </Link>

            <Link
              href="/admin/rotate-review"
              className="flex items-center gap-3 p-4 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-cyan-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Quick Rotate Review</p>
                <p className="text-sm text-stone-500">Fix pattern orientations</p>
              </div>
            </Link>

            <Link
              href="/admin/videos"
              className="flex items-center gap-3 p-4 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-violet-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">Educational Videos</p>
                <p className="text-sm text-stone-500">Video tutorials by month</p>
              </div>
            </Link>

            <Link
              href="/admin/help"
              className="flex items-center gap-3 p-4 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-rose-200 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-stone-800">How-To Guide</p>
                <p className="text-sm text-stone-500">Learn how to use features</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Upload Logs Section */}
        <div id="upload-logs" className="mt-8 scroll-mt-20">
          <UploadLogsSection />
        </div>
      </div>
    </div>
  )
}
