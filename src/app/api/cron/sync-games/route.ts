import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APISPORTS_KEY = process.env.APISPORTS_KEY!
const WC_LEAGUE_ID = 1
const THROTTLE_MIN = 5 // 5 min → max ~84 calls/dia em dia com 3 jogos simultâneos
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
  const querySecret = req.nextUrl.searchParams.get('secret')
  if (querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!APISPORTS_KEY) {
    return NextResponse.json({ error: 'APISPORTS_KEY não configurada' }, { status: 500 })
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

    const [{ data: windowGames }, { data: liveGames }, { data: unscoredGames }] = await Promise.all([
      supabase.from('games').select('id, game_date').gte('game_date', windowStart).lte('game_date', windowEnd),
      supabase.from('games').select('id, game_date').eq('status', 'live'),
      supabase.from('games').select('id, game_date').eq('status', 'finished').is('home_score', null).gte('game_date', recentCutoff),
    ])

    // Throttle: preserva quota de 100 req/dia (5 min → máx ~84 calls em dia cheio)
    const minute = new Date().getUTCMinutes()
    if (minute % THROTTLE_MIN !== 0) {
      return NextResponse.json({
        ok: true, skipped: true,
        reason: `Throttle: próxima sync em ${THROTTLE_MIN - (minute % THROTTLE_MIN)} min`,
      })
    }

    const activeGames = new Map<string, string>()
    for (const g of [...(windowGames ?? []), ...(liveGames ?? []), ...(unscoredGames ?? [])]) {
      activeGames.set(g.id, g.game_date)
    }

    if (activeGames.size === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhuma partida na janela ativa' })
    }

    const today = new Date().toISOString().slice(0, 10)
    const hasWindowOrLive = (windowGames ?? []).length > 0 || (liveGames ?? []).length > 0
    const hasUnscored    = (unscoredGames ?? []).length > 0

    // Estratégia de chamada à API (preserva quota):
    // 1. Janela ativa ou jogo ao vivo  → ?live=all (independe de fuso horário,
    //    detecta qualquer jogo ao vivo — Brasil ou não — mesmo que o BD ainda
    //    mostre status=scheduled)
    // 2. Só jogos encerrados sem placar → ?date=today (live=all não retorna encerrados)
    const apiUrl = hasWindowOrLive
      ? `https://v3.football.api-sports.io/fixtures?live=all&league=${WC_LEAGUE_ID}`
      : `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&season=2026&date=${today}`

    async function fetchFixtures(url: string) {
      const r = await fetch(url, { headers: { 'x-apisports-key': APISPORTS_KEY }, cache: 'no-store' })
      if (!r.ok) throw new Error(`API-Sports ${r.status}: ${await r.text()}`)
      const d = await r.json()
      if (d.errors && Object.keys(d.errors).length > 0) throw new Error(JSON.stringify(d.errors))
      return (d.response ?? []) as any[]
    }

    let fixtures = await fetchFixtures(apiUrl)

    // API-Sports ?date= usa a data LOCAL do venue (América do Norte: UTC-4 a UTC-6).
    // Jogos armazenados em UTC que cruzam meia-noite UTC são listados no dia anterior
    // pela API. Ex: 2026-06-14T01:00Z → venue local = 2026-06-13 (EDT/CDT).
    // Usamos UTC-6 (offset máximo WC2026) para garantir a data correta do venue.
    const NA_OFFSET_MS = 6 * 60 * 60 * 1000

    function naLocalDate(isoDate: string) {
      return new Date(new Date(isoDate).getTime() - NA_OFFSET_MS).toISOString().slice(0, 10)
    }

    const hasLiveInDb = (liveGames ?? []).length > 0
    const debugDates: string[] = []

    if (hasWindowOrLive && (hasUnscored || hasLiveInDb)) {
      // Coleta datas únicas em horário local NA para cada jogo live/unscored no BD
      const datesToFetch = new Set<string>()
      for (const g of [...(liveGames ?? []), ...(unscoredGames ?? [])]) {
        if (g.game_date) datesToFetch.add(naLocalDate(g.game_date))
      }
      // Garante que hoje (NA) também seja coberto
      datesToFetch.add(naLocalDate(new Date(now).toISOString()))

      for (const date of datesToFetch) {
        debugDates.push(date)
        const dateUrl = `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&season=2026&date=${date}`
        try {
          const dateFixtures = await fetchFixtures(dateUrl)
          const seen = new Set(fixtures.map((f: any) => f.fixture?.id))
          for (const f of dateFixtures) {
            if (!seen.has(f.fixture?.id)) fixtures.push(f)
          }
        } catch (e) { debugDates.push(`ERR:${String(e)}`) }
      }
    }

    if (!fixtures.length) {
      return NextResponse.json({
        ok: true, skipped: true,
        reason: 'Nenhum jogo retornado pela API-Sports',
        debug: { apiUrl, activeGames: activeGames.size },
      })
    }

    let updated = 0
    let skippedNoMatch = 0
    for (const fixture of fixtures) {
      const fixtureTs = new Date(fixture.fixture?.date ?? '').getTime()
      if (!fixtureTs) continue

      let matchId: string | undefined
      for (const [id, gameDate] of activeGames) {
        if (Math.abs(new Date(gameDate).getTime() - fixtureTs) <= 10 * 60 * 1000) {
          matchId = id
          break
        }
      }
      if (!matchId) { skippedNoMatch++; continue }

      const statusShort = fixture.fixture?.status?.short ?? 'NS'
      const status = statusMap[statusShort] ?? 'scheduled'
      const homeScore: number | null = fixture.goals?.home ?? null
      const awayScore: number | null = fixture.goals?.away ?? null
      const scoreFields = homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}

      await supabase.from('games').update({ status, ...scoreFields }).eq('id', matchId)
      updated++
    }

    const debugActiveGames = [...activeGames.entries()].map(([id, d]) => ({ id, game_date: d }))
    return NextResponse.json({
      ok: true, updated, active: activeGames.size, skippedNoMatch,
      debug: { today, liveInDb: (liveGames ?? []).length, datesFetched: debugDates, fixturesFound: fixtures.length, activeGames: debugActiveGames },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
