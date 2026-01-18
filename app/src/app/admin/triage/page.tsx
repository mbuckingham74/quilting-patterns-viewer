import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TriageContent from '@/components/triage/TriageContent'

export const metadata = {
  title: 'Pattern Triage - Admin',
  description: 'Review and fix patterns with issues'
}

export default async function TriagePage() {
  const supabase = await createClient()

  // Check if user is authenticated and is admin
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  return <TriageContent />
}
