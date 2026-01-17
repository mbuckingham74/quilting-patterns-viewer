import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchThumbnailSafe } from '@/lib/safe-fetch'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'
import sharp from 'sharp'

type TransformOperation = 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v'

interface TransformRequest {
  operation: TransformOperation
}

// POST /api/admin/patterns/[id]/transform - Transform pattern thumbnail
export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminProfileError && !isSupabaseNoRowError(adminProfileError)) {
    logError(adminProfileError, { action: 'fetch_profile', userId: user.id })
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Parse request body
  let body: TransformRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { operation } = body
  const validOperations: TransformOperation[] = ['rotate_cw', 'rotate_ccw', 'rotate_180', 'flip_h', 'flip_v']
  if (!validOperations.includes(operation)) {
    return badRequest('Invalid operation')
  }

  // Get pattern info
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id, thumbnail_url')
    .eq('id', patternId)
    .single()

  if (patternError) {
    if (isSupabaseNoRowError(patternError)) {
      return notFound('Pattern not found')
    }
    return internalError(patternError, { action: 'fetch_pattern', patternId })
  }

  if (!pattern) {
    return notFound('Pattern not found')
  }

  if (!pattern.thumbnail_url) {
    return badRequest('Pattern has no thumbnail')
  }

  try {
    // Download the current thumbnail with SSRF protection
    const imageBuffer = await fetchThumbnailSafe(pattern.thumbnail_url)

    // Apply transformation using sharp
    let transformer = sharp(imageBuffer)

    switch (operation) {
      case 'rotate_cw':
        transformer = transformer.rotate(90)
        break
      case 'rotate_ccw':
        transformer = transformer.rotate(-90)
        break
      case 'rotate_180':
        transformer = transformer.rotate(180)
        break
      case 'flip_h':
        transformer = transformer.flop() // horizontal flip
        break
      case 'flip_v':
        transformer = transformer.flip() // vertical flip
        break
    }

    // Convert to PNG
    const transformedBuffer = await transformer.png().toBuffer()

    // Upload the transformed image back to Supabase Storage
    // Use service client to bypass RLS for storage operations
    const serviceClient = createServiceClient()
    const storagePath = `${patternId}.png`

    const { error: uploadError } = await serviceClient.storage
      .from('thumbnails')
      .upload(storagePath, transformedBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return internalError(uploadError, { action: 'upload_transformed_thumbnail', patternId })
    }

    // Get the new public URL (with cache buster)
    const { data: urlData } = serviceClient.storage
      .from('thumbnails')
      .getPublicUrl(storagePath)

    const newThumbnailUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // Update the pattern with the new thumbnail URL
    const { error: updateError } = await supabase
      .from('patterns')
      .update({
        thumbnail_url: urlData.publicUrl,
        // Clear the embedding since the visual changed
        embedding: null
      })
      .eq('id', patternId)

    if (updateError) {
      return internalError(updateError, { action: 'update_pattern_thumbnail', patternId })
    }

    // Log the activity
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.PATTERN_TRANSFORM,
      targetType: 'pattern',
      targetId: patternId,
      description: `Transformed thumbnail: ${operation.replace('_', ' ')}`,
      details: { operation },
    })

    return NextResponse.json({
      success: true,
      message: `Thumbnail ${operation.replace('_', ' ')} successfully`,
      thumbnail_url: newThumbnailUrl,
      embedding_cleared: true,
    })
  } catch (error) {
    return internalError(error, { action: 'transform_thumbnail', patternId })
  }
})
