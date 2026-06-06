import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Código não informado' }, { status: 400 })

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, name, used')
    .eq('invite_code', code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Código de convite inválido' }, { status: 404 })
  }

  return NextResponse.json({ name: data.name, used: data.used })
}
