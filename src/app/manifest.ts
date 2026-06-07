import type { MetadataRoute } from 'next'
import { APP_NAME, FAMILY_NAME } from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: `Bolão da Copa do Mundo 2026 — Família ${FAMILY_NAME}`,
    start_url: '/bolao',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#15803d',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
