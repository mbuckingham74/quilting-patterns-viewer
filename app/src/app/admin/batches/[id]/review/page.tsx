import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BatchReviewContent from '@/components/BatchReviewContent'
import { ToastProvider } from '@/components/Toast'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BatchReviewPage({ params }: PageProps) {
  const { id } = await params
  const batchId = parseInt(id, 10)

  if (isNaN(batchId)) {
    redirect('/admin/upload')
  }

  // Check auth and admin status
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/browse')
  }

  // Fetch batch and patterns using service client (bypasses RLS for staged patterns)
  const serviceClient = createServiceClient()

  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('*')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    redirect('/admin/upload')
  }

  // Only allow reviewing staged batches
  if (batch.status !== 'staged') {
    redirect('/admin/upload')
  }

  // Get all patterns in this batch
  const { data: patterns } = await serviceClient
    .from('patterns')
    .select(`
      id,
      file_name,
      file_extension,
      file_size,
      author,
      author_url,
      author_notes,
      notes,
      thumbnail_url,
      pattern_file_url,
      is_staged,
      created_at
    `)
    .eq('upload_batch_id', batchId)
    .order('file_name', { ascending: true })

  // Get keywords for each pattern
  const patternIds = patterns?.map(p => p.id) || []
  let patternKeywords: Record<number, Array<{ id: number; value: string }>> = {}

  if (patternIds.length > 0) {
    const { data: keywords } = await serviceClient
      .from('pattern_keywords')
      .select('pattern_id, keywords(id, value)')
      .in('pattern_id', patternIds)

    if (keywords) {
      for (const pk of keywords) {
        if (!patternKeywords[pk.pattern_id]) {
          patternKeywords[pk.pattern_id] = []
        }
        if (pk.keywords) {
          // Supabase returns nested select as object, not array
          const kw = pk.keywords as unknown as { id: number; value: string }
          patternKeywords[pk.pattern_id].push(kw)
        }
      }
    }
  }

  // Merge keywords into patterns
  const patternsWithKeywords = patterns?.map(p => ({
    ...p,
    keywords: patternKeywords[p.id] || [],
  })) || []

  return (
    <ToastProvider>
      <BatchReviewContent
        initialBatch={batch}
        initialPatterns={patternsWithKeywords}
      />
    </ToastProvider>
  )
}
