'use client'

import { useEffect, useState } from 'react'
import type { Game } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

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

      setRanking(
        Object.values(byUser).sort((a, b) => b.hits - a.hits || b.paid - a.paid)
      )
      setLoading(false)
    }
    load()
  }, [games])

  if (loading) return <div className="text-center text-gray-400 py-10 text-lg">Carregando ranking...</div>
  if (ranking.length === 0) return (
    <div className="text-center py-10">
      <div className="text-5xl mb-3">🏆</div>
      <p className="text-gray-500 text-lg">Nenhum palpite ainda.</p>
      <p className="text-gray-400 text-sm mt-1">O ranking aparece após os primeiros palpites.</p>
    </div>
  )

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-3">
      {ranking.map((entry, i) => (
        <div
          key={entry.name}
          className={`bg-white rounded-2xl p-4 border-2 shadow-sm flex items-center gap-4 ${
            i === 0 ? 'border-yellow-300' : i === 1 ? 'border-gray-300' : i === 2 ? 'border-orange-300' : 'border-gray-100'
          }`}
        >
          <span className="text-3xl w-10 text-center">
            {medals[i] ?? <span className="text-gray-500 font-bold text-xl">{i + 1}º</span>}
          </span>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-lg leading-tight">{entry.name}</p>
            <p className="text-sm text-gray-400 mt-0.5">{entry.total} palpite(s) · {entry.paid} pago(s)</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-green-600">{entry.hits}</p>
            <p className="text-xs text-gray-400 font-medium">acerto(s)</p>
          </div>
        </div>
      ))}
    </div>
  )
}
