import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[MP Webhook]', JSON.stringify(body))

    // Mercado Pago envia notificações de dois formatos:
    // 1. { action: "payment.updated", data: { id: "123" } }
    // 2. { topic: "payment", resource: "https://api.mercadopago.com/v1/payments/123" }
    let paymentId: string | null = null

    if (body?.data?.id) {
      paymentId = String(body.data.id)
    } else if (body?.resource) {
      const match = String(body.resource).match(/\/payments\/(\d+)/)
      if (match) paymentId = match[1]
    } else if (body?.id && body?.topic === 'payment') {
      paymentId = String(body.id)
    }

    if (!paymentId) {
      return NextResponse.json({ ok: true, skipped: 'sem paymentId' })
    }

    // Consulta o pagamento no MP para confirmar status
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      // Pagamento não encontrado (ex: ID de teste) — retorna 200 para MP não retentar
      console.warn('[MP Webhook] Pagamento não encontrado ou erro MP:', paymentId, mpRes.status)
      return NextResponse.json({ ok: true, skipped: `mp_status=${mpRes.status}` })
    }

    const payment = await mpRes.json()
    console.log('[MP Webhook] status:', payment.status, 'id:', paymentId)

    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true, skipped: `status=${payment.status}` })
    }

    // Busca o palpite pelo charge_id e marca como pago
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: predictions } = await admin
      .from('predictions')
      .select('id, paid')
      .eq('charge_id', paymentId)

    if (!predictions || predictions.length === 0) {
      console.warn('[MP Webhook] Palpites não encontrados para charge_id', paymentId)
      return NextResponse.json({ ok: true, skipped: 'palpites não encontrados' })
    }

    if (predictions.every((p: { paid: boolean }) => p.paid)) {
      return NextResponse.json({ ok: true, skipped: 'já pagos' })
    }

    // Marca TODOS os palpites do lote como pagos
    await admin
      .from('predictions')
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq('charge_id', paymentId)

    console.log(`[MP Webhook] ${predictions.length} palpite(s) marcados como pagos para charge_id ${paymentId}`)
    return NextResponse.json({ ok: true, paidCount: predictions.length })
  } catch (err) {
    console.error('[MP Webhook] Erro inesperado:', err)
    // Retorna 200 mesmo em erro para MP não retentar indefinidamente
    return NextResponse.json({ ok: false, error: 'Erro interno' })
  }
}

// Mercado Pago às vezes faz GET para validar a URL
export async function GET() {
  return NextResponse.json({ ok: true })
}
