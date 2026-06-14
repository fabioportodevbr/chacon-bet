import { NextResponse } from 'next/server'

// Este endpoint não faz chamadas externas — o cron /api/cron/sync-games
// roda a cada minuto e o Supabase Realtime empurra as atualizações para
// todos os clientes conectados. Chamadas diretas à API-Sports aqui eram
// feitas por cada aba aberta de cada usuário, esgotando a quota em minutos.
export async function GET() {
  return NextResponse.json({ ok: true })
}
