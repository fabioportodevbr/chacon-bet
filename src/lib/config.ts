/**
 * Configurações centrais do app — altere apenas as variáveis de ambiente
 * para replicar para outra família.
 *
 * Variáveis de ambiente necessárias:
 *   NEXT_PUBLIC_FAMILY_NAME   → nome da família (ex: "Chacon", "Silva", "Souza")
 *   NEXT_PUBLIC_ADMIN_NAME    → nome do administrador (ex: "Fabio")
 *   NEXT_PUBLIC_ADMIN_WHATSAPP → WhatsApp do admin, só números (ex: "61982336525")
 */

export const FAMILY_NAME =
  process.env.NEXT_PUBLIC_FAMILY_NAME ?? 'Chacon'

export const APP_NAME = `${FAMILY_NAME.toUpperCase()} BET`

export const APP_SUBTITLE = `O bolão da Família ${FAMILY_NAME} na Copa de 2026! 🇧🇷`

export const ADMIN_NAME =
  process.env.NEXT_PUBLIC_ADMIN_NAME ?? 'Fabio'

export const ADMIN_WHATSAPP =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '61982336525'
