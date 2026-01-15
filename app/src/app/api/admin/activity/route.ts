import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/activity - Get admin activity logs with filters
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
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
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('created_at', endDate.toISOString())
  }

  // Execute with pagination
  const { data: logs, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity logs', details: error.message },
      { status: 500 }
    )
  }

  // Get unique action types for filter dropdown
  const { data: actionTypes } = await serviceClient
    .from('admin_activity_log')
    .select('action_type')

  const uniqueActionTypes = [
    ...new Set(actionTypes?.map((a) => a.action_type) || []),
  ].sort()

  // Get admins who have activity for filter dropdown
  const { data: adminsWithActivity } = await serviceClient
    .from('admin_activity_log')
    .select('admin_id, profiles!admin_id(email)')

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
}
