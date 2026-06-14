import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'

export async function PUT(req: NextRequest) {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { gameId, homeScore, awayScore, status, liveUrl } = await req.json()
  if (!gameId) return NextResponse.json({ error: 'gameId obrigatório' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (homeScore !== undefined) updateData.home_score = homeScore
  if (awayScore !== undefined) updateData.away_score = awayScore
  if (status !== undefined || homeScore !== undefined) updateData.status = status ?? 'finished'
  if (liveUrl !== undefined) updateData.live_url = liveUrl || null
  if (Object.keys(updateData).length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('games')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ game: data })
}
