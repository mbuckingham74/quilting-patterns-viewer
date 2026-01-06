import Image from 'next/image'
import Link from 'next/link'

export default function ContactPage() {
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
          <nav className="flex gap-6 text-sm">
            <Link href="/about" className="text-stone-600 hover:text-stone-900">
              About
            </Link>
            <Link href="/contact" className="text-rose-600 font-medium">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-stone-800 mb-8">Contact</h1>

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">Pam Palmer</h2>
              <p className="text-stone-600">The Villages, FL USA</p>
            </div>

            <div>
              <p className="text-stone-600">
                <span className="font-medium">Email:</span>{' '}
                <a
                  href="mailto:pamncharlie@gmail.com"
                  className="text-rose-600 hover:text-rose-700"
                >
                  pamncharlie@gmail.com
                </a>
              </p>
            </div>
          </div>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-stone-500">
          Pam&apos;s Custom Quilts
        </div>
      </footer>
    </div>
  )
}
