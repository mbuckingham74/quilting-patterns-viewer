import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'

// Video data organized by month
const videoData = {
  'Month 5': [
    { id: '001', title: 'Unit C Assembly - All Versions', filename: '001 Unit C Assembly - All Versions.mp4' },
    { id: '002', title: 'Unit B Part 1 - All Versions', filename: '002 Unit B Part 1- All Versions.mp4' },
    { id: '003', title: 'Unit B Part 2 - All Versions', filename: '003 Unit B Part 2- All Versions.mp4' },
  ],
  'Month 6': [
    { id: '001', title: 'Unit B Sewn To Larger Unit', filename: '001 Unit B Sewn To Larger Unit.mp4' },
    { id: '002', title: 'Group A Spikes and Double Vein', filename: '002 Group A Spikes and Double Vein.mp4' },
  ],
  'Month 7': [
    { id: '001', title: 'Final Assembly', filename: '001 Final Assembly.mp4' },
  ],
}

// Base URL for video files (served via nginx)
const VIDEO_BASE_URL = 'https://patterns.tachyonfuture.com/videos/educational'

export default async function EducationalVideosPage() {
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h1 className="text-2xl font-bold text-stone-800">Educational Videos</h1>
            <p className="mt-1 text-stone-600">Video tutorials organized by month</p>
          </div>
        </div>

        {/* Video Sections by Month */}
        <div className="space-y-10">
          {Object.entries(videoData).map(([month, videos]) => (
            <section key={month} className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-stone-800">{month}</h2>
                <span className="text-sm text-stone-500">({videos.length} video{videos.length !== 1 ? 's' : ''})</span>
              </div>

              <div className="space-y-4 flex flex-col items-center">
                {videos.map((video, index) => (
                  <div key={video.id} className="border border-stone-200 rounded-lg overflow-hidden w-full max-w-xl">
                    <div className="bg-stone-50 px-3 py-2 border-b border-stone-200">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                          {index + 1}
                        </span>
                        <h3 className="font-medium text-stone-800 text-sm">{video.title}</h3>
                      </div>
                    </div>
                    <div className="aspect-video bg-black">
                      <video
                        controls
                        preload="metadata"
                        className="w-full h-full"
                        poster=""
                      >
                        <source
                          src={`${VIDEO_BASE_URL}/${encodeURIComponent(month)}/${encodeURIComponent(video.filename)}`}
                          type="video/mp4"
                        />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Help Note */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-purple-100 p-6 text-center">
          <p className="text-stone-600">
            Having trouble viewing a video? Make sure you have a stable internet connection.
            <br />
            Contact Michael if videos aren&apos;t loading properly.
          </p>
        </div>
      </div>
    </div>
  )
}
