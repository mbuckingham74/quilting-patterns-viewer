import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

// Supported file extensions
const PATTERN_EXTENSIONS = new Set(['.qli'])
const PDF_EXTENSION = '.pdf'

// POST /api/admin/upload - Upload patterns from ZIP file
// Supports staged mode: patterns go to review before being visible in browse
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
  let serviceClient: ReturnType<typeof createServiceClient>
  try {
    serviceClient = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // Get the uploaded file and staging option
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const stagedParam = formData.get('staged')
    // Default to staged mode (true) unless explicitly set to 'false'
    const isStaged = stagedParam !== 'false'

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

    // Create upload log first to get batch ID (for staged uploads)
    let batchId: number | null = null
    if (isStaged && newPatterns.length > 0) {
      const { data: uploadLog, error: logError } = await serviceClient
        .from('upload_logs')
        .insert({
          zip_filename: file.name,
          uploaded_by: user.id,
          total_patterns: validPatterns.length,
          uploaded_count: 0, // Will update after processing
          skipped_count: duplicates.length,
          error_count: 0,
          uploaded_patterns: [],
          skipped_patterns: duplicates.map(p => ({ name: p.name, reason: 'Duplicate' })),
          error_patterns: [],
          status: 'staged',
        })
        .select('id')
        .single()

      if (logError || !uploadLog) {
        console.error('Failed to create upload log:', logError)
        return NextResponse.json({ error: 'Failed to initialize upload batch' }, { status: 500 })
      }
      batchId = uploadLog.id
    }

    // Process each new pattern
    const uploaded: Array<{
      id: number
      name: string
      hasThumbnail: boolean
      thumbnailUrl: string | null
      fileSize: number
      author: string | null
    }> = []
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
            is_staged: isStaged,
            upload_batch_id: batchId,
          })
          .select('id')
          .single()

        if (insertError || !insertedPattern) {
          // If migration 011 hasn't been applied, id column has no default and insert fails
          const errorMsg = insertError?.message || 'Failed to create pattern record'
          if (errorMsg.includes('null value') && errorMsg.includes('id')) {
            throw new Error('Database migration required: run 011_pattern_id_sequence.sql')
          }
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
        const { error: updateError } = await serviceClient.from('patterns').update({
          thumbnail_url: thumbnailUrl,
          pattern_file_url: patternPath,
        }).eq('id', patternId)

        if (updateError) {
          // Storage uploads succeeded but DB update failed - pattern is in inconsistent state
          // Clean up storage files and DB record
          await serviceClient.storage.from('patterns').remove([patternPath])
          if (thumbnailUrl) {
            await serviceClient.storage.from('thumbnails').remove([`${patternId}.png`])
          }
          await serviceClient.from('patterns').delete().eq('id', patternId)
          throw new Error(`Failed to update pattern URLs: ${updateError.message}`)
        }

        uploaded.push({
          id: patternId,
          name: pattern.name,
          hasThumbnail: thumbnailUrl !== null,
          thumbnailUrl,
          fileSize: qliSize,
          author: authorInfo.author
        })

      } catch (e) {
        console.error(`Error processing ${pattern.name}:`, e)
        errors.push({
          name: pattern.name,
          error: e instanceof Error ? e.message : 'Unknown error'
        })
      }
    }

    // Save or update upload log
    const skippedPatterns = duplicates.map(p => ({ name: p.name, reason: 'Duplicate' }))

    if (isStaged && batchId) {
      // Update the existing staged upload log with results
      try {
        await serviceClient.from('upload_logs').update({
          uploaded_count: uploaded.length,
          error_count: errors.length,
          uploaded_patterns: uploaded,
          error_patterns: errors,
        }).eq('id', batchId)
      } catch (logError) {
        console.error('Failed to update upload log:', logError)
      }
    } else {
      // Create a committed upload log (non-staged mode)
      try {
        await serviceClient.from('upload_logs').insert({
          zip_filename: file.name,
          uploaded_by: user.id,
          total_patterns: validPatterns.length,
          uploaded_count: uploaded.length,
          skipped_count: duplicates.length,
          error_count: errors.length,
          uploaded_patterns: uploaded,
          skipped_patterns: skippedPatterns,
          error_patterns: errors,
          status: 'committed',
        })
      } catch (logError) {
        console.error('Failed to save upload log:', logError)
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      skipped: skippedPatterns,
      errors,
      summary: {
        total: validPatterns.length,
        uploaded: uploaded.length,
        skipped: duplicates.length,
        errors: errors.length
      },
      // Include batch info for staged uploads
      batch_id: batchId,
      is_staged: isStaged,
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

// Configure for larger uploads (App Router format)
// This sets the max request body size for this route
export const maxDuration = 60 // Allow up to 60 seconds for processing large ZIPs
