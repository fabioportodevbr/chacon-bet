import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'
import { getTeamFlag } from '@/lib/flags'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_ID = 2000 // FIFA World Cup 2026 na football-data.org

const phaseMap: Record<string, string> = {
  'GROUP_STAGE': 'group',
  'LAST_32': 'r32',
  'LAST_16': 'r16',
  'QUARTER_FINALS': 'qf',
  'SEMI_FINALS': 'sf',
  'THIRD_PLACE': '3rd',
  'FINAL': 'final',
}

const statusMap: Record<string, string> = {
  'SCHEDULED': 'scheduled',
  'TIMED': 'scheduled',
  'IN_PLAY': 'live',
  'PAUSED': 'live',
  'FINISHED': 'finished',
  'CANCELLED': 'cancelled',
  'POSTPONED': 'cancelled',
}

export async function POST() {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${WC_ID}/matches`,
      { headers: { 'X-Auth-Token': API_KEY } }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `API error: ${res.status} — ${text}` }, { status: 502 })
    }

    const data = await res.json()
    const matches = data.matches as any[]

    if (!matches?.length) {
      return NextResponse.json({ error: 'Nenhum jogo retornado pela API' }, { status: 404 })
    }

    let created = 0
    let updated = 0

    for (const match of matches) {
      const phase = phaseMap[match.stage] ?? 'group'
      const status = statusMap[match.status] ?? 'scheduled'
      const homeTeam = match.homeTeam?.name ?? 'TBD'
      const awayTeam = match.awayTeam?.name ?? 'TBD'
      const homeFlag = getTeamFlag(homeTeam)
      const awayFlag = getTeamFlag(awayTeam)
      const gameDate = match.utcDate ?? null
      const homeScore = match.score?.fullTime?.home ?? null
      const awayScore = match.score?.fullTime?.away ?? null
      const groupName = match.group ? match.group.replace('GROUP_', '') : null
      const gameNumber = match.matchday ?? null

      const { data: existing } = await (supabase as any)
        .from('games')
        .select('id')
        .eq('external_id', match.id)
        .single()

      if (existing) {
        await (supabase as any)
          .from('games')
          .update({
            home_team: homeTeam,
            away_team: awayTeam,
            home_flag: homeFlag,
            away_flag: awayFlag,
            home_score: homeScore,
            away_score: awayScore,
            status,
            game_date: gameDate,
          })
          .eq('external_id', match.id)
        updated++
      } else {
        await (supabase as any)
          .from('games')
          .insert({
            external_id: match.id,
            phase,
            group_name: groupName,
            game_number: gameNumber,
            home_team: homeTeam,
            away_team: awayTeam,
            home_flag: homeFlag,
            away_flag: awayFlag,
            game_date: gameDate,
            home_score: homeScore,
            away_score: awayScore,
            status,
          })
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated, total: matches.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
