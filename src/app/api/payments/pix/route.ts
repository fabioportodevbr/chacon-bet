import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Autentica usuário
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { predictionId } = await req.json()
  if (!predictionId) return NextResponse.json({ error: 'predictionId obrigatório' }, { status: 400 })

  // Busca o palpite + jogo + settings
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: prediction }, { data: settings }] = await Promise.all([
    admin.from('predictions').select('*, games(home_team, away_team)').eq('id', predictionId).eq('user_id', user.id).single(),
    admin.from('settings').select('*').eq('id', 1).single(),
  ])

  if (!prediction) return NextResponse.json({ error: 'Palpite não encontrado' }, { status: 404 })
  if (prediction.paid) return NextResponse.json({ error: 'Palpite já pago' }, { status: 400 })

  // Busca email do usuário
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const email = authUser?.email ?? 'pagador@chaconbet.com'

  // Busca nome do perfil
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const nameParts = (profile?.name ?? 'Família Chacon').trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || 'Chacon'

  const betValue = settings?.bet_value ?? 10
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const game = (prediction as any).games
  const description = `Palpite - ${game?.home_team ?? 'Jogo'} × ${game?.away_team ?? 'Copa 2026'}`

  // Cria cobrança PIX no Mercado Pago
  const idempotencyKey = `chaconbet-${predictionId}-${Date.now()}`

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: betValue,
      description,
      payment_method_id: 'pix',
      payer: {
        email,
        first_name: firstName,
        last_name: lastName,
      },
    }),
  })

  if (!mpRes.ok) {
    const err = await mpRes.json()
    console.error('Mercado Pago error:', err)
    return NextResponse.json({ error: 'Erro ao criar cobrança PIX', detail: err }, { status: 500 })
  }

  const mpData = await mpRes.json()
  const paymentId = mpData.id
  const pixData = mpData.point_of_interaction?.transaction_data

  // Salva o charge_id no palpite (coluna opcional — ignora erro se não existir)
  await admin
    .from('predictions')
    .update({ charge_id: String(paymentId) })
    .eq('id', predictionId)

  return NextResponse.json({
    paymentId,
    qrCode: pixData?.qr_code ?? null,          // string copia-e-cola
    qrCodeBase64: pixData?.qr_code_base64 ?? null, // imagem base64
  })
}
