import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Body: { gameId, items: [{ bettorName, homeScore, awayScore }] }
  const { gameId, items } = await req.json()

  if (!gameId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Valida cada item
  for (const item of items) {
    if (!item.bettorName?.trim()) {
      return NextResponse.json({ error: 'Informe o nome de cada apostador' }, { status: 400 })
    }
    if (item.homeScore == null || item.awayScore == null ||
        isNaN(Number(item.homeScore)) || isNaN(Number(item.awayScore))) {
      return NextResponse.json({ error: 'Placar inválido em um dos palpites' }, { status: 400 })
    }
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

  // Remove todos os palpites NÃO pagos anteriores para este jogo
  // (palpites pagos são preservados — o usuário pode adicionar mais pessoas)
  await supabase
    .from('predictions')
    .delete()
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .eq('paid', false)

  // Gera um batch_id compartilhado para este lote
  const batchId = crypto.randomUUID()

  // Insere todos os palpites do lote
  const toInsert = items.map((item: { bettorName: string; homeScore: number; awayScore: number }) => ({
    user_id: user.id,
    game_id: gameId,
    bettor_name: item.bettorName.trim(),
    batch_id: batchId,
    home_score: Number(item.homeScore),
    away_score: Number(item.awayScore),
  }))

  const { data: predictions, error } = await supabase
    .from('predictions')
    .insert(toInsert)
    .select()

  if (error) {
    console.error('Erro ao salvar palpites:', error)
    return NextResponse.json({ error: 'Erro ao salvar palpites', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ predictions, batchId })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()

  // Suporta deleção por gameId (lote inteiro) ou por predictionId (individual)
  if (body.gameId) {
    const { gameId } = body

    // Verifica se o jogo ainda não começou
    const { data: game } = await supabase
      .from('games')
      .select('game_date, status')
      .eq('id', gameId)
      .single()

    if (game?.status !== 'scheduled' || (game?.game_date && new Date(game.game_date) <= new Date())) {
      return NextResponse.json({ error: 'O jogo já começou — não é possível desistir' }, { status: 400 })
    }

    await supabase
      .from('predictions')
      .delete()
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .eq('paid', false)

    return NextResponse.json({ ok: true })
  }

  // Fallback: deleção por predictionId (legado)
  const { predictionId } = body
  if (!predictionId) return NextResponse.json({ error: 'gameId ou predictionId obrigatório' }, { status: 400 })

  const { data: prediction } = await supabase
    .from('predictions')
    .select('id, paid, game_id')
    .eq('id', predictionId)
    .eq('user_id', user.id)
    .single()

  if (!prediction) return NextResponse.json({ error: 'Palpite não encontrado' }, { status: 404 })
  if (prediction.paid) {
    return NextResponse.json({ error: 'Pagamento já confirmado — não é possível desistir' }, { status: 400 })
  }

  const { data: game } = await supabase
    .from('games')
    .select('game_date, status')
    .eq('id', prediction.game_id)
    .single()

  if (game?.status !== 'scheduled' || (game?.game_date && new Date(game.game_date) <= new Date())) {
    return NextResponse.json({ error: 'O jogo já começou — não é possível desistir' }, { status: 400 })
  }

  await supabase.from('predictions').delete().eq('id', predictionId)
  return NextResponse.json({ ok: true })
}
