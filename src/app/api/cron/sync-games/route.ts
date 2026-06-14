import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC = 'WC'
const BASE = `https://api.football-data.org/v4/competitions/${WC}/matches`
const THROTTLE_MIN = 5
const SYNC_WINDOW_MS = 3 * 60 * 60 * 1000

const statusMap: Record<string, string> = {
  'IN_PLAY':   'live',
  'PAUSED':    'live',
  'FINISHED':  'finished',
  'AWARDED':   'finished',
  'SCHEDULED': 'scheduled',
  'TIMED':     'scheduled',
  'SUSPENDED': 'cancelled',
  'POSTPONED': 'cancelled',
  'CANCELLED': 'cancelled',
}

export async function GET(req: NextRequest) {
  const querySecret = req.nextUrl.searchParams.get('secret')
  if (querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!FD_KEY) {
    return NextResponse.json({ error: 'FOOTBALL_DATA_API_KEY não configurada' }, { status: 500 })
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

    const headers = { 'X-Auth-Token': FD_KEY }
    const hasWindowOrLive = (windowGames ?? []).length > 0 || (liveGames ?? []).length > 0
    const hasLiveInDb     = (liveGames ?? []).length > 0
    const hasUnscored     = (unscoredGames ?? []).length > 0

    async function fetchMatches(url: string) {
      const r = await fetch(url, { headers, cache: 'no-store' })
      if (!r.ok) throw new Error(`football-data.org ${r.status}: ${await r.text()}`)
      const d = await r.json()
      if (d.message) throw new Error(d.message)
      return (d.matches ?? []) as any[]
    }

    // football-data.org usa datas UTC — sem problema de fuso horário
    const today     = new Date(now).toISOString().slice(0, 10)
    const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10)

    let matches: any[] = []

    if (hasWindowOrLive) {
      // LIVE é o alias aceito pela API para IN_PLAY + PAUSED
      matches = await fetchMatches(`${BASE}?status=LIVE`)
    }

    if (hasUnscored || hasLiveInDb) {
      // Complementa com jogos de hoje e ontem (UTC) para detectar encerrados
      const seen = new Set(matches.map((m: any) => m.id))
      const datesToFetch = new Set<string>([today, yesterday])
      for (const g of [...(liveGames ?? []), ...(unscoredGames ?? [])]) {
        if (g.game_date) datesToFetch.add(new Date(g.game_date).toISOString().slice(0, 10))
      }
      for (const date of datesToFetch) {
        try {
          const dateMatches = await fetchMatches(`${BASE}?dateFrom=${date}&dateTo=${date}`)
          for (const m of dateMatches) {
            if (!seen.has(m.id)) { matches.push(m); seen.add(m.id) }
          }
        } catch { /* continua com o que temos */ }
      }
    }

    if (!matches.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhum jogo retornado pela API' })
    }

    let updated = 0
    let skippedNoMatch = 0

    for (const match of matches) {
      const matchTs = new Date(match.utcDate ?? '').getTime()
      if (!matchTs) continue

      let matchId: string | undefined
      for (const [id, gameDate] of activeGames) {
        if (Math.abs(new Date(gameDate).getTime() - matchTs) <= 10 * 60 * 1000) {
          matchId = id
          break
        }
      }
      if (!matchId) { skippedNoMatch++; continue }

      const status    = statusMap[match.status] ?? 'scheduled'
      const homeScore: number | null = match.score?.fullTime?.home ?? null
      const awayScore: number | null = match.score?.fullTime?.away ?? null
      const scoreFields = homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}

      await supabase.from('games').update({ status, ...scoreFields }).eq('id', matchId)
      updated++
    }

    return NextResponse.json({ ok: true, updated, active: activeGames.size, skippedNoMatch })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
