import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const profile = profileData as { is_admin: boolean } | null
  if (!profile?.is_admin) redirect('/bolao')

  const [membersRes, settingsRes, gamesRes, predictionsRes] = await Promise.all([
    supabase.from('members').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('games').select('*').order('game_number', { ascending: true }),
    supabase.from('predictions').select('*, profiles(name)'),
  ])

  return (
    <AdminClient
      members={membersRes.data ?? []}
      settings={settingsRes.data}
      games={gamesRes.data ?? []}
      predictions={(predictionsRes.data ?? []) as any}
    />
  )
}
