import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APISPORTS_KEY = process.env.APISPORTS_KEY!
const WC_LEAGUE_ID = 1
const THROTTLE_MIN = 5
const SYNC_WINDOW_MS = 3 * 60 * 60 * 1000 // 3h cobre 90min + prorrogação + pênaltis

const statusMap: Record<string, string> = {
  '1H':   'live',
  'HT':   'live',
  '2H':   'live',
  'ET':   'live',
  'BT':   'live',
  'P':    'live',
  'INT':  'live',
  'FT':   'finished',
  'AET':  'finished',
  'PEN':  'finished',
  'NS':   'scheduled',
  'TBD':  'scheduled',
  'CANC': 'cancelled',
  'PST':  'cancelled',
  'SUSP': 'cancelled',
  'WO':   'cancelled',
  'ABD':  'cancelled',
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Throttle: só chama API-Sports a cada 5 min (preserva quota de 100 req/dia)
  const minute = new Date().getUTCMinutes()
  if (minute % THROTTLE_MIN !== 0) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: `Throttle: próxima sync em ${THROTTLE_MIN - (minute % THROTTLE_MIN)} min`,
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const now = Date.now()
    const windowStart = new Date(now - SYNC_WINDOW_MS).toISOString()
    const windowEnd   = new Date(now + 5 * 60 * 1000).toISOString()
    const recentCutoff = new Date(now - 6 * 60 * 60 * 1000).toISOString()

    // Consultas ao Supabase (sem custo de quota da API externa)
    const [{ data: windowGames }, { data: liveGames }, { data: unscoredGames }] = await Promise.all([
      supabase.from('games').select('id, game_date').gte('game_date', windowStart).lte('game_date', windowEnd),
      supabase.from('games').select('id, game_date').eq('status', 'live'),
      supabase.from('games').select('id, game_date').eq('status', 'finished').is('home_score', null).gte('game_date', recentCutoff),
    ])

    // Mapa id → game_date de todos os jogos que precisam de sync
    const activeGames = new Map<string, string>()
    for (const g of [...(windowGames ?? []), ...(liveGames ?? []), ...(unscoredGames ?? [])]) {
      activeGames.set(g.id, g.game_date)
    }

    if (activeGames.size === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhuma partida na janela ativa' })
    }

    // Busca jogos da Copa do Mundo de hoje na API-Sports (1 request)
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&date=${today}`,
      { headers: { 'x-apisports-key': APISPORTS_KEY } }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `API-Sports ${res.status}: ${text}` }, { status: 502 })
    }

    const data = await res.json()
    const fixtures = (data.response ?? []) as any[]

    if (!fixtures.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhum jogo retornado pela API-Sports' })
    }

    let updated = 0
    for (const fixture of fixtures) {
      const fixtureTs = new Date(fixture.fixture?.date ?? '').getTime()
      if (!fixtureTs) continue

      // Encontra o jogo correspondente no banco pelo horário de início (tolerância 10 min)
      let matchId: string | undefined
      for (const [id, gameDate] of activeGames) {
        if (Math.abs(new Date(gameDate).getTime() - fixtureTs) <= 10 * 60 * 1000) {
          matchId = id
          break
        }
      }
      if (!matchId) continue

      const statusShort = fixture.fixture?.status?.short ?? 'NS'
      const status = statusMap[statusShort] ?? 'scheduled'

      // API-Sports fornece placar ao vivo em goals.home/away (diferente de football-data.org!)
      const homeScore: number | null = fixture.goals?.home ?? null
      const awayScore: number | null = fixture.goals?.away ?? null
      const scoreFields = homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}

      await supabase
        .from('games')
        .update({ status, ...scoreFields })
        .eq('id', matchId)

      updated++
    }

    return NextResponse.json({ ok: true, updated, active: activeGames.size })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
