import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminActivity, ActivityAction } from '@/lib/activity-log'
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/api-response'
import { logError } from '@/lib/errors'
import JSZip from 'jszip'

// POST /api/admin/reprocess-thumbnails
// Upload a ZIP to match PDFs to existing patterns (by filename) and generate thumbnails
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

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
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return badRequest('No file provided')
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return badRequest('File must be a ZIP archive')
    }

    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Find all PDFs in the ZIP
    const pdfs: Map<string, string> = new Map() // normalized name -> zip path
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue
      const filename = path.split('/').pop() || ''
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
      if (ext === '.pdf') {
        const baseName = filename.substring(0, filename.lastIndexOf('.')).toLowerCase()
        pdfs.set(baseName, path)
      }
    }

    if (pdfs.size === 0) {
      return badRequest('No PDF files found in ZIP')
    }

    // Get patterns without thumbnails
    const { data: patterns, error: fetchError } = await serviceClient
      .from('patterns')
      .select('id, file_name, thumbnail_url')
      .is('thumbnail_url', null)

    if (fetchError) {
      return internalError(fetchError, { action: 'fetch_patterns_without_thumbnails' })
    }

    if (!patterns || patterns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No patterns without thumbnails found',
        processed: 0
      })
    }

    // Match patterns to PDFs
    const results = {
      processed: [] as Array<{ id: number; name: string }>,
      notFound: [] as string[],
      errors: [] as Array<{ id: number; name: string; error: string }>
    }

    for (const pattern of patterns) {
      const baseName = pattern.file_name.replace(/\.[^.]+$/, '').toLowerCase()
      const pdfPath = pdfs.get(baseName)

      if (!pdfPath) {
        results.notFound.push(pattern.file_name)
        continue
      }

      try {
        const pdfData = await zip.file(pdfPath)!.async('uint8array')

        // Save PDF to storage
        const storagePdfPath = `${pattern.id}.pdf`
        await serviceClient.storage
          .from('patterns')
          .upload(storagePdfPath, pdfData, {
            contentType: 'application/pdf',
            upsert: true, // Overwrite if exists
          })

        // Generate thumbnail
        const thumbnailData = await renderPdfToThumbnail(pdfData)

        if (thumbnailData) {
          const thumbPath = `${pattern.id}.png`
          const { error: thumbError } = await serviceClient.storage
            .from('thumbnails')
            .upload(thumbPath, thumbnailData, {
              contentType: 'image/png',
              upsert: true,
            })

          if (!thumbError) {
            const thumbnailUrl = serviceClient.storage.from('thumbnails').getPublicUrl(thumbPath).data.publicUrl

            await serviceClient.from('patterns').update({
              thumbnail_url: thumbnailUrl
            }).eq('id', pattern.id)

            results.processed.push({ id: pattern.id, name: pattern.file_name })
          } else {
            results.errors.push({ id: pattern.id, name: pattern.file_name, error: thumbError.message })
          }
        } else {
          results.errors.push({ id: pattern.id, name: pattern.file_name, error: 'Thumbnail generation failed' })
        }
      } catch (e) {
        results.errors.push({
          id: pattern.id,
          name: pattern.file_name,
          error: e instanceof Error ? e.message : 'Unknown error'
        })
      }
    }

    // Log the activity
    await logAdminActivity({
      adminId: user.id,
      action: ActivityAction.THUMBNAILS_REPROCESS,
      targetType: 'batch',
      description: `Reprocessed thumbnails from ${file.name}: ${results.processed.length} processed, ${results.notFound.length} not found, ${results.errors.length} errors`,
      details: {
        zip_filename: file.name,
        processed: results.processed.length,
        not_found: results.notFound.length,
        errors: results.errors.length,
        processed_ids: results.processed.map(p => p.id),
      },
    })

    return NextResponse.json({
      success: true,
      processed: results.processed.length,
      notFound: results.notFound.length,
      errors: results.errors.length,
      details: results
    })

  } catch (error) {
    logError(error, { action: 'reprocess_thumbnails' })
    return internalError(error, { action: 'reprocess_thumbnails' })
  }
}

// Same thumbnail generation function as upload route
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
