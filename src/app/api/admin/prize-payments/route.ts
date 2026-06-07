import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { predictionId, prizePaid } = await req.json()

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('predictions')
    .update({
      prize_paid: prizePaid,
      prize_paid_at: prizePaid ? new Date().toISOString() : null,
    })
    .eq('id', predictionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
