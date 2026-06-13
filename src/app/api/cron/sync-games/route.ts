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

// Janela de sincronização: cobre 90min + prorrogação + pênaltis + margem
const SYNC_WINDOW_MS = 3 * 60 * 60 * 1000

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

    // Jogos já marcados 'finished' mas sem placar (race condition: API atualiza status
    // antes do fullTime; sem esta query o cron para de sincronizá-los)
    const recentCutoff = new Date(now - 6 * 60 * 60 * 1000).toISOString()
    const { data: unscoredGames, error: unscoredError } = await supabase
      .from('games')
      .select('external_id')
      .eq('status', 'finished')
      .is('home_score', null)
      .gte('game_date', recentCutoff)
      .not('external_id', 'is', null)

    if (unscoredError) throw unscoredError

    // Normaliza para string em ambos os lados — external_id pode ser int ou text no banco
    const activeIdSet = new Set([
      ...(windowGames ?? []).map(g => String(g.external_id)),
      ...(liveGames ?? []).map(g => String(g.external_id)),
      ...(unscoredGames ?? []).map(g => String(g.external_id)),
    ].filter(Boolean))

    if (activeIdSet.size === 0) {
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
    const matches = (data.matches as any[]).filter(m => activeIdSet.has(String(m.id)))

    if (!matches.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhum jogo ativo retornado pela API' })
    }

    let updated = 0
    for (const match of matches) {
      const status = statusMap[match.status] ?? 'scheduled'
      const homeTeam = match.homeTeam?.name ?? 'TBD'
      const awayTeam = match.awayTeam?.name ?? 'TBD'
      const homeFlag = getTeamFlag(homeTeam)
      const awayFlag = getTeamFlag(awayTeam)

      // fullTime só é confiável quando o jogo termina.
      // Durante IN_PLAY/PAUSED tentamos halfTime como placar do intervalo;
      // nunca sobrescrevemos com null para não apagar placares do admin.
      const fullHome = match.score?.fullTime?.home
      const fullAway = match.score?.fullTime?.away
      const halfHome = match.score?.halfTime?.home
      const halfAway = match.score?.halfTime?.away

      const isFinished = match.status === 'FINISHED'

      const scoreFields: Record<string, number | null> = {}
      if (isFinished && fullHome != null) {
        // Placar final — sempre atualiza
        scoreFields.home_score = fullHome
        scoreFields.away_score = fullAway ?? null
      } else if (!isFinished && halfHome != null) {
        // Placar do intervalo como aproximação durante jogo ao vivo
        scoreFields.home_score = halfHome
        scoreFields.away_score = halfAway ?? null
      }
      // Se ambos forem null (1º tempo em andamento) não altera o placar no banco

      await supabase
        .from('games')
        .update({ status, home_flag: homeFlag, away_flag: awayFlag, home_team: homeTeam, away_team: awayTeam, ...scoreFields })
        .eq('external_id', String(match.id))

      updated++
    }

    return NextResponse.json({ ok: true, updated, active: activeIdSet.size })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
