import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { batchId } = await req.json()
  if (!batchId) return NextResponse.json({ error: 'batchId obrigatório' }, { status: 400 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Busca todos os palpites do lote
  const [{ data: batchPreds }, { data: settings }] = await Promise.all([
    admin
      .from('predictions')
      .select('*, games(home_team, away_team)')
      .eq('batch_id', batchId)
      .eq('user_id', user.id),
    admin.from('settings').select('*').eq('id', 1).single(),
  ])

  if (!batchPreds || batchPreds.length === 0) {
    return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  }
  if (batchPreds.every((p: { paid: boolean }) => p.paid)) {
    return NextResponse.json({ error: 'Lote já pago' }, { status: 400 })
  }

  // Busca dados do usuário para o pagador
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const email = authUser?.email ?? 'pagador@chaconbet.com'

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const familyName = process.env.NEXT_PUBLIC_FAMILY_NAME ?? 'Família'
  const nameParts = (profile?.name ?? `Família ${familyName}`).trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || familyName

  const betValue = settings?.bet_value ?? 10
  const totalAmount = betValue * batchPreds.length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const game = (batchPreds[0] as any).games
  const bettorNames = batchPreds.map((p: { bettor_name: string | null }) => p.bettor_name ?? '').filter(Boolean).join(', ')
  const description = `${batchPreds.length}x Palpite(s) [${bettorNames}] - ${game?.home_team ?? ''} × ${game?.away_team ?? 'Copa 2026'}`

  // Cria cobrança PIX no Mercado Pago
  const idempotencyKey = `chaconbet-batch-${batchId}-${Date.now()}`

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: totalAmount,
      description,
      payment_method_id: 'pix',
      payer: { email, first_name: firstName, last_name: lastName },
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

  // Salva charge_id em TODOS os palpites do lote
  await admin
    .from('predictions')
    .update({ charge_id: String(paymentId) })
    .eq('batch_id', batchId)

  return NextResponse.json({
    paymentId,
    totalAmount,
    count: batchPreds.length,
    qrCode: pixData?.qr_code ?? null,
    qrCodeBase64: pixData?.qr_code_base64 ?? null,
  })
}
