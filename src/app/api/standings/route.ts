import { NextResponse } from 'next/server'

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY!
const WC_ID  = 2000

export const revalidate = 300 // cache 5 min

export async function GET() {
  if (!FD_KEY) return NextResponse.json({ error: 'API key não configurada' }, { status: 500 })

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${WC_ID}/standings`,
    { headers: { 'X-Auth-Token': FD_KEY }, next: { revalidate: 300 } }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `football-data.org ${res.status}: ${text}` }, { status: 502 })
  }

  const data = await res.json()

  // Filtra apenas GROUP_STAGE / TOTAL para evitar duplicatas (home/away)
  const groups = (data.standings ?? [])
    .filter((s: any) => s.type === 'TOTAL' && s.stage === 'GROUP_STAGE')
    .map((s: any) => ({
      group: (s.group ?? '').replace('GROUP_', ''),
      table: (s.table ?? []).map((row: any) => ({
        position:       row.position,
        team:           row.team?.name ?? '',
        playedGames:    row.playedGames ?? 0,
        won:            row.won ?? 0,
        draw:           row.draw ?? 0,
        lost:           row.lost ?? 0,
        points:         row.points ?? 0,
        goalsFor:       row.goalsFor ?? 0,
        goalsAgainst:   row.goalsAgainst ?? 0,
        goalDifference: row.goalDifference ?? 0,
      })),
    }))
    .sort((a: any, b: any) => a.group.localeCompare(b.group))

  return NextResponse.json({ groups })
}
