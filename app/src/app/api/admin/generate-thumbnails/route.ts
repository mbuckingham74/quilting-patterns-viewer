import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { isSupabaseNoRowError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'

// POST /api/admin/generate-thumbnails
// Generate thumbnails from stored PDFs for patterns that have PDFs but no thumbnails
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

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
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  let serviceClient: ReturnType<typeof createServiceClient>
  try {
    serviceClient = createServiceClient()
  } catch (error) {
    return internalError(error, { action: 'create_service_client' })
  }

  try {
    let body: { pattern_ids?: number[] }
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON in request body')
    }

    const { pattern_ids } = body

    if (!Array.isArray(pattern_ids) || pattern_ids.length === 0) {
      return badRequest('pattern_ids must be a non-empty array')
    }

    if (pattern_ids.length > 50) {
      return badRequest('Maximum 50 patterns per request')
    }

    const results = {
      processed: [] as Array<{ id: number; name: string }>,
      failed: [] as Array<{ id: number; name: string; error: string }>,
      noPdf: [] as Array<{ id: number; name: string }>
    }

    // Fetch pattern info
    const { data: patterns, error: fetchError } = await serviceClient
      .from('patterns')
      .select('id, file_name')
      .in('id', pattern_ids)

    if (fetchError) {
      return internalError(fetchError, { action: 'fetch_patterns_for_thumbnails', patternIds: pattern_ids })
    }

    if (!patterns || patterns.length === 0) {
      return notFound('No patterns found')
    }

    for (const pattern of patterns) {
      const pdfPath = `${pattern.id}.pdf`

      // Check if PDF exists in storage
      const { data: pdfData, error: downloadError } = await serviceClient.storage
        .from('patterns')
        .download(pdfPath)

      if (downloadError || !pdfData) {
        results.noPdf.push({ id: pattern.id, name: pattern.file_name })
        continue
      }

      try {
        // Convert blob to Uint8Array
        const pdfBytes = new Uint8Array(await pdfData.arrayBuffer())

        // Generate thumbnail
        const thumbnailData = await renderPdfToThumbnail(pdfBytes)

        if (!thumbnailData) {
          results.failed.push({ id: pattern.id, name: pattern.file_name, error: 'Thumbnail generation failed' })
          continue
        }

        // Upload thumbnail
        const thumbPath = `${pattern.id}.png`
        const { error: uploadError } = await serviceClient.storage
          .from('thumbnails')
          .upload(thumbPath, thumbnailData, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) {
          results.failed.push({ id: pattern.id, name: pattern.file_name, error: uploadError.message })
          continue
        }

        // Update pattern record
        const thumbnailUrl = serviceClient.storage.from('thumbnails').getPublicUrl(thumbPath).data.publicUrl

        const { error: updateError } = await serviceClient
          .from('patterns')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', pattern.id)

        if (updateError) {
          results.failed.push({ id: pattern.id, name: pattern.file_name, error: updateError.message })
          continue
        }

        results.processed.push({ id: pattern.id, name: pattern.file_name })

      } catch (e) {
        results.failed.push({
          id: pattern.id,
          name: pattern.file_name,
          error: e instanceof Error ? e.message : 'Unknown error'
        })
      }
    }

    // Log admin activity
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.THUMBNAILS_REPROCESS,
      targetType: 'batch',
      description: `Generated thumbnails from stored PDFs: ${results.processed.length} processed, ${results.noPdf.length} no PDF, ${results.failed.length} failed`,
      details: {
        source: 'stored_pdfs',
        pattern_ids,
        processed: results.processed.length,
        no_pdf: results.noPdf.length,
        failed: results.failed.length,
        processed_ids: results.processed.map(p => p.id),
      },
    })

    return NextResponse.json({
      success: true,
      processed: results.processed.length,
      noPdf: results.noPdf.length,
      failed: results.failed.length,
      details: results
    })

  } catch (e) {
    return internalError(e, { action: 'generate_thumbnails' })
  }
})

// PDF to thumbnail rendering (same as upload route)
async function renderPdfToThumbnail(pdfData: Uint8Array): Promise<Uint8Array | null> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const fs = await import('fs/promises')
  const path = await import('path')
  const os = await import('os')

  const execAsync = promisify(exec)
  const tmpDir = os.tmpdir()
  const id = Math.random().toString(36).substring(2, 15)
  const pdfPath = path.join(tmpDir, `temp-${id}.pdf`)
  const outPrefix = path.join(tmpDir, `thumb-${id}`)

  try {
    await fs.writeFile(pdfPath, Buffer.from(pdfData))

    try {
      await execAsync(`pdftoppm -png -f 1 -l 1 -scale-to 600 "${pdfPath}" "${outPrefix}"`)
    } catch {
      return null
    }

    const files = await fs.readdir(tmpDir)
    const generatedFile = files.find(f => f.startsWith(`thumb-${id}`) && f.endsWith('.png'))

    if (!generatedFile) {
      return null
    }

    const thumbPath = path.join(tmpDir, generatedFile)
    const thumbnailData = await fs.readFile(thumbPath)
    await fs.unlink(thumbPath).catch(() => {})

    return thumbnailData
  } catch {
    return null
  } finally {
    await fs.unlink(pdfPath).catch(() => {})
  }
}

export const maxDuration = 120
