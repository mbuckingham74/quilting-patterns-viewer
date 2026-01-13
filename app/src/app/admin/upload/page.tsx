import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import AdminUploadForm from '@/components/AdminUploadForm'

export default async function AdminUploadPage() {
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

  // Get pattern count for display
  const { count: patternCount } = await supabase
    .from('patterns')
    .select('*', { count: 'exact', head: true })

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
              <Link href="/admin" className="text-purple-600 hover:text-purple-800 font-medium">
                Admin Panel
              </Link>
              <span className="text-stone-400">/</span>
              <span className="text-stone-600 font-medium">Upload Patterns</span>
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">Upload Patterns</h1>
          <p className="mt-1 text-stone-600">
            Upload a ZIP file from a pattern vendor to add new patterns to the library.
            Currently {patternCount?.toLocaleString() || 0} patterns in the database.
          </p>
          <Link
            href="/admin#upload-logs"
            className="inline-flex items-center gap-1.5 mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Upload History
          </Link>
        </div>

        <AdminUploadForm />

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-purple-100 p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">How it works</h2>
          <ol className="list-decimal list-inside space-y-2 text-stone-600">
            <li>Download the pattern ZIP file from your vendor (e.g., My Creative Stitches)</li>
            <li>Drag and drop the ZIP file onto the upload area above</li>
            <li>The system will extract all .QLI files (pattern files for the longarm machine)</li>
            <li>If PDF previews are included, thumbnails will be generated automatically</li>
            <li>Duplicate patterns (already in the database) will be skipped</li>
          </ol>

          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Thumbnail generation from PDFs is currently limited in the web interface.
              Patterns uploaded without PDFs will use a placeholder image. For best results with thumbnails,
              ensure your vendor ZIP includes PDF preview files.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
