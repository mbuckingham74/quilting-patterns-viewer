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
            <a href="#analytics" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">8.</span> View Analytics
            </a>
            <a href="#keywords" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">9.</span> Manage Keywords
            </a>
            <a href="#activity" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">10.</span> Audit Admin Activity
            </a>
            <a href="#exceptions" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">11.</span> Fix Missing Thumbnails
            </a>
            <a href="#triage" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <span className="text-lg">12.</span> Pattern Triage Queue
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
              Add new pattern files to your collection from a ZIP file. Patterns are uploaded to a staging area where you can review them, assign keywords, and then commit them to make them visible.
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
                    Click &quot;Choose File&quot; and select your ZIP. Then click &quot;Upload&quot;. Wait for it to finish — this goes to a staging area for review.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Review your upload</p>
                  <p className="text-stone-600 text-sm mt-1">
                    After uploading, you&apos;ll see a review page with all the patterns displayed as thumbnail cards. Here you can:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Edit pattern info</strong> — click &quot;Edit info&quot; on any card to change the name or author</li>
                    <li>&bull; <strong>Rotate/flip thumbnails</strong> — fix incorrectly oriented images</li>
                    <li>&bull; <strong>Delete patterns</strong> — remove any you don&apos;t want to keep</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Assign keywords to patterns</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Use the keyword sidebar on the left to assign keywords. You have three ways to select patterns:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Single pattern</strong> — click a pattern card to select just that one</li>
                    <li>&bull; <strong>Multiple patterns</strong> — hold <span className="px-1.5 py-0.5 bg-stone-200 rounded text-xs font-mono">Ctrl</span> (or <span className="px-1.5 py-0.5 bg-stone-200 rounded text-xs font-mono">Cmd</span> on Mac) and click to add patterns to your selection</li>
                    <li>&bull; <strong>All patterns</strong> — click &quot;Select All&quot; in the sidebar to select every pattern at once</li>
                  </ul>
                  <p className="text-stone-600 text-sm mt-2">
                    Selected patterns show a <span className="text-blue-600 font-medium">blue border</span>. Then check the keywords you want and click the purple &quot;Apply&quot; button.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">6</div>
                <div>
                  <p className="font-medium text-stone-800">See confirmation</p>
                  <p className="text-stone-600 text-sm mt-1">
                    After applying keywords, a confirmation dialog shows which keywords were added to which patterns. Click &quot;Done&quot; to continue assigning more keywords or move to the next step.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-green-700">7</div>
                <div>
                  <p className="font-medium text-stone-800">Commit or Cancel</p>
                  <p className="text-stone-600 text-sm mt-1">
                    When you&apos;re done reviewing:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; Click <span className="text-green-600 font-medium">&quot;Commit&quot;</span> to publish all patterns — they&apos;ll become visible in Browse</li>
                    <li>&bull; Click <span className="text-red-600 font-medium">&quot;Cancel Upload&quot;</span> to delete the entire batch if you change your mind</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Tip: Work in batches!</p>
              <p className="text-green-700 text-sm mt-1">
                If your patterns need different keywords, work through them in groups. Select similar patterns (like all the flower patterns), apply their keywords, then select the next group.
              </p>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800">Note about processing time</p>
              <p className="text-amber-700 text-sm mt-1">
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

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Revoke access if needed</p>
                  <p className="text-stone-600 text-sm mt-1">
                    To remove access from an approved user, go to <Link href="/admin/approved-users" className="text-purple-700 underline">Approved Users</Link> and click the <span className="text-red-600 font-medium">&quot;Revoke&quot;</span> button next to their name. They&apos;ll need to be re-approved to access the site again.
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
                  <p className="font-medium text-stone-800">Rotate or flip the thumbnail (if needed)</p>
                  <p className="text-stone-600 text-sm mt-1">
                    If the pattern thumbnail is oriented incorrectly, use the transform controls below the image:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Rotate buttons</strong> — turn the image 90° left, 90° right, or 180°</li>
                    <li>&bull; <strong>Flip buttons</strong> — mirror the image horizontally or vertically</li>
                  </ul>
                  <p className="text-stone-500 text-xs mt-2">
                    Note: After rotating/flipping, the AI search data will be regenerated automatically.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Add or remove keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Scroll down to the Keywords section. Click the <span className="text-rose-600 font-medium">×</span> on any keyword to remove it.
                    Use the search box to find and add new keywords.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-rose-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-rose-700">6</div>
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
                Use this feature to fix typos, add missing author information, update notes, organize patterns with better keywords, or fix incorrectly oriented thumbnails.
                The pattern file itself cannot be changed — to replace that, delete the pattern and re-upload it.
              </p>
            </div>
          </section>

          {/* View Analytics */}
          <section id="analytics" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">View Analytics</h2>
            </div>

            <p className="text-stone-600 mb-6">
              See how people are using the site — track downloads, searches, and user activity.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Analytics</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-indigo-700 underline">Admin Panel</Link>, click &quot;Analytics&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">View the overview stats</p>
                  <p className="text-stone-600 text-sm mt-1">
                    At the top you&apos;ll see:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Total Users</strong> — how many people have accounts</li>
                    <li>&bull; <strong>Downloads</strong> — how many patterns have been downloaded</li>
                    <li>&bull; <strong>Searches</strong> — how many searches have been performed</li>
                    <li>&bull; <strong>Shares</strong> — how many pattern collections have been shared</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Check the activity chart</p>
                  <p className="text-stone-600 text-sm mt-1">
                    The bar chart shows activity over the last 30 days, including downloads, searches, and new signups.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-indigo-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">See what&apos;s popular</p>
                  <p className="text-stone-600 text-sm mt-1">
                    At the bottom, you&apos;ll find the top downloaded patterns and most popular search queries. Hover over any pattern in the lists to reveal a pencil icon <span className="inline-flex items-center justify-center w-5 h-5 bg-stone-100 text-stone-600 rounded text-xs">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span> — click it to quickly edit that pattern&apos;s details.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="font-medium text-indigo-800">Note about historical data</p>
              <p className="text-indigo-700 text-sm mt-1">
                Analytics tracking starts from when this feature was added. Downloads and searches from before that time aren&apos;t counted.
              </p>
            </div>

            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="font-medium text-purple-800">Quick access from the dashboard</p>
              <p className="text-purple-700 text-sm mt-1">
                The <Link href="/admin" className="underline">Admin Panel</Link> dashboard shows a &quot;QA Issues&quot; section with counts of patterns that need attention. Click any issue type to jump directly to the right page:
              </p>
              <ul className="mt-2 text-sm text-purple-700 space-y-1">
                <li>&bull; <strong>Missing Thumbnails/Embeddings</strong> → Pattern Exceptions page</li>
                <li>&bull; <strong>Rotation/Mirror Issues</strong> → Pattern Triage queue</li>
              </ul>
            </div>
          </section>

          {/* Manage Keywords */}
          <section id="keywords" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Manage Keywords</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Keywords help organize patterns so they&apos;re easy to find. Add new keywords, fix typos, merge duplicates, and find patterns that need keywords.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Manage Keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-pink-700 underline">Admin Panel</Link>, click &quot;Manage Keywords&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">View all keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    You&apos;ll see a list of all keywords with how many patterns use each one. Use the search box to find specific keywords, or sort by name or count.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Add a new keyword</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click <span className="text-pink-600 font-medium">&quot;+ Add Keyword&quot;</span> at the top, type the keyword name, and click &quot;Add&quot;.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Edit or delete a keyword</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click on any keyword row to see its options:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Edit</strong> — fix typos or rename the keyword</li>
                    <li>&bull; <strong>Delete</strong> — remove the keyword (patterns keep their other keywords)</li>
                    <li>&bull; <strong>View patterns</strong> — see all patterns with this keyword</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Merge duplicate keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    If you have two similar keywords (like &quot;Flower&quot; and &quot;Flowers&quot;), you can merge them:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; Click on the keyword you want to <strong>remove</strong> (the source)</li>
                    <li>&bull; Click <span className="text-purple-600 font-medium">&quot;Merge into...&quot;</span></li>
                    <li>&bull; Select the keyword you want to <strong>keep</strong> (the target)</li>
                    <li>&bull; All patterns will be moved to the target keyword, and the source is deleted</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-pink-50 rounded-lg">
                <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-pink-700">6</div>
                <div>
                  <p className="font-medium text-stone-800">Find patterns without keywords</p>
                  <p className="text-stone-600 text-sm mt-1">
                    At the top of the page, you&apos;ll see a count of patterns that have no keywords assigned. Click <span className="text-pink-600 font-medium">&quot;View patterns without keywords&quot;</span> to see them and add keywords.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-pink-50 border border-pink-200 rounded-lg">
              <p className="font-medium text-pink-800">Why are keywords important?</p>
              <p className="text-pink-700 text-sm mt-1">
                Keywords help users find patterns when browsing by category. Patterns without keywords can only be found through AI search or by scrolling. Keep your keywords organized for the best browsing experience!
              </p>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800">Tip: Look for low-count keywords</p>
              <p className="text-amber-700 text-sm mt-1">
                Sort by &quot;Count&quot; to find keywords with only 1-2 patterns. These might be typos or duplicates that should be merged with similar keywords.
              </p>
            </div>
          </section>

          {/* Activity Log */}
          <section id="activity" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Audit Admin Activity</h2>
            </div>

            <p className="text-stone-600 mb-6">
              See a complete history of all admin actions — who did what and when. Useful for tracking changes and troubleshooting.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-slate-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Activity Log</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-slate-700 underline">Admin Panel</Link>, click &quot;Activity Log&quot; in the Quick Actions grid
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-slate-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">View recent activity</p>
                  <p className="text-stone-600 text-sm mt-1">
                    You&apos;ll see a list of all admin actions, showing:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Action type</strong> — what was done (approve, delete, update, etc.)</li>
                    <li>&bull; <strong>Who did it</strong> — which admin performed the action</li>
                    <li>&bull; <strong>Target</strong> — what was affected (pattern, user, keyword)</li>
                    <li>&bull; <strong>When</strong> — date and time of the action</li>
                    <li>&bull; <strong>Description</strong> — details about what changed</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-slate-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Filter the activity</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Use the filter dropdowns to narrow down the list:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Target Type</strong> — show only actions on patterns, users, or keywords</li>
                    <li>&bull; <strong>Action</strong> — show only specific actions like deletes or approvals</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-slate-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Browse through history</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Use the pagination at the bottom to see older activity. The log keeps a complete history of all admin actions.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="font-medium text-slate-800">What gets logged?</p>
              <p className="text-slate-700 text-sm mt-1">
                The activity log tracks all admin actions:
              </p>
              <ul className="mt-2 text-sm text-slate-700 space-y-1">
                <li>&bull; <strong>User management</strong> — approvals, rejections, and access revocations</li>
                <li>&bull; <strong>Pattern changes</strong> — deletions, updates, thumbnail rotations and flips</li>
                <li>&bull; <strong>Batch operations</strong> — uploads, commits, cancellations</li>
                <li>&bull; <strong>Keyword management</strong> — creation, edits, deletes, merges</li>
                <li>&bull; <strong>Pattern keywords</strong> — adding/removing keywords from individual patterns</li>
                <li>&bull; <strong>Batch keywords</strong> — bulk adding/removing keywords across entire batches</li>
                <li>&bull; <strong>Duplicate review</strong> — decisions on duplicate patterns (keep both, delete one)</li>
                <li>&bull; <strong>Thumbnail reprocessing</strong> — bulk thumbnail regeneration from ZIP uploads</li>
                <li>&bull; <strong>Orientation review</strong> — marking rotation/mirror issues as reviewed</li>
              </ul>
              <p className="text-slate-600 text-xs mt-3">
                Click any log entry to expand and see full details of what changed.
              </p>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800">Undo certain actions</p>
              <p className="text-amber-700 text-sm mt-1">
                Some actions can be undone directly from the activity log:
              </p>
              <ul className="mt-2 text-sm text-amber-700 space-y-1">
                <li>&bull; <strong>Keyword renames</strong> — click &quot;Undo Rename&quot; to restore the original name</li>
                <li>&bull; <strong>User approvals</strong> — click &quot;Unapprove&quot; to revoke access</li>
              </ul>
              <p className="text-amber-600 text-xs mt-2">
                Note: Deletions, merges, and user revocations cannot be undone from the activity log. To restore a revoked user&apos;s access, go to <Link href="/admin/users" className="underline">Manage Users</Link> and approve them again.
              </p>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-800">Tip: Use this for troubleshooting</p>
              <p className="text-blue-700 text-sm mt-1">
                If something looks wrong (a pattern is missing, a user can&apos;t log in), check the activity log to see what happened and when. This helps you understand what changed and who made the change.
              </p>
            </div>
          </section>

          {/* Pattern Exceptions */}
          <section id="exceptions" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Fix Missing Thumbnails</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Some patterns may be missing thumbnails or AI embeddings. Use the Pattern Exceptions page to find these issues and regenerate thumbnails from stored PDFs.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-teal-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-teal-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Pattern Exceptions</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-teal-700 underline">Admin Panel</Link>, click &quot;Pattern Exceptions&quot;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-teal-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-teal-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Filter by issue type</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Use the filter buttons at the top:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>All Exceptions</strong> — patterns missing either thumbnail or embedding</li>
                    <li>&bull; <strong>No Thumbnail</strong> — patterns without a preview image</li>
                    <li>&bull; <strong>No Embedding</strong> — patterns not searchable by AI</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-teal-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-teal-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Select patterns to fix</p>
                  <p className="text-stone-600 text-sm mt-1">
                    When viewing &quot;No Thumbnail&quot; or &quot;All Exceptions&quot;, you&apos;ll see checkboxes next to each pattern. Select the patterns you want to generate thumbnails for, or use the checkbox in the header to select all.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-teal-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-teal-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Click &quot;Generate Thumbnails&quot;</p>
                  <p className="text-stone-600 text-sm mt-1">
                    The teal button will generate thumbnails from stored PDFs. You&apos;ll see a results summary showing:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <span className="text-green-600">Successfully generated</span> — thumbnails created</li>
                    <li>&bull; <span className="text-amber-600">No stored PDF</span> — pattern was uploaded without a PDF file</li>
                    <li>&bull; <span className="text-red-600">Failed</span> — error during processing</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-teal-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-teal-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Handle patterns without PDFs</p>
                  <p className="text-stone-600 text-sm mt-1">
                    If patterns don&apos;t have stored PDFs, you have two options:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>Delete the pattern</strong> — click the trash icon if the pattern isn&apos;t needed</li>
                    <li>&bull; <strong>Keep it</strong> — patterns without thumbnails won&apos;t appear in browse/search but the file can still be downloaded if you share the direct link</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="font-medium text-teal-800">Why do thumbnails go missing?</p>
              <p className="text-teal-700 text-sm mt-1">
                Thumbnails are generated from PDF files when patterns are uploaded. If the PDF wasn&apos;t included in the upload ZIP, or if there was a server error during processing, the thumbnail won&apos;t be created. This page helps you identify and fix these issues.
              </p>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800">About AI embeddings</p>
              <p className="text-amber-700 text-sm mt-1">
                Patterns need both a thumbnail AND an AI embedding to appear in search results. Embeddings are automatically generated when you commit a batch of patterns. Patterns without thumbnails cannot have embeddings generated — fix the thumbnail first!
              </p>
            </div>
          </section>

          {/* Pattern Triage */}
          <section id="triage" className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-rose-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-800">Pattern Triage Queue</h2>
            </div>

            <p className="text-stone-600 mb-6">
              Fix pattern issues in one place! The triage queue shows all patterns that need attention — rotation issues, mirrored images, and missing keywords — in a single prioritized list.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">1</div>
                <div>
                  <p className="font-medium text-stone-800">Go to Pattern Triage</p>
                  <p className="text-stone-600 text-sm mt-1">
                    From the <Link href="/admin" className="text-purple-700 underline">Admin Panel</Link>, click &quot;Pattern Triage&quot; in the Quick Actions section. This is the prominent gradient button.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">2</div>
                <div>
                  <p className="font-medium text-stone-800">Filter by issue type</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Use the tabs at the top to filter:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <strong>All</strong> — every pattern needing attention</li>
                    <li>&bull; <strong>Rotation</strong> — patterns that may be rotated incorrectly</li>
                    <li>&bull; <strong>Mirror</strong> — patterns that may be horizontally flipped</li>
                    <li>&bull; <strong>No Keywords</strong> — patterns without any keywords assigned</li>
                  </ul>
                  <p className="text-stone-500 text-xs mt-2">Each tab shows a count badge so you can see how many issues are in each category.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">3</div>
                <div>
                  <p className="font-medium text-stone-800">Understand the issue badges</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Each pattern card shows colored badges for its issues:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <span className="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">HIGH</span> — AI is confident this needs fixing</li>
                    <li>&bull; <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">MEDIUM</span> — Likely needs fixing</li>
                    <li>&bull; <span className="inline-flex items-center px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-xs font-medium">LOW</span> — Might need checking</li>
                    <li>&bull; <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">No keywords</span> — Pattern needs keywords assigned</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">4</div>
                <div>
                  <p className="font-medium text-stone-800">Fix issues with quick actions</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Each card has buttons for common fixes:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <span className="text-purple-600 font-medium">Purple button</span> — applies the AI&apos;s recommended rotation (90° CW, 90° CCW, or 180°)</li>
                    <li>&bull; <span className="text-blue-600 font-medium">Flip H</span> — flip horizontally to fix mirrored images</li>
                    <li>&bull; <span className="text-green-600 font-medium">Looks Correct</span> — mark as reviewed if the AI was wrong</li>
                    <li>&bull; <span className="text-stone-600 font-medium">Expand</span> — show all controls including manual rotate left/right</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">5</div>
                <div>
                  <p className="font-medium text-stone-800">Select multiple patterns</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Click the checkbox on pattern cards to select them. Use shift-click to select a range of patterns at once.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">6</div>
                <div>
                  <p className="font-medium text-stone-800">Apply bulk actions</p>
                  <p className="text-stone-600 text-sm mt-1">
                    When patterns are selected, a toolbar appears at the top:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <span className="text-green-600 font-medium">Mark Reviewed</span> — dismiss rotation/mirror issues for all selected patterns</li>
                    <li>&bull; <span className="text-amber-600 font-medium">Add Keywords</span> — open the keyword selector to tag all selected patterns at once</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-purple-700">7</div>
                <div>
                  <p className="font-medium text-stone-800">Use keyboard shortcuts (power users)</p>
                  <p className="text-stone-600 text-sm mt-1">
                    Press <span className="px-1.5 py-0.5 bg-stone-200 rounded text-xs font-mono">?</span> to see all shortcuts:
                  </p>
                  <ul className="mt-2 text-sm text-stone-600 space-y-1">
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">j</span> / <span className="font-mono bg-stone-100 px-1 rounded">k</span> — move down/up through the list</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">Space</span> — toggle selection on focused pattern</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">r</span> — apply recommended rotation</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">f</span> — flip horizontally</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">c</span> — mark as correct (dismiss issues)</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">e</span> — expand/collapse action panel</li>
                    <li>&bull; <span className="font-mono bg-stone-100 px-1 rounded">Ctrl+A</span> — select all visible patterns</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-rose-50 border border-purple-200 rounded-lg">
              <p className="font-medium text-purple-800">Why use triage?</p>
              <p className="text-purple-700 text-sm mt-1">
                The triage queue consolidates multiple admin tasks into one efficient workflow. Instead of checking rotation issues, then mirror issues, then untagged patterns separately, you can work through everything in one prioritized list. Patterns with multiple issues show all their problems at once.
              </p>
            </div>

            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Items disappear when fixed!</p>
              <p className="text-green-700 text-sm mt-1">
                When you fix an issue (rotate, flip, mark correct, or add keywords), the pattern automatically leaves the queue once it has no remaining issues. Watch the counter at the top decrease as you work through the list!
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
