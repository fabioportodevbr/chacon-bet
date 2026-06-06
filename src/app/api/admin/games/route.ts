import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'

export async function PUT(req: NextRequest) {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { gameId, homeScore, awayScore, status } = await req.json()
  if (!gameId) return NextResponse.json({ error: 'gameId obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('games')
    .update({ home_score: homeScore, away_score: awayScore, status: status ?? 'finished' })
    .eq('id', gameId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ game: data })
}
