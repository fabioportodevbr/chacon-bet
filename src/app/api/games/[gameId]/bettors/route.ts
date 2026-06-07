import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { gameId } = await params

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Busca palpites com bettor_name (nome real de quem apostou)
  const { data: predictions, error } = await admin
    .from('predictions')
    .select('user_id, bettor_name, home_score, away_score, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ bettors: [], count: 0 })
  }

  const bettors = predictions.map((p: {
    user_id: string
    bettor_name: string | null
    home_score: number
    away_score: number
  }) => ({
    name: p.bettor_name ?? 'Anônimo',
    home_score: p.home_score,
    away_score: p.away_score,
    isMe: p.user_id === user.id,
  }))

  return NextResponse.json({ bettors, count: bettors.length })
}
