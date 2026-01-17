import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, withErrorHandler } from '@/lib/api-response'

// GET /api/admin/activity - Get admin activity logs with filters
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 100)
  const actionType = searchParams.get('action') || null
  const targetType = searchParams.get('target') || null
  const adminId = searchParams.get('admin_id') || null
  const dateFrom = searchParams.get('date_from') || null
  const dateTo = searchParams.get('date_to') || null

  const offset = (page - 1) * limit

  const serviceClient = createServiceClient()

  // Build query with filters
  let query = serviceClient
    .from('admin_activity_log')
    .select(
      `
      *,
      profiles!admin_id(email, display_name)
    `,
      { count: 'exact' }
    )

  if (actionType) {
    query = query.eq('action_type', actionType)
  }
  if (targetType) {
    query = query.eq('target_type', targetType)
  }
  if (adminId) {
    query = query.eq('admin_id', adminId)
  }
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    // Add one day to include the entire end date
    const endDate = new Date(dateTo)
    if (!isNaN(endDate.getTime())) {
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('created_at', endDate.toISOString())
    }
  }

  // Execute with pagination
  const { data: logs, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return internalError(error, { action: 'fetch_activity_logs' })
  }

  // Get unique action types for filter dropdown
  const { data: actionTypes, error: actionTypesError } = await serviceClient
    .from('admin_activity_log')
    .select('action_type')

  if (actionTypesError) {
    return internalError(actionTypesError, { action: 'fetch_activity_action_types' })
  }

  const uniqueActionTypes = [
    ...new Set(actionTypes?.map((a) => a.action_type) || []),
  ].sort()

  // Get admins who have activity for filter dropdown
  const { data: adminsWithActivity, error: adminsWithActivityError } = await serviceClient
    .from('admin_activity_log')
    .select('admin_id, profiles!admin_id(email)')

  if (adminsWithActivityError) {
    return internalError(adminsWithActivityError, { action: 'fetch_activity_admins' })
  }

  const adminMap = new Map<string, { id: string; email: string }>()
  adminsWithActivity?.forEach((a) => {
    // profiles can be an object or array depending on Supabase's type inference
    const profileData = a.profiles as { email: string } | { email: string }[] | null
    const email = Array.isArray(profileData) ? profileData[0]?.email : profileData?.email
    if (a.admin_id && email) {
      adminMap.set(a.admin_id, { id: a.admin_id, email })
    }
  })
  const uniqueAdmins = Array.from(adminMap.values())

  return NextResponse.json({
    logs: logs || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
    filters: {
      actionTypes: uniqueActionTypes,
      admins: uniqueAdmins,
    },
  })
})
