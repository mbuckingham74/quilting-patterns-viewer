import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchThumbnailAsBase64 } from '@/lib/safe-fetch'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  internalError,
  serviceUnavailable,
  withErrorHandler,
} from '@/lib/api-response'

interface VerifyRequest {
  pattern_id_1: number
  pattern_id_2: number
}

interface AIVerificationResult {
  are_duplicates: boolean
  confidence: 'high' | 'medium' | 'low'
  recommendation: 'keep_first' | 'keep_second' | 'keep_both' | 'needs_human_review'
  reasoning: string
  quality_comparison: {
    pattern_1: string
    pattern_2: string
  }
}

interface AnthropicMessage {
  content: Array<{
    type: string
    text?: string
  }>
}

// POST /api/admin/duplicates/ai-verify - Use AI to verify if patterns are duplicates
export const POST = withErrorHandler(async (request: Request) => {
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
    return internalError(adminProfileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!adminProfile?.is_admin) {
    return forbidden()
  }

  // Check for API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    logError(new Error('ANTHROPIC_API_KEY not configured'), { action: 'ai_verify_config' })
    return serviceUnavailable('AI verification not available')
  }

  // Parse request body
  let body: VerifyRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { pattern_id_1, pattern_id_2 } = body

  if (!pattern_id_1 || !pattern_id_2) {
    return badRequest('Missing pattern IDs')
  }

  // Fetch pattern data including thumbnails
  const { data: patterns, error: fetchError } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, author, author_notes, notes, thumbnail_url')
    .in('id', [pattern_id_1, pattern_id_2])

  if (fetchError) {
    return internalError(fetchError, { action: 'fetch_patterns_for_ai_verify', pattern_id_1, pattern_id_2 })
  }

  if (!patterns || patterns.length !== 2) {
    return notFound('Patterns not found')
  }

  const pattern1 = patterns.find(p => p.id === pattern_id_1)!
  const pattern2 = patterns.find(p => p.id === pattern_id_2)!

  // Download both thumbnails with SSRF protection
  const [thumbnail1, thumbnail2] = await Promise.all([
    fetchThumbnailAsBase64(pattern1.thumbnail_url),
    fetchThumbnailAsBase64(pattern2.thumbnail_url)
  ])

  if (!thumbnail1 || !thumbnail2) {
    return badRequest('Failed to download thumbnails')
  }

  // Call Claude Vision API using native fetch
  const prompt = `You are analyzing two quilting pattern thumbnails to determine if they are duplicates and which one to keep.

PATTERN 1 (ID: ${pattern1.id}):
- File name: ${pattern1.file_name || 'Unknown'}
- Author: ${pattern1.author || 'Unknown'}
- File type: ${pattern1.file_extension || 'Unknown'}
- Notes: ${pattern1.notes || 'None'}
- Author notes: ${pattern1.author_notes || 'None'}

PATTERN 2 (ID: ${pattern2.id}):
- File name: ${pattern2.file_name || 'Unknown'}
- Author: ${pattern2.author || 'Unknown'}
- File type: ${pattern2.file_extension || 'Unknown'}
- Notes: ${pattern2.notes || 'None'}
- Author notes: ${pattern2.author_notes || 'None'}

Please analyze these two pattern images and determine:

1. Are they duplicates? (Same or nearly identical design)
2. If duplicates, which should be kept based on:
   - Image quality (sharpness, line clarity, contrast)
   - Completeness (full pattern vs. partial)
   - Better metadata (more descriptive name, author info)
   - Proper orientation

If the patterns are similar but have meaningful differences (e.g., different sizes, variations), they may both be worth keeping.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "are_duplicates": true/false,
  "confidence": "high" | "medium" | "low",
  "recommendation": "keep_first" | "keep_second" | "keep_both" | "needs_human_review",
  "reasoning": "Brief explanation of your analysis",
  "quality_comparison": {
    "pattern_1": "Brief quality assessment of first pattern",
    "pattern_2": "Brief quality assessment of second pattern"
  }
}`

  try {
    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: thumbnail1
              }
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: thumbnail2
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return internalError(new Error(`Claude API error: ${response.status}`), {
        action: 'ai_verify_request',
        status: response.status,
        response: errorText,
      })
    }

    const aiResponse: AnthropicMessage = await response.json()
    const textContent = aiResponse.content.find(c => c.type === 'text')

    if (!textContent || !textContent.text) {
      throw new Error('No text response from AI')
    }

    let result: AIVerificationResult
    try {
      let text = textContent.text.trim()
      // Handle potential markdown code blocks
      if (text.startsWith('```')) {
        text = text.split('```')[1]
        if (text.startsWith('json')) {
          text = text.slice(4)
        }
      }
      result = JSON.parse(text.trim())
    } catch (parseError) {
      return internalError(parseError, { action: 'ai_verify_parse_response', raw: textContent.text })
    }

    return NextResponse.json({
      pattern_id_1,
      pattern_id_2,
      verification: result,
      patterns: {
        pattern_1: {
          id: pattern1.id,
          file_name: pattern1.file_name,
          author: pattern1.author,
          file_extension: pattern1.file_extension
        },
        pattern_2: {
          id: pattern2.id,
          file_name: pattern2.file_name,
          author: pattern2.author,
          file_extension: pattern2.file_extension
        }
      }
    })

  } catch (aiError) {
    return internalError(aiError, { action: 'ai_verify' })
  }
})
