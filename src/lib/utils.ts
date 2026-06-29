import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'A definir'
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Returns true if the current time in BRT is at or after the 14:00 cutoff on game day. */
export function isPast14hBRT(gameDateStr: string): boolean {
  const tz = 'America/Sao_Paulo'
  const now = new Date()
  const gameDate = new Date(gameDateStr)

  const todayBRT = now.toLocaleDateString('pt-BR', { timeZone: tz })
  const gameDayBRT = gameDate.toLocaleDateString('pt-BR', { timeZone: tz })
  if (todayBRT !== gameDayBRT) return false

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return h * 60 + m >= 14 * 60
}

export function isGameOpen(gameDateStr: string | null, status: string): boolean {
  if (status !== 'scheduled') return false
  if (!gameDateStr) return true
  if (new Date(gameDateStr) <= new Date()) return false
  if (isPast14hBRT(gameDateStr)) return false
  return true
}

/** Retorna true se hoje (horário de Brasília) é o mesmo dia do jogo */
export function isGameDay(gameDateStr: string | null): boolean {
  if (!gameDateStr) return false
  const tz = 'America/Sao_Paulo'
  const now = new Date()
  const gameDate = new Date(gameDateStr)

  const todayStr = now.toLocaleDateString('pt-BR', { timeZone: tz })
  const gameDayStr = gameDate.toLocaleDateString('pt-BR', { timeZone: tz })

  return todayStr === gameDayStr
}

export const phaseLabels: Record<string, string> = {
  group: 'Fase de Grupos',
  r32: 'Oitavas de Final',
  r16: 'Quartas de Final',
  qf: 'Semifinal',
  sf: 'Semifinal',
  '3rd': 'Disputa de 3º Lugar',
  final: 'Final',
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
