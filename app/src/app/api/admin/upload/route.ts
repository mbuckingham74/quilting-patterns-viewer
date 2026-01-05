import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

// Supported file extensions
const PATTERN_EXTENSIONS = new Set(['.qli'])
const PDF_EXTENSION = '.pdf'

// POST /api/admin/upload - Upload patterns from ZIP file
export async function POST(request: NextRequest) {
  // Use anon client for auth check (respects user session)
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

  // Use service-role client for storage/DB operations (bypasses RLS)
  let serviceClient
  try {
    serviceClient = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // Get the uploaded file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a ZIP archive' }, { status: 400 })
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Catalog files by normalized pattern name
    const patterns: Map<string, { qli?: string; pdf?: string }> = new Map()

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue

      const filename = path.split('/').pop() || ''
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
      const baseName = filename.substring(0, filename.lastIndexOf('.')).toLowerCase()

      if (PATTERN_EXTENSIONS.has(ext)) {
        const existing = patterns.get(baseName) || {}
        existing.qli = path
        patterns.set(baseName, existing)
      } else if (ext === PDF_EXTENSION) {
        const existing = patterns.get(baseName) || {}
        existing.pdf = path
        patterns.set(baseName, existing)
      }
    }

    // Filter to patterns with QLI files
    const validPatterns = Array.from(patterns.entries())
      .filter(([_, files]) => files.qli)
      .map(([name, files]) => ({ name, ...files }))

    if (validPatterns.length === 0) {
      return NextResponse.json({
        error: 'No QLI pattern files found in ZIP',
        details: 'ZIP must contain .qli files'
      }, { status: 400 })
    }

    // Get existing pattern names for duplicate detection (use service client for full access)
    const existingNames = await getExistingPatternNames(serviceClient)

    // Filter out duplicates
    const newPatterns = validPatterns.filter(p => !existingNames.has(p.name))
    const duplicates = validPatterns.filter(p => existingNames.has(p.name))

    if (newPatterns.length === 0) {
      return NextResponse.json({
        success: true,
        uploaded: [],
        skipped: duplicates.map(p => ({ name: p.name, reason: 'Duplicate' })),
        summary: {
          total: validPatterns.length,
          uploaded: 0,
          skipped: duplicates.length,
          errors: 0
        }
      })
    }

    // Process each new pattern
    const uploaded: Array<{ id: number; name: string; hasThumbnail: boolean }> = []
    const errors: Array<{ name: string; error: string }> = []

    for (const pattern of newPatterns) {
      try {
        // Read QLI file
        const qliData = await zip.file(pattern.qli!)!.async('uint8array')
        const qliSize = qliData.length

        // Extract author info from QLI
        const authorInfo = extractAuthorFromQli(qliData)

        // Create display name
        const displayName = pattern.name.replace(/-/g, ' ').replace(/_/g, ' ')
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

        // Insert pattern record first to get DB-assigned ID (prevents race conditions)
        const { data: insertedPattern, error: insertError } = await serviceClient
          .from('patterns')
          .insert({
            // id is auto-assigned by sequence
            file_name: `${pattern.name}.qli`,
            file_extension: 'qli',
            file_size: qliSize,
            author: authorInfo.author,
            author_url: authorInfo.authorUrl,
            author_notes: authorInfo.authorNotes,
            notes: displayName,
            thumbnail_url: null, // Will update after storage upload
            pattern_file_url: null, // Will update after storage upload
          })
          .select('id')
          .single()

        if (insertError || !insertedPattern) {
          throw insertError || new Error('Failed to create pattern record')
        }

        const patternId = insertedPattern.id

        // Upload pattern file (no upsert - fail if collision)
        const patternPath = `${patternId}.qli`
        const { error: patternUploadError } = await serviceClient.storage
          .from('patterns')
          .upload(patternPath, qliData, {
            contentType: 'application/octet-stream',
            upsert: false, // Fail on collision instead of silent overwrite
          })

        if (patternUploadError) {
          // Clean up the DB record if storage upload failed
          await serviceClient.from('patterns').delete().eq('id', patternId)
          throw patternUploadError
        }

        // Generate thumbnail from PDF if available
        let thumbnailUrl: string | null = null
        if (pattern.pdf) {
          try {
            const pdfData = await zip.file(pattern.pdf)!.async('uint8array')
            const thumbnailData = await renderPdfToThumbnail(pdfData)

            if (thumbnailData) {
              // Upload thumbnail (no upsert)
              const thumbPath = `${patternId}.png`
              const { error: thumbError } = await serviceClient.storage
                .from('thumbnails')
                .upload(thumbPath, thumbnailData, {
                  contentType: 'image/png',
                  upsert: false,
                })

              if (!thumbError) {
                thumbnailUrl = serviceClient.storage.from('thumbnails').getPublicUrl(thumbPath).data.publicUrl
              }
            }
          } catch (e) {
            console.warn(`Could not generate thumbnail for ${pattern.name}:`, e)
          }
        }

        // Update pattern with storage URLs
        await serviceClient.from('patterns').update({
          thumbnail_url: thumbnailUrl,
          pattern_file_url: patternPath,
        }).eq('id', patternId)

        uploaded.push({
          id: patternId,
          name: pattern.name,
          hasThumbnail: thumbnailUrl !== null
        })

      } catch (e) {
        console.error(`Error processing ${pattern.name}:`, e)
        errors.push({
          name: pattern.name,
          error: e instanceof Error ? e.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      skipped: duplicates.map(p => ({ name: p.name, reason: 'Duplicate' })),
      errors,
      summary: {
        total: validPatterns.length,
        uploaded: uploaded.length,
        skipped: duplicates.length,
        errors: errors.length
      }
    })

  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({
      error: 'Failed to process upload',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper: Get existing pattern names for duplicate detection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExistingPatternNames(supabase: any): Promise<Set<string>> {
  const existing = new Set<string>()
  let offset = 0
  const batchSize = 1000

  while (true) {
    const { data } = await supabase
      .from('patterns')
      .select('file_name')
      .range(offset, offset + batchSize - 1)

    if (!data || data.length === 0) break

    for (const row of data) {
      if (row.file_name) {
        // Normalize: lowercase, remove extension
        const name = row.file_name.replace(/\.[^.]+$/, '').toLowerCase()
        existing.add(name)
      }
    }

    if (data.length < batchSize) break
    offset += batchSize
  }

  return existing
}

// Helper: Extract author info from QLI file content
function extractAuthorFromQli(qliData: Uint8Array): {
  author: string | null
  authorUrl: string | null
  authorNotes: string | null
} {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(qliData)
  const result: { author: string | null; authorUrl: string | null; authorNotes: string | null } = {
    author: null,
    authorUrl: null,
    authorNotes: null
  }

  const infoLines: string[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('NO INFO')) {
      const infoText = trimmed.substring(7).trim()
      infoLines.push(infoText)

      // Check for URL
      if (infoText.toLowerCase().includes('www.') || infoText.toLowerCase().includes('http')) {
        const urlMatch = infoText.match(/(?:https?:\/\/)?(?:www\.)?([^\s]+\.[^\s]+)/i)
        if (urlMatch) {
          let url = urlMatch[0]
          if (!url.startsWith('http')) {
            url = 'https://' + url
          }
          result.authorUrl = url
        }
      }

      // Check for author name
      const byMatch = infoText.match(/(?:designed|copyrighted)\s+by\s+(.+)/i)
      if (byMatch && !result.author) {
        result.author = byMatch[1].trim()
      }
    }
  }

  if (infoLines.length > 0) {
    result.authorNotes = infoLines.join('\n')
  }

  return result
}

// Helper: Render PDF to thumbnail
// Note: This is a simplified version - PDF rendering in Node.js is complex
// For now, we return null and let patterns without PDFs use a placeholder
// A more robust solution would use pdf-lib or a headless browser
async function renderPdfToThumbnail(pdfData: Uint8Array): Promise<Uint8Array | null> {
  // PDF rendering in pure Node.js is complex
  // Options:
  // 1. Use pdf-lib (can't render to image, only manipulate PDFs)
  // 2. Use pdfjs-dist (complex setup, needs canvas)
  // 3. Use sharp with PDF support (requires libvips with poppler)
  // 4. Call external tool like pdftoppm
  //
  // For now, we'll skip thumbnail generation in the web API
  // and rely on the local Python script for full functionality
  //
  // TODO: Implement proper PDF rendering or use a service
  return null
}

// Configure for larger uploads
export const config = {
  api: {
    bodyParser: false, // We handle form data ourselves
  },
}
