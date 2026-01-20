import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'
import sharp from 'sharp'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// POST /api/admin/patterns/[id]/thumbnail - Upload new thumbnail
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

  // Check if pattern exists
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url')
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

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Invalid form data')
  }

  const file = formData.get('thumbnail')

  // Validate that we received a File object (not a string or other value)
  if (!file || !(file instanceof File)) {
    return badRequest('No thumbnail file provided or invalid file format')
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return badRequest(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return badRequest(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // Read file buffer
  let buffer: Buffer
  try {
    const arrayBuffer = await file.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } catch {
    return badRequest('Failed to read uploaded file')
  }

  // Process with sharp - resize to 600px width to match PDF pipeline quality
  let processedBuffer: Buffer
  try {
    processedBuffer = await sharp(buffer)
      .resize(600, 600, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer()
  } catch (error) {
    // Sharp throws on corrupt/invalid image data
    logError(error, { action: 'decode_thumbnail', patternId, originalName: file.name })
    return badRequest('Invalid or corrupt image file. Please upload a valid PNG, JPEG, WebP, or GIF image.')
  }

  try {
    // Upload to Supabase Storage
    const serviceClient = createServiceClient()
    const storagePath = `${patternId}.png`

    const { error: uploadError } = await serviceClient.storage
      .from('thumbnails')
      .upload(storagePath, processedBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return internalError(uploadError, { action: 'upload_thumbnail', patternId })
    }

    // Get the new public URL
    const { data: urlData } = serviceClient.storage
      .from('thumbnails')
      .getPublicUrl(storagePath)

    const newThumbnailUrl = urlData.publicUrl

    // Update the pattern with the new thumbnail URL and clear embedding
    const { error: updateError } = await supabase
      .from('patterns')
      .update({
        thumbnail_url: newThumbnailUrl,
        // Clear the embedding since the visual changed
        embedding: null
      })
      .eq('id', patternId)

    if (updateError) {
      return internalError(updateError, { action: 'update_pattern_thumbnail', patternId })
    }

    // Log the activity
    const hadPreviousThumbnail = !!pattern.thumbnail_url
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.PATTERN_UPDATE,
      targetType: 'pattern',
      targetId: patternId,
      description: hadPreviousThumbnail
        ? `Replaced thumbnail for pattern ${pattern.file_name || patternId}`
        : `Uploaded thumbnail for pattern ${pattern.file_name || patternId}`,
      details: {
        action: 'thumbnail_upload',
        had_previous: hadPreviousThumbnail,
        original_filename: file.name,
        original_size: file.size,
      },
    })

    return NextResponse.json({
      success: true,
      message: hadPreviousThumbnail ? 'Thumbnail replaced successfully' : 'Thumbnail uploaded successfully',
      thumbnail_url: `${newThumbnailUrl}?t=${Date.now()}`,
      embedding_cleared: true,
    })
  } catch (error) {
    return internalError(error, { action: 'process_thumbnail', patternId })
  }
})
