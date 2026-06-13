'use client'

import { useEffect, useState } from 'react'
import type { Game } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Target } from 'lucide-react'

interface RankingEntry {
  name: string
  hits: number
  total: number
  paid: number
}

export default function RankingTab({ games }: { games: Game[] }) {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('predictions')
        .select('user_id, game_id, home_score, away_score, paid')

      if (!data) { setLoading(false); return }

      const profileIds = [...new Set(data.map(p => p.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', profileIds)

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
      const finishedGames = games.filter(g => g.status === 'finished')

      const byUser: Record<string, RankingEntry> = {}
      for (const p of data) {
        if (!byUser[p.user_id]) {
          byUser[p.user_id] = { name: profileMap[p.user_id] ?? '?', hits: 0, total: 0, paid: 0 }
        }
        byUser[p.user_id].total++
        if (p.paid) byUser[p.user_id].paid++
        const game = finishedGames.find(g => g.id === p.game_id)
        if (game && game.home_score === p.home_score && game.away_score === p.away_score) {
          byUser[p.user_id].hits++
        }
      }

      setRanking(Object.values(byUser).sort((a, b) => b.hits - a.hits || b.paid - a.paid))
      setLoading(false)
    }
    load()
  }, [games])

  if (loading) return (
    <div style={{ textAlign: 'center', color: '#B0ABA5', padding: '32px 0', fontSize: 14 }}>Carregando ranking...</div>
  )

  if (ranking.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#78716C' }}>Nenhum palpite ainda.</p>
      <p style={{ fontSize: 13, color: '#B0ABA5', marginTop: 4 }}>O ranking aparece após os primeiros palpites.</p>
    </div>
  )

  const leftAccent = ['#B8962E', '#A09890', '#7C5432']

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 10 }}>
        Classificação geral
      </div>

      {ranking.map((entry, i) => (
        <div
          key={entry.name}
          style={{
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.07)',
            borderLeft: `3px solid ${leftAccent[i] ?? 'rgba(0,0,0,0.07)'}`,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? '#B8962E' : '#A09890', width: 22, textAlign: 'center', flexShrink: 0 }}>
            {i + 1}º
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.name}</p>
            <p style={{ fontSize: 11, color: '#A09890', marginTop: 2 }}>{entry.paid} palpite{entry.paid !== 1 ? 's' : ''} pago{entry.paid !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#1D3A28', lineHeight: 1 }}>{entry.hits}</p>
            <p style={{ fontSize: 11, color: '#A09890', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>acerto{entry.hits !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
