import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/errors'
import { badRequest, withErrorHandler } from '@/lib/api-response'

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: { pattern_id?: number }
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { pattern_id } = body
  try {
    if (!pattern_id || typeof pattern_id !== 'number') {
      return badRequest('Invalid pattern_id')
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
      logError(error, { action: 'log_view', patternId: pattern_id, userId: user.id })
      // Don't expose error to client, just indicate it wasn't logged
      return NextResponse.json({ success: true, logged: false })
    }

    return NextResponse.json({ success: true, logged: true })
  } catch (error) {
    logError(error, { action: 'log_view', patternId: pattern_id })
    return NextResponse.json({ success: true, logged: false })
  }
})
