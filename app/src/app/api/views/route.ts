import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { pattern_id } = await request.json()

    if (!pattern_id || typeof pattern_id !== 'number') {
      return NextResponse.json({ error: 'Invalid pattern_id' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Don't log anonymous views, but don't error either
      return NextResponse.json({ success: true, logged: false })
    }

    // Log the view
    const { error } = await supabase
      .from('view_logs')
      .insert({ user_id: user.id, pattern_id })

    if (error) {
      console.error('Failed to log view:', error)
      // Don't expose error to client, just indicate it wasn't logged
      return NextResponse.json({ success: true, logged: false })
    }

    return NextResponse.json({ success: true, logged: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
