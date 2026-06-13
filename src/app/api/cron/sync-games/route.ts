import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamFlag } from '@/lib/flags'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_ID = 2000

const statusMap: Record<string, string> = {
  'SCHEDULED': 'scheduled',
  'TIMED': 'scheduled',
  'IN_PLAY': 'live',
  'PAUSED': 'live',
  'FINISHED': 'finished',
  'CANCELLED': 'cancelled',
  'POSTPONED': 'cancelled',
}

// Janela de sincronização: do início do jogo até 2h após o início
const SYNC_WINDOW_MS = 2 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const now = Date.now()
    const windowStart = new Date(now - SYNC_WINDOW_MS).toISOString()
    const windowEnd = new Date(now + 5 * 60 * 1000).toISOString()

    // Jogos dentro da janela de 2h
    const { data: windowGames, error: windowError } = await supabase
      .from('games')
      .select('external_id')
      .gte('game_date', windowStart)
      .lte('game_date', windowEnd)
      .not('external_id', 'is', null)

    if (windowError) throw windowError

    // Jogos ainda marcados como 'live' no banco (travados fora da janela)
    const { data: liveGames, error: liveError } = await supabase
      .from('games')
      .select('external_id')
      .eq('status', 'live')
      .not('external_id', 'is', null)

    if (liveError) throw liveError

    const activeIds = Array.from(new Set([
      ...(windowGames ?? []).map(g => g.external_id),
      ...(liveGames ?? []).map(g => g.external_id),
    ])).filter(Boolean)

    if (activeIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhuma partida na janela ativa' })
    }

    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${WC_ID}/matches`,
      { headers: { 'X-Auth-Token': API_KEY } }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `API error: ${res.status} — ${text}` }, { status: 502 })
    }

    const data = await res.json()
    const matches = (data.matches as any[]).filter(m => activeIds.includes(String(m.id)))

    if (!matches.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhum jogo ativo retornado pela API' })
    }

    let updated = 0
    for (const match of matches) {
      const status = statusMap[match.status] ?? 'scheduled'
      const homeScore = match.score?.fullTime?.home ?? null
      const awayScore = match.score?.fullTime?.away ?? null
      const homeTeam = match.homeTeam?.name ?? 'TBD'
      const awayTeam = match.awayTeam?.name ?? 'TBD'
      const homeFlag = getTeamFlag(homeTeam)
      const awayFlag = getTeamFlag(awayTeam)

      await supabase
        .from('games')
        .update({ home_score: homeScore, away_score: awayScore, status, home_flag: homeFlag, away_flag: awayFlag, home_team: homeTeam, away_team: awayTeam })
        .eq('external_id', String(match.id))

      updated++
    }

    return NextResponse.json({ ok: true, updated, active: activeIds.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
