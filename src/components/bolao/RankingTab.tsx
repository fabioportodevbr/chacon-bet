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
    <div className="text-center text-gray-400 py-10 text-sm font-medium">Carregando ranking...</div>
  )

  if (ranking.length === 0) return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
        <Trophy size={28} className="text-amber-400" />
      </div>
      <p className="text-gray-500 font-semibold">Nenhum palpite ainda.</p>
      <p className="text-gray-400 text-sm mt-1">O ranking aparece após os primeiros palpites.</p>
    </div>
  )

  const podium = [
    { bg: 'bg-amber-50',  border: 'border-amber-200', num: 'text-amber-500',  label: '1º' },
    { bg: 'bg-gray-50',   border: 'border-gray-200',  num: 'text-gray-400',   label: '2º' },
    { bg: 'bg-orange-50', border: 'border-orange-200',num: 'text-orange-400', label: '3º' },
  ]

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Trophy size={18} className="text-amber-500" />
        </div>
        <h3 className="font-bold text-gray-800 text-base">Classificação geral</h3>
      </div>

      {ranking.map((entry, i) => {
        const style = podium[i] ?? { bg: 'bg-white', border: 'border-gray-100', num: 'text-gray-500', label: `${i + 1}º` }
        return (
          <div
            key={entry.name}
            className={`${style.bg} rounded-2xl border ${style.border} shadow-sm px-4 py-3.5 flex items-center gap-3`}
          >
            <span className={`font-black text-lg w-8 text-center shrink-0 ${style.num}`}>
              {style.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base leading-tight truncate">{entry.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Target size={11} className="text-gray-400 shrink-0" />
                <p className="text-xs text-gray-400">{entry.paid} palpite{entry.paid !== 1 ? 's' : ''} pago{entry.paid !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black text-green-700 leading-none">{entry.hits}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">acerto{entry.hits !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
