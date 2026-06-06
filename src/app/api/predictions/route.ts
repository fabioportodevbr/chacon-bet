import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { gameId, homeScore, awayScore } = await req.json()
  if (gameId == null || homeScore == null || awayScore == null) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Verifica se o jogo ainda está aberto
  const { data: game } = await supabase
    .from('games')
    .select('id, game_date, status')
    .eq('id', gameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (game.status !== 'scheduled') {
    return NextResponse.json({ error: 'Palpites encerrados para este jogo' }, { status: 400 })
  }
  if (game.game_date && new Date(game.game_date) <= new Date()) {
    return NextResponse.json({ error: 'O jogo já começou — palpites encerrados' }, { status: 400 })
  }

  // Upsert do palpite (mantém paid=false ao criar; preserva paid existente ao atualizar)
  const { data: existing } = await supabase
    .from('predictions')
    .select('id, paid')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .single()

  let prediction
  if (existing) {
    const { data } = await supabase
      .from('predictions')
      .update({ home_score: homeScore, away_score: awayScore })
      .eq('id', existing.id)
      .select()
      .single()
    prediction = data
  } else {
    const { data } = await supabase
      .from('predictions')
      .insert({ user_id: user.id, game_id: gameId, home_score: homeScore, away_score: awayScore })
      .select()
      .single()
    prediction = data
  }

  return NextResponse.json({ prediction })
}
