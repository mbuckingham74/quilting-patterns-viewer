import Image from 'next/image'
import AuthTabs from './AuthTabs'

export default function LandingPage() {
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-6">
            <Image
              src="/logo.png"
              alt="Quilting Patterns"
              width={600}
              height={200}
              className="h-64 w-auto mx-auto"
              priority
            />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-3">
            Quilting Patterns
          </h2>
          <p className="text-lg text-stone-600 mb-8 max-w-xl mx-auto">
            Browse and download over 15,000 quilting patterns.
            Sign in to access the full collection.
          </p>

          {/* Auth Tabs */}
          <AuthTabs />
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
