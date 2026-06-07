import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
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

  // Service role para buscar dados ignorando RLS
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [membersRes, settingsRes, gamesRes, predictionsRes, profilesRes] = await Promise.all([
    supabase.from('members').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('games').select('*').order('game_number', { ascending: true }),
    // Usa service role para ver palpites de TODOS os usuários (RLS bloquearia)
    admin.from('predictions').select('*').order('created_at', { ascending: false }),
    // Busca todos os profiles para fazer join manual (evita problema de FK no PostgREST)
    admin.from('profiles').select('id, name'),
  ])

  // Join manual: adiciona profiles.name em cada prediction
  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )
  const predictions = (predictionsRes.data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    profiles: { name: profileMap[p.user_id as string] ?? null },
  }))

  return (
    <AdminClient
      members={membersRes.data ?? []}
      settings={settingsRes.data}
      games={gamesRes.data ?? []}
      predictions={predictions as any}
    />
  )
}
