import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: adminProfileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!adminProfileData?.is_admin) redirect('/bolao')
  const adminProfile = adminProfileData

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
    admin.from('profiles').select('id, name, avatar_url, frase, pix_key'),
  ])

  // Join manual: adiciona profile em cada prediction
  type ProfileRow = { id: string; name: string; avatar_url: string | null; frase: string | null; pix_key: string | null }
  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p])
  )
  const predictions = (predictionsRes.data ?? []).map((p: Record<string, unknown>) => {
    const prof: ProfileRow | undefined = profileMap[p.user_id as string]
    return {
      ...p,
      profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url, frase: prof.frase, pix_key: prof.pix_key } : null,
    }
  })

  return (
    <AdminClient
      adminProfile={adminProfile}
      members={membersRes.data ?? []}
      settings={settingsRes.data}
      games={gamesRes.data ?? []}
      predictions={predictions as any}
      profileMap={profileMap}
    />
  )
}
