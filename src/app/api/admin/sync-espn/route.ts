import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'
import { getTeamFlag } from '@/lib/flags'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

// slug retornado pela ESPN → fase interna do app
const phaseMap: Record<string, string> = {
  'round-of-32':    'r32',
  'round-of-16':    'r16',
  'quarterfinals':  'qf',
  'semifinals':     'sf',
  'third-place':    '3rd',
  'final':          'final',
}

const statusMap: Record<string, string> = {
  'STATUS_SCHEDULED': 'scheduled',
  'STATUS_IN_PROGRESS': 'live',
  'STATUS_HALFTIME': 'live',
  'STATUS_FINAL': 'finished',
  'STATUS_FULL_TIME': 'finished',
  'STATUS_END_PERIOD': 'live',
  'STATUS_POSTPONED': 'cancelled',
  'STATUS_SUSPENDED': 'cancelled',
  'STATUS_CANCELLED': 'cancelled',
}

// Datas a buscar: Round of 32 vai de 28/06 a 03/07; resto do mata-mata até 19/07
function datesToFetch(): string[] {
  const dates: string[] = []
  // 28 Jun a 19 Jul 2026
  const start = new Date('2026-06-28')
  const end = new Date('2026-07-19')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''))
  }
  return dates
}

async function fetchESPN(date: string) {
  const url = `${ESPN_BASE}?dates=${date}&limit=20`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.events ?? []) as any[]
}

export async function POST() {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const allEvents: any[] = []
    for (const date of datesToFetch()) {
      const events = await fetchESPN(date)
      allEvents.push(...events)
    }

    // Filtra apenas jogos do mata-mata (slug não é 'group-stage')
    const knockoutEvents = allEvents.filter(ev => {
      const slug = ev.competitions?.[0]?.season?.slug ?? ''
      return slug !== 'group-stage' && phaseMap[slug] !== undefined
    })

    if (knockoutEvents.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Nenhum jogo eliminatório encontrado na ESPN' })
    }

    let created = 0
    let updated = 0
    let skipped = 0

    for (const ev of knockoutEvents) {
      const comp = ev.competitions?.[0]
      if (!comp) continue

      const slug = comp.season?.slug ?? ''
      const phase = phaseMap[slug]
      if (!phase) { skipped++; continue }

      const statusName = comp.status?.type?.name ?? 'STATUS_SCHEDULED'
      const status = statusMap[statusName] ?? 'scheduled'
      const gameDate = ev.date ?? comp.date ?? null

      const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home')
      const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away')
      const homeTeam = homeComp?.team?.displayName ?? 'TBD'
      const awayTeam = awayComp?.team?.displayName ?? 'TBD'

      const homeScore: number | null = homeComp?.score != null ? Number(homeComp.score) : null
      const awayScore: number | null = awayComp?.score != null ? Number(awayComp.score) : null

      const espnId = String(ev.id)

      // Verifica se já existe pelo espn_id ou pela data+placar aproximado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('games')
        .select('id')
        .eq('external_id', espnId)
        .maybeSingle()

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('games')
          .update({
            home_team: homeTeam,
            away_team: awayTeam,
            home_flag: getTeamFlag(homeTeam),
            away_flag: getTeamFlag(awayTeam),
            status,
            game_date: gameDate,
            ...(homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}),
          })
          .eq('external_id', espnId)
        updated++
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('games')
          .insert({
            external_id: espnId,
            phase,
            group_name: null,
            game_number: null,
            home_team: homeTeam,
            away_team: awayTeam,
            home_flag: getTeamFlag(homeTeam),
            away_flag: getTeamFlag(awayTeam),
            game_date: gameDate,
            home_score: homeScore,
            away_score: awayScore,
            status,
          })
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated, skipped, total: knockoutEvents.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
