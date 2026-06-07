import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('avatar') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Foto deve ter no máximo 5 MB' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Arquivo deve ser uma imagem' }, { status: 400 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const buffer = await file.arrayBuffer()
  const ext = file.type.split('/')[1] ?? 'jpg'
  const storagePath = `${user.id}.${ext}`

  // Remove avatar anterior (qualquer extensão)
  await admin.storage.from('avatars').remove([
    `${user.id}.jpg`, `${user.id}.jpeg`, `${user.id}.png`, `${user.id}.webp`, `${user.id}.gif`,
  ])

  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage
    .from('avatars')
    .getPublicUrl(storagePath)

  // Append timestamp to bust cache
  const urlWithTs = `${publicUrl}?t=${Date.now()}`

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlWithTs })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ url: urlWithTs })
}
