import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Verifica autenticação do usuário
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('gameId')
  const home = searchParams.get('home')
  const away = searchParams.get('away')

  if (!gameId || home === null || away === null) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const homeScore = parseInt(home)
  const awayScore = parseInt(away)
  if (isNaN(homeScore) || isNaN(awayScore)) {
    return NextResponse.json({ count: 0 })
  }

  // Usa service role para contar todos os palpites (RLS não permite ver de outros usuários)
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { count } = await admin
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('home_score', homeScore)
    .eq('away_score', awayScore)
    .neq('user_id', user.id) // não conta o próprio usuário

  return NextResponse.json({ count: count ?? 0 })
}
