import Image from 'next/image'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Pam's Custom Quilts"
              width={120}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="flex gap-6 text-base font-medium">
            <Link href="/about" className="text-rose-700">
              About
            </Link>
            <Link href="/contact" className="text-rose-600 hover:text-rose-700">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-stone-800 mb-8">About</h1>

        <div className="prose prose-stone max-w-none">
          <p className="text-lg text-stone-600">
            Content coming soon...
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/"
            className="text-rose-600 hover:text-rose-700 font-medium"
          >
            &larr; Back to home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-base font-medium text-rose-600">
          Pam&apos;s Custom Quilts
        </div>
      </footer>
    </div>
  )
}
