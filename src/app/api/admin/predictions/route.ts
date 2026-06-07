import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth-utils'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  const supabase = await getAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { predictionId } = await req.json()
  if (!predictionId) return NextResponse.json({ error: 'predictionId obrigatório' }, { status: 400 })

  // Admin pode excluir qualquer palpite sem restrições
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('predictions')
    .delete()
    .eq('id', predictionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
