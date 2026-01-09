import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'

export default async function AdminHelpPage() {
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
            <h1 className="text-2xl font-bold text-stone-800">How To Use This Site</h1>
            <p className="mt-1 text-stone-600">Step-by-step guides for all features</p>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="#sharing" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">1.</span> Share Patterns with Customers
            </a>
            <a href="#searching" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">2.</span> Search for Patterns
            </a>
            <a href="#favorites" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">3.</span> Save Favorite Patterns
            </a>
            <a href="#duplicates" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">4.</span> Find & Remove Duplicates
            </a>
            <a href="#upload" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">5.</span> Upload New Patterns
            </a>
            <a href="#users" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">6.</span> Manage Users
            </a>
            <a href="#edit-pattern" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">7.</span> Edit Pattern Details
            </a>
          </div>
        </div>

        {/* Guide Sections */}
        <div className="space-y-8">

          {/* Sharing Patterns */}
          <section id="sharing" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Share Patterns with Customers</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Send patterns to customers and let them pick their favorites! They don&apos;t need an account.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Browse Patterns</p>
                  <p className="text-stone-600 text-sm mt-1">Click &quot;Browse Patterns&quot; in the top menu</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Add patterns to your basket</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click the <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-600 rounded text-xs font-bold">+</span> button
                    on any pattern card. You can add up to 10 patterns.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Click the Share Basket</p>
                  <p className="text-stone-600 text-sm mt-1">
                    A purple button will appear in the bottom-right corner showing how many patterns you&apos;ve selected. Click it!
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Enter customer details</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Type their email address. Optionally add their name and a personal message.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Click &quot;Send Share&quot;</p>
                  <p className="text-stone-600 text-sm mt-1">
                    The customer will receive an email with a link to view the patterns and rank their favorites.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">What happens next?</p>
              <p className="text-green-700 text-sm mt-1">
                When the customer ranks the patterns, you&apos;ll get an email notification. You can also see all your shares and their status in
                <Link href="/account" className="underline ml-1">My Account</Link> under &quot;My Shares&quot;.
              </p>
            </div>
          </section>

          {/* Searching */}
          <section id="searching" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Search for Patterns</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Find patterns by describing what you&apos;re looking for in plain English!
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-blue-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Browse Patterns</p>
                  <p className="text-stone-600 text-sm mt-1">Click &quot;Browse Patterns&quot; in the menu</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-blue-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Type what you&apos;re looking for</p>
                  <p className="text-stone-600 text-sm mt-1">
                    In the search box, describe the pattern. For example:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; &quot;butterfly patterns&quot;</li>
                    <li>&bull; &quot;flower with swirls&quot;</li>
                    <li>&bull; &quot;geometric border&quot;</li>
                    <li>&bull; &quot;feather design&quot;</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-blue-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Press Enter or click Search</p>
                  <p className="text-stone-600 text-sm mt-1">
                    The AI will find patterns that look like what you described!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-800">Tip: Save your searches!</p>
              <p className="text-blue-700 text-sm mt-1">
                After searching, click &quot;Save Search&quot; to save it for later. Find your saved searches in
                <Link href="/account" className="underline ml-1">My Account</Link>.
              </p>
            </div>
          </section>

          {/* Favorites */}
          <section id="favorites" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Save Favorite Patterns</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Star patterns you love so you can find them again easily!
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-amber-50 rounded-lg">
                <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-amber-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Find a pattern you like</p>
                  <p className="text-stone-600 text-sm mt-1">Browse or search for patterns</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-amber-50 rounded-lg">
                <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-amber-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Click the star icon</p>
                  <p className="text-stone-600 text-sm mt-1">
                    The star is on the pattern card or the pattern detail page. It will turn gold when saved!
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-amber-50 rounded-lg">
                <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-amber-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">View your favorites</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Go to <Link href="/account" className="text-amber-700 underline">My Account</Link> to see all your starred patterns in one place.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Duplicates */}
          <section id="duplicates" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Find & Remove Duplicates</h2>
            </div>

            <p className="text-stone-600 mb-6">
              The AI can find patterns that look very similar. Review them and delete duplicates!
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-orange-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-orange-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Find Duplicates</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-orange-700 underline">Admin Panel</Link>, click &quot;Find Duplicates&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-orange-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-orange-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Review the pairs</p>
                  <p className="text-stone-600 text-sm mt-1">
                    You&apos;ll see two similar patterns side-by-side. Compare them carefully.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-orange-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-orange-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Choose what to do</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click <span className="text-red-600 font-medium">&quot;Delete This One&quot;</span> under the duplicate,
                    or <span className="text-green-600 font-medium">&quot;Keep Both&quot;</span> if they&apos;re different enough.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-medium text-red-800">Warning: Deletion is permanent!</p>
              <p className="text-red-700 text-sm mt-1">
                Once you delete a pattern, it cannot be recovered. Take your time to review carefully.
              </p>
            </div>
          </section>

          {/* Upload */}
          <section id="upload" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Upload New Patterns</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Add new pattern files to your collection from a ZIP file.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Prepare your ZIP file</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Put all your pattern files (.qli, .csq, .dxf, .pat) into a ZIP file on your computer.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Upload Patterns</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-green-700 underline">Admin Panel</Link>, click &quot;Upload Patterns&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Select and upload</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click &quot;Choose File&quot; and select your ZIP. Then click &quot;Upload&quot;. Wait for it to finish!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Note about processing time</p>
              <p className="text-green-700 text-sm mt-1">
                Large uploads may take a few minutes. The AI needs to analyze each pattern image for the smart search feature.
              </p>
            </div>
          </section>

          {/* Users */}
          <section id="users" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Manage Users</h2>
            </div>

            <p className="text-stone-600 mb-6">
              When someone signs up, you need to approve them before they can browse patterns.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Check for pending users</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-purple-700 underline">Admin Panel</Link>, look at &quot;Pending Approval&quot; count or click &quot;Manage Users&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Review the email</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Check if you recognize the email address. Is it someone you know?
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Approve or Reject</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click <span className="text-green-600 font-medium">&quot;Approve&quot;</span> to let them in,
                    or <span className="text-red-600 font-medium">&quot;Remove&quot;</span> if you don&apos;t recognize them.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="font-medium text-purple-800">You&apos;ll get an email!</p>
              <p className="text-purple-700 text-sm mt-1">
                Whenever someone new signs up, you&apos;ll receive an email notification so you can approve them quickly.
              </p>
            </div>
          </section>

          {/* Edit Pattern Details */}
          <section id="edit-pattern" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Edit Pattern Details</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Fix mistakes or update information on any pattern — change the name, author, notes, or keywords.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Find the pattern you want to edit</p>
                  <p className="text-stone-600 text-sm mt-1">
                    <Link href="/browse" className="text-rose-700 underline">Browse patterns</Link> or use search to find it
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Click the Edit button</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Look for the pencil icon <span className="inline-flex items-center justify-center w-5 h-5 bg-stone-100 text-stone-600 rounded text-xs">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span> on the pattern card, or click &quot;Edit Pattern&quot; on the pattern detail page.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Update the information</p>
                  <p className="text-stone-600 text-sm mt-1">
                    You can change:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>File Name</strong> — the display name of the pattern</li>
                    <li>&bull; <strong>Author</strong> — who designed the pattern</li>
                    <li>&bull; <strong>Author Website</strong> — link to the designer&apos;s site</li>
                    <li>&bull; <strong>Author Notes</strong> — notes from the designer</li>
                    <li>&bull; <strong>Notes</strong> — your own notes about the pattern</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Add or remove keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Scroll down to the Keywords section. Click the <span className="text-rose-600 font-medium">×</span> on any keyword to remove it.
                    Use the search box to find and add new keywords.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Click &quot;Save Changes&quot;</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Your changes will be saved and you&apos;ll return to the pattern detail page.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="font-medium text-rose-800">When should I edit a pattern?</p>
              <p className="text-rose-700 text-sm mt-1">
                Use this feature to fix typos, add missing author information, update notes, or organize patterns with better keywords.
                The thumbnail and pattern file cannot be changed — to replace those, delete the pattern and re-upload it.
              </p>
            </div>
          </section>

        </div>

        {/* Need More Help */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-purple-100 p-6 text-center">
          <h2 className="text-lg font-semibold text-stone-800 mb-2">Need More Help?</h2>
          <p className="text-stone-600">
            Contact Michael if you have questions or run into problems!
          </p>
        </div>
      </div>
    </div>
  )
}
