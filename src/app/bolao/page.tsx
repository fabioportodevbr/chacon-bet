import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BolaoClient from '@/components/bolao/BolaoClient'

export default async function BolaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  const [profileRes, gamesRes, predictionsRes, settingsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('games').select('*').order('game_number', { ascending: true }),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ])

  const isAdmin = profileRes.data?.is_admin === true

  return (
    <BolaoClient
      user={user}
      profile={profileRes.data}
      games={gamesRes.data ?? []}
      predictions={predictionsRes.data ?? []}
      settings={settingsRes.data}
      isAdmin={isAdmin}
    />
  )
}
