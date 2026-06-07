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

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { predictionId } = await req.json()
  if (!predictionId) return NextResponse.json({ error: 'predictionId obrigatório' }, { status: 400 })

  // Busca o palpite garantindo que é do próprio usuário
  const { data: prediction } = await supabase
    .from('predictions')
    .select('id, paid, game_id')
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .single()

  if (!prediction) return NextResponse.json({ error: 'Palpite não encontrado' }, { status: 404 })

  // Não pode desistir se já pagou
  if (prediction.paid) {
    return NextResponse.json({ error: 'Pagamento já confirmado — não é possível desistir' }, { status: 400 })
  }

  // Verifica se o jogo ainda não começou
  const { data: game } = await supabase
    .from('games')
    .select('game_date, status')
    .eq('id', prediction.game_id)
    .single()

  if (game?.status !== 'scheduled') {
    return NextResponse.json({ error: 'O jogo já começou — não é possível desistir' }, { status: 400 })
  }
  if (game?.game_date && new Date(game.game_date) <= new Date()) {
    return NextResponse.json({ error: 'O jogo já começou — não é possível desistir' }, { status: 400 })
  }

  await supabase.from('predictions').delete().eq('id', predictionId)

  return NextResponse.json({ ok: true })
}
