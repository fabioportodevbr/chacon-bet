import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const authClient = await getAdminClient()
  if (!authClient) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { gameId, userId, bettorName, homeScore, awayScore, paid = true } = await req.json()

  if (!gameId || !userId || !bettorName?.trim()) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Verify game is still open
  const { data: game } = await admin
    .from('games')
    .select('game_date, status')
    .eq('id', gameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (game.status !== 'scheduled') {
    return NextResponse.json({ error: 'Palpites encerrados para este jogo' }, { status: 400 })
  }
  if (game.game_date && new Date(game.game_date) <= new Date()) {
    return NextResponse.json({ error: 'O jogo já começou' }, { status: 400 })
  }

  const batchId = crypto.randomUUID()
  const { data, error } = await admin
    .from('predictions')
    .insert({
      user_id: userId,
      game_id: gameId,
      bettor_name: bettorName.trim(),
      home_score: Number(homeScore) || 0,
      away_score: Number(awayScore) || 0,
      batch_id: batchId,
      paid: !!paid,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch profile separately (no direct FK between predictions and profiles in schema cache)
  const { data: profile } = await admin
    .from('profiles')
    .select('name, avatar_url, frase')
    .eq('id', userId)
    .single()

  return NextResponse.json({ prediction: { ...data, profiles: profile ?? null } })
}

export async function DELETE(req: NextRequest) {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { predictionId } = await req.json()
  if (!predictionId) return NextResponse.json({ error: 'predictionId obrigatório' }, { status: 400 })

  // Admin pode excluir qualquer palpite sem restrições
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('predictions')
    .delete()
    .eq('id', predictionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
