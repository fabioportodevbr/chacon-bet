import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  // Requer autenticação (qualquer usuário logado pode ver)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { gameId } = await params

  // Usa service role para ler palpites de todos (RLS bloquearia)
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Busca todos os palpites do jogo
  const { data: predictions, error } = await admin
    .from('predictions')
    .select('user_id, home_score, away_score, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ bettors: [], count: 0 })
  }

  // Busca os nomes dos apostadores
  const userIds = predictions.map((p: { user_id: string }) => p.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
    .in('id', userIds)

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )

  const bettors = predictions.map((p: { user_id: string; home_score: number; away_score: number }) => ({
    name: profileMap[p.user_id] ?? 'Anônimo',
    home_score: p.home_score,
    away_score: p.away_score,
    isMe: p.user_id === user.id,
  }))

  return NextResponse.json({ bettors, count: bettors.length })
}
