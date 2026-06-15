import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'

export async function PUT(req: NextRequest) {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('settings')
    .update({
      pix_key: body.pix_key,
      pix_name: body.pix_name,
      pix_city: body.pix_city,
      bet_value: body.bet_value,
      prize_percent: body.prize_percent,
      live_url: body.live_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
