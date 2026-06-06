import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/auth-utils'

export async function POST(req: NextRequest) {
  const admin = await getAdminClient()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { name, invite_code } = await req.json()
  if (!name || !invite_code) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('members')
    .insert({ name, invite_code })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}
