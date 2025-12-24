import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = 'voyage-multimodal-3'

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 50 } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    if (!VOYAGE_API_KEY) {
      return NextResponse.json(
        { error: 'Search service not configured' },
        { status: 500 }
      )
    }

    // Embed the text query using Voyage AI
    const embeddingResponse = await fetch('https://api.voyageai.com/v1/multimodalembeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        inputs: [[{ type: 'text', text: query }]],
        input_type: 'query',  // This is a search query
      }),
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      console.error('Voyage API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to process search query' },
        { status: 500 }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for similar patterns using pgvector
    const supabase = await createClient()

    const { data: patterns, error } = await supabase.rpc('search_patterns_semantic', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,  // Lower threshold to get more results
      match_count: limit,
    })

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      patterns: patterns || [],
      query,
      count: patterns?.length || 0,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'An error occurred while searching' },
      { status: 500 }
    )
  }
}
