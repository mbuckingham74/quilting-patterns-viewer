/**
 * Generate embeddings for patterns using Voyage AI multimodal model.
 * This module handles generating vector embeddings for pattern thumbnails
 * to enable semantic search (e.g., "butterflies with flowers").
 */

import { createServiceClient } from './supabase/server'

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/multimodal/embed'
const VOYAGE_MODEL = 'voyage-multimodal-3'

interface Pattern {
  id: number
  thumbnail_url: string | null
}

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[] }>
  usage: { total_tokens: number }
}

/**
 * Generate embedding for a single image using Voyage AI
 */
async function generateEmbedding(
  imageBase64: string,
  apiKey: string
): Promise<number[] | null> {
  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        inputs: [[{ type: 'image', data: imageBase64, encoding: 'base64' }]],
        input_type: 'document',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Voyage API error:', error)
      return null
    }

    const result = (await response.json()) as VoyageEmbeddingResponse
    return result.data[0]?.embedding || null
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

/**
 * Download image and convert to base64
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Error downloading image:', error)
    return null
  }
}

/**
 * Generate embeddings for patterns that don't have them yet.
 * Can optionally filter to specific pattern IDs.
 *
 * @param patternIds - Optional array of pattern IDs to process. If not provided, processes all patterns without embeddings.
 * @returns Object with counts of processed and errored patterns
 */
export async function generateEmbeddingsForPatterns(
  patternIds?: number[]
): Promise<{ processed: number; errors: number }> {
  const voyageApiKey = process.env.VOYAGE_API_KEY

  if (!voyageApiKey) {
    console.error('VOYAGE_API_KEY not configured - skipping embedding generation')
    return { processed: 0, errors: 0 }
  }

  const serviceClient = createServiceClient()

  // Build query for patterns without embeddings
  let query = serviceClient
    .from('patterns')
    .select('id, thumbnail_url')
    .is('embedding', null)
    .not('thumbnail_url', 'is', null)
    .order('id', { ascending: true })
    .limit(100) // Process in batches to avoid timeout

  // If specific pattern IDs provided, filter to those
  if (patternIds && patternIds.length > 0) {
    query = query.in('id', patternIds)
  }

  const { data: patterns, error: fetchError } = await query

  if (fetchError) {
    console.error('Error fetching patterns:', fetchError)
    return { processed: 0, errors: 0 }
  }

  if (!patterns || patterns.length === 0) {
    console.log('No patterns need embeddings')
    return { processed: 0, errors: 0 }
  }

  console.log(`Generating embeddings for ${patterns.length} patterns...`)

  let processed = 0
  let errors = 0

  for (const pattern of patterns as Pattern[]) {
    if (!pattern.thumbnail_url) continue

    try {
      // Download thumbnail
      const imageBase64 = await downloadImageAsBase64(pattern.thumbnail_url)
      if (!imageBase64) {
        console.error(`Failed to download thumbnail for pattern ${pattern.id}`)
        errors++
        continue
      }

      // Generate embedding
      const embedding = await generateEmbedding(imageBase64, voyageApiKey)
      if (!embedding) {
        console.error(`Failed to generate embedding for pattern ${pattern.id}`)
        errors++
        continue
      }

      // Update pattern with embedding
      const { error: updateError } = await serviceClient
        .from('patterns')
        .update({ embedding })
        .eq('id', pattern.id)

      if (updateError) {
        console.error(`Failed to save embedding for pattern ${pattern.id}:`, updateError)
        errors++
        continue
      }

      processed++
      console.log(`Generated embedding for pattern ${pattern.id} (${processed}/${patterns.length})`)

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`Error processing pattern ${pattern.id}:`, error)
      errors++
    }
  }

  console.log(`Embedding generation complete: ${processed} processed, ${errors} errors`)
  return { processed, errors }
}

/**
 * Generate embeddings for patterns in a specific batch.
 * Called after a batch is committed.
 *
 * @param batchId - The upload batch ID
 */
export async function generateEmbeddingsForBatch(batchId: number): Promise<void> {
  const serviceClient = createServiceClient()

  // Get pattern IDs in this batch
  const { data: patterns, error } = await serviceClient
    .from('patterns')
    .select('id')
    .eq('upload_batch_id', batchId)
    .is('embedding', null)
    .not('thumbnail_url', 'is', null)

  if (error || !patterns || patterns.length === 0) {
    console.log(`No patterns need embeddings in batch ${batchId}`)
    return
  }

  const patternIds = patterns.map((p) => p.id)
  console.log(`Generating embeddings for ${patternIds.length} patterns in batch ${batchId}`)

  await generateEmbeddingsForPatterns(patternIds)
}
