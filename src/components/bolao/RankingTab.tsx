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
  position: number
}

const isBrazilGame = (game: Pick<Game, 'home_team' | 'away_team'>) =>
  game.home_team === 'Brasil' || game.away_team === 'Brasil'

export default function RankingTab({ games }: { games: Game[] }) {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const brazilGamesPlayed = games.filter(g => isBrazilGame(g) && g.status === 'finished').length

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('predictions')
        .select('game_id, bettor_name, home_score, away_score, paid')

      if (!data) { setLoading(false); return }

      const brazilGames = games.filter(isBrazilGame)
      const brazilGameIds = new Set(brazilGames.map(g => g.id))
      const finishedBrazilGames = brazilGames.filter(g => g.status === 'finished')

      // Normalize known name variants to a canonical form
      const NAME_ALIASES: Record<string, string> = {
        'lilla & vida': 'Lilla e Vida',
        'lilla e vida': 'Lilla e Vida',
      }
      const normalizeName = (name: string) =>
        NAME_ALIASES[name.toLowerCase().trim()] ?? name.trim()

      // O ranking considera apenas os palpites feitos em jogos do Brasil.
      const byBettor: Record<string, Omit<RankingEntry, 'position'>> = {}
      for (const p of data) {
        if (!brazilGameIds.has(p.game_id)) continue

        const key = normalizeName(p.bettor_name ?? '?')
        if (!byBettor[key]) {
          byBettor[key] = { name: normalizeName(p.bettor_name ?? '?'), hits: 0, total: 0, paid: 0 }
        }
        byBettor[key].total++
        if (p.paid) byBettor[key].paid++
        const game = finishedBrazilGames.find(g => g.id === p.game_id)
        if (game && game.home_score === p.home_score && game.away_score === p.away_score) {
          byBettor[key].hits++
        }
      }

      // Mais acertos (em números absolutos) fica à frente; em caso de empate
      // no número de acertos, o melhor aproveitamento (acertos / palpites) desempata.
      const hitRate = (e: { hits: number; total: number }) => (e.total > 0 ? e.hits / e.total : 0)
      const sorted = Object.values(byBettor).sort((a, b) => b.hits - a.hits || hitRate(b) - hitRate(a))

      // Usuários com o mesmo número de acertos e mesmo aproveitamento dividem a mesma posição.
      const withPosition: RankingEntry[] = []
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i]
        const prev = sorted[i - 1]
        const tiedWithPrev = prev !== undefined && prev.hits === entry.hits && hitRate(prev) === hitRate(entry)
        withPosition.push({ ...entry, position: tiedWithPrev ? withPosition[i - 1].position : i + 1 })
      }

      setRanking(withPosition)
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
        Classificação geral · jogos do Brasil
      </div>

      {ranking.map((entry) => {
        const pct = entry.total > 0 ? Math.round((entry.hits / entry.total) * 100) : 0
        return (
          <div
            key={entry.name}
            style={{
              background: '#fff',
              border: '0.5px solid rgba(0,0,0,0.07)',
              borderLeft: `3px solid ${leftAccent[entry.position - 1] ?? 'rgba(0,0,0,0.07)'}`,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: entry.position === 1 ? '#B8962E' : '#A09890', width: 22, textAlign: 'center', flexShrink: 0 }}>
              {entry.position}º
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.name}</p>
              <p style={{ fontSize: 11, color: '#A09890', marginTop: 2 }}>{entry.total} palpite{entry.total !== 1 ? 's' : ''} no Brasil · {entry.paid} pago{entry.paid !== 1 ? 's' : ''}</p>
            </div>
            <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#57534E', lineHeight: 1 }}>{brazilGamesPlayed}</p>
                <p style={{ fontSize: 9, color: '#A09890', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>n. jogos</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#57534E', lineHeight: 1 }}>{entry.hits}</p>
                <p style={{ fontSize: 9, color: '#A09890', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>acertos</p>
              </div>
              <div style={{ textAlign: 'center', minWidth: 42 }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#1D3A28', lineHeight: 1 }}>{pct}%</p>
                <p style={{ fontSize: 9, color: '#A09890', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>aproveit.</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
