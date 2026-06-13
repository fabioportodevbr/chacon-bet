import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APISPORTS_KEY = process.env.APISPORTS_KEY!
const WC_LEAGUE_ID = 1
const SYNC_WINDOW_MS = 3 * 60 * 60 * 1000

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

// Throttle in-process: no máximo 1 chamada à API-Sports a cada 90s por instância
let lastApiCall = 0
const API_THROTTLE_MS = 90_000

export async function GET() {
  const now = Date.now()

  if (now - lastApiCall < API_THROTTLE_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'throttle' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const windowStart = new Date(now - SYNC_WINDOW_MS).toISOString()
    const windowEnd   = new Date(now + 5 * 60 * 1000).toISOString()

    const [{ data: windowGames }, { data: liveGames }] = await Promise.all([
      supabase.from('games').select('id, game_date').gte('game_date', windowStart).lte('game_date', windowEnd),
      supabase.from('games').select('id, game_date').eq('status', 'live'),
    ])

    const activeGames = new Map<string, string>()
    for (const g of [...(windowGames ?? []), ...(liveGames ?? [])]) {
      activeGames.set(g.id, g.game_date)
    }

    if (activeGames.size === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no active games' })
    }

    lastApiCall = now

    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&date=${today}`,
      { headers: { 'x-apisports-key': APISPORTS_KEY }, cache: 'no-store' }
    )

    if (!res.ok) {
      return NextResponse.json({ error: `API-Sports ${res.status}` }, { status: 502 })
    }

    const fixtures = ((await res.json()).response ?? []) as any[]
    let updated = 0

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
      if (!matchId) continue

      const statusShort = fixture.fixture?.status?.short ?? 'NS'
      const status = statusMap[statusShort] ?? 'scheduled'
      const homeScore: number | null = fixture.goals?.home ?? null
      const awayScore: number | null = fixture.goals?.away ?? null
      const scoreFields = homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}

      await supabase.from('games').update({ status, ...scoreFields }).eq('id', matchId)
      updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
