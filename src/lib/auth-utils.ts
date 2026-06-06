import { createClient } from '@/lib/supabase/server'

export async function getAdminClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .single()

  const profile = data as { id: string; is_admin: boolean } | null
  return profile?.is_admin ? supabase : null
}
