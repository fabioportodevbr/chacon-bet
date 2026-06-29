import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPast14hBRT } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Body: { gameId, items: [{ bettorName, homeScore, awayScore, existingId? }] }
  const { gameId, items } = await req.json()

  if (!gameId || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Validate each item
  for (const item of items) {
    if (!item.bettorName?.trim()) {
      return NextResponse.json({ error: 'Informe o nome de cada apostador' }, { status: 400 })
    }
    if (item.homeScore == null || item.awayScore == null ||
        isNaN(Number(item.homeScore)) || isNaN(Number(item.awayScore))) {
      return NextResponse.json({ error: 'Placar inválido em um dos palpites' }, { status: 400 })
    }
  }

  // Verify game is still open
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
  if (game.game_date && isPast14hBRT(game.game_date)) {
    return NextResponse.json({ error: 'Palpites encerrados — o prazo é 14h (horário de Brasília)' }, { status: 400 })
  }

  type ItemIn = { bettorName: string; homeScore: number | string; awayScore: number | string; existingId?: string }

  const toUpdate = (items as ItemIn[]).filter(i => !!i.existingId)
  const toInsert = (items as ItemIn[]).filter(i => !i.existingId)

  // Update scores of existing predictions (preserves paid status)
  for (const item of toUpdate) {
    await supabase
      .from('predictions')
      .update({
        home_score: Number(item.homeScore),
        away_score: Number(item.awayScore),
      })
      .eq('id', item.existingId!)
      .eq('user_id', user.id)
      .eq('game_id', gameId)
  }

  // Delete unpaid predictions not in the kept set
  const keptIds = toUpdate.map(i => i.existingId!)
  if (keptIds.length > 0) {
    await supabase
      .from('predictions')
      .delete()
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .eq('paid', false)
      .not('id', 'in', `(${keptIds.join(',')})`)
  } else {
    await supabase
      .from('predictions')
      .delete()
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .eq('paid', false)
  }

  // Insert new predictions
  let batchId: string | null = null
  let newCount = 0

  if (toInsert.length > 0) {
    batchId = crypto.randomUUID()
    const rows = toInsert.map(item => ({
      user_id: user.id,
      game_id: gameId,
      bettor_name: (item.bettorName as string).trim(),
      batch_id: batchId,
      home_score: Number(item.homeScore),
      away_score: Number(item.awayScore),
    }))

    const { data: inserted, error } = await supabase
      .from('predictions')
      .insert(rows)
      .select()

    if (error) {
      console.error('Erro ao salvar palpites:', error)
      return NextResponse.json({ error: 'Erro ao salvar palpites', detail: error.message }, { status: 500 })
    }
    newCount = inserted?.length ?? 0
  }

  // Fetch all predictions for this game to return updated state
  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
    .eq('game_id', gameId)

  return NextResponse.json({ predictions: allPredictions ?? [], batchId, newCount })
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
    if (game?.game_date && isPast14hBRT(game.game_date)) {
      return NextResponse.json({ error: 'Prazo encerrado — não é possível desistir após as 14h (horário de Brasília)' }, { status: 400 })
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
  if (game?.game_date && isPast14hBRT(game.game_date)) {
    return NextResponse.json({ error: 'Prazo encerrado — não é possível desistir após as 14h (horário de Brasília)' }, { status: 400 })
  }

  await supabase.from('predictions').delete().eq('id', predictionId)
  return NextResponse.json({ ok: true })
}
