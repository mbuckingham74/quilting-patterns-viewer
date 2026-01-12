import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import sharp from 'sharp'

type TransformOperation = 'rotate_cw' | 'rotate_ccw' | 'rotate_180' | 'flip_h' | 'flip_v'

interface TransformRequest {
  operation: TransformOperation
}

// POST /api/admin/patterns/[id]/transform - Transform pattern thumbnail
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Parse request body
  let body: TransformRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { operation } = body
  const validOperations: TransformOperation[] = ['rotate_cw', 'rotate_ccw', 'rotate_180', 'flip_h', 'flip_v']
  if (!validOperations.includes(operation)) {
    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
  }

  // Get pattern info
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id, thumbnail_url')
    .eq('id', patternId)
    .single()

  if (patternError || !pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  if (!pattern.thumbnail_url) {
    return NextResponse.json({ error: 'Pattern has no thumbnail' }, { status: 400 })
  }

  try {
    // Download the current thumbnail
    const thumbnailResponse = await fetch(pattern.thumbnail_url)
    if (!thumbnailResponse.ok) {
      throw new Error('Failed to download thumbnail')
    }
    const imageBuffer = Buffer.from(await thumbnailResponse.arrayBuffer())

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
      console.error('Upload error:', uploadError)
      throw new Error('Failed to upload transformed thumbnail')
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
      console.error('Update error:', updateError)
      throw new Error('Failed to update pattern')
    }

    return NextResponse.json({
      success: true,
      message: `Thumbnail ${operation.replace('_', ' ')} successfully`,
      thumbnail_url: newThumbnailUrl,
      embedding_cleared: true,
    })
  } catch (error) {
    console.error('Transform error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to transform thumbnail' },
      { status: 500 }
    )
  }
}
