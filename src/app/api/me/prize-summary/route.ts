import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Busca palpites pagos do usuário
  const { data: myPreds } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
    .eq('paid', true)

  if (!myPreds?.length) return NextResponse.json({ prizes: [] })

  // Settings para cálculo do prêmio
  const { data: settings } = await supabase
    .from('settings')
    .select('bet_value, prize_percent')
    .eq('id', 1)
    .single()

  const gameIds = [...new Set(myPreds.map(p => p.game_id))]

  // Jogos encerrados relevantes
  const { data: games } = await supabase
    .from('games')
    .select('id, status, home_score, away_score')
    .in('id', gameIds)
    .eq('status', 'finished')

  if (!games?.length) return NextResponse.json({ prizes: [] })

  // Todos os palpites pagos desses jogos (para calcular o pote)
  const finishedIds = games.map(g => g.id)
  const { data: allPreds } = await admin
    .from('predictions')
    .select('id, game_id, home_score, away_score')
    .in('game_id', finishedIds)
    .eq('paid', true)

  const betValue = settings?.bet_value ?? 0
  const prizePercent = (settings?.prize_percent ?? 100) / 100

  const prizes: {
    prediction_id: string
    game_id: string
    bettor_name: string | null
    prize_amount: number
    prize_paid: boolean
    prize_paid_at: string | null
  }[] = []

  for (const game of games) {
    if (game.home_score === null || game.away_score === null) continue

    const gamePaidPreds = (allPreds ?? []).filter(p => p.game_id === game.id)
    const gameWinners = gamePaidPreds.filter(
      p => p.home_score === game.home_score && p.away_score === game.away_score
    )
    if (gameWinners.length === 0) continue

    const totalArrecadado = gamePaidPreds.length * betValue
    const liquido = totalArrecadado * 0.99
    const premioTotal = liquido * prizePercent
    const premioPorGanhador = premioTotal / gameWinners.length

    const myWinners = myPreds.filter(
      p =>
        p.game_id === game.id &&
        p.home_score === game.home_score &&
        p.away_score === game.away_score
    )

    for (const pred of myWinners) {
      prizes.push({
        prediction_id: pred.id,
        game_id: pred.game_id,
        bettor_name: pred.bettor_name,
        prize_amount: premioPorGanhador,
        prize_paid: pred.prize_paid ?? false,
        prize_paid_at: pred.prize_paid_at ?? null,
      })
    }
  }

  return NextResponse.json({ prizes })
}
