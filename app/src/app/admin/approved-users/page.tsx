import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'

interface ApprovedUser {
  id: string
  email: string
  display_name: string | null
  created_at: string
  approved_at: string | null
}

export default async function ApprovedUsersPage() {
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

  // Get all approved users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at, approved_at')
    .eq('is_approved', true)
    .order('approved_at', { ascending: false, nullsFirst: false })

  const approvedUsers = (users || []) as ApprovedUser[]

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

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
            <h1 className="text-2xl font-bold text-stone-800">Approved Users</h1>
            <p className="mt-1 text-stone-600">{approvedUsers.length} users with access</p>
          </div>
        </div>

        {approvedUsers.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
            <svg
              className="mx-auto w-12 h-12 text-stone-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
            <p className="mt-4 text-stone-500">No approved users yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Approved
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-200">
                  {approvedUsers.map((approvedUser) => (
                    <tr key={approvedUser.id} className="hover:bg-stone-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-green-700 font-medium text-sm">
                              {(approvedUser.display_name || approvedUser.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-stone-900">
                            {approvedUser.display_name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-stone-600">{approvedUser.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-stone-500">{formatDate(approvedUser.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-stone-500">{formatDate(approvedUser.approved_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
