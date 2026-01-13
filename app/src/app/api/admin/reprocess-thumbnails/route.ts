import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

// POST /api/admin/reprocess-thumbnails
// Upload a ZIP to match PDFs to existing patterns (by filename) and generate thumbnails
export async function POST(request: NextRequest) {
  const supabase = await createClient()

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

  let serviceClient: ReturnType<typeof createServiceClient>
  try {
    serviceClient = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a ZIP archive' }, { status: 400 })
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
      return NextResponse.json({ error: 'No PDF files found in ZIP' }, { status: 400 })
    }

    // Get patterns without thumbnails
    const { data: patterns, error: fetchError } = await serviceClient
      .from('patterns')
      .select('id, file_name, thumbnail_url')
      .is('thumbnail_url', null)

    if (fetchError) {
      throw fetchError
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

    return NextResponse.json({
      success: true,
      processed: results.processed.length,
      notFound: results.notFound.length,
      errors: results.errors.length,
      details: results
    })

  } catch (e) {
    console.error('Reprocess error:', e)
    return NextResponse.json({
      error: 'Failed to process',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
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
