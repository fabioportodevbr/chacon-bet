import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { inviteCode, name, email, password } = await req.json()

  if (!inviteCode || !name || !email || !password) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createAdminClient() as any

  // Valida convite
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, used')
    .eq('invite_code', inviteCode)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'Código de convite inválido' }, { status: 404 })
  }
  if (member.used) {
    return NextResponse.json({ error: 'Esse convite já foi usado. Entre com seu e-mail e senha.' }, { status: 409 })
  }

  // Cria usuário
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Erro ao criar conta' }, { status: 500 })
  }

  // Marca convite como usado e associa ao user_id
  await supabase
    .from('members')
    .update({ used: true, user_id: authData.user.id })
    .eq('id', member.id)

  // Atualiza o perfil com o nome correto
  await supabase
    .from('profiles')
    .update({ name })
    .eq('id', authData.user.id)

  // Faz login automático via browser (retorna tokens)
  return NextResponse.json({ ok: true })
}
