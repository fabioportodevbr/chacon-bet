import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/auth-utils'

export async function PATCH(req: NextRequest) {
  const admin = await getAdminClient()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { userId, pixKey } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

  const serviceClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await serviceClient
    .from('profiles')
    .update({ pix_key: pixKey ?? null })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
