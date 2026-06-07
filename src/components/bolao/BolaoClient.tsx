'use client'

import { useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { formatDate, isGameOpen, phaseLabels, formatCurrency } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import GameCard from './GameCard'
import RankingTab from './RankingTab'
import { LogOut, Trophy, Target, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  user: User
  profile: Profile | null
  games: Game[]
  predictions: Prediction[]
  settings: Settings | null
  isAdmin?: boolean
}

export default function BolaoClient({ user, profile, games, predictions, settings, isAdmin = false }: Props) {
  const router = useRouter()
  const [myPredictions, setMyPredictions] = useState<Prediction[]>(predictions)

  const gamesByPhase = useMemo(() => {
    const phases: Record<string, Game[]> = {}
    for (const g of games) {
      if (!phases[g.phase]) phases[g.phase] = []
      phases[g.phase].push(g)
    }
    return phases
  }, [games])

  const phases = Object.keys(gamesByPhase)

  const stats = useMemo(() => {
    const totalBets = myPredictions.length
    const paidBets = myPredictions.filter(p => p.paid).length
    const pendingBets = totalBets - paidBets
    const hits = myPredictions.filter(p => {
      const game = games.find(g => g.id === p.game_id)
      return game && game.status === 'finished' &&
        game.home_score === p.home_score && game.away_score === p.away_score
    }).length
    return { totalBets, paidBets, pendingBets, hits }
  }, [myPredictions, games])

  function handlePredictionChange(updated: Prediction) {
    setMyPredictions(prev => {
      const existing = prev.findIndex(p => p.game_id === updated.game_id)
      if (existing >= 0) {
        const copy = [...prev]
        copy[existing] = updated
        return copy
      }
      return [...prev, updated]
    })
  }

  function handlePredictionDelete(gameId: string) {
    setMyPredictions(prev => prev.filter(p => p.game_id !== gameId))
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/entrar')
    router.refresh()
  }

  const phaseTabLabel: Record<string, string> = {
    group: 'Grupos',
    r32: 'Oitavas',
    r16: 'Quartas',
    qf: 'Semi',
    sf: 'Semi',
    '3rd': '3º Lugar',
    final: 'Final',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-black text-white text-xl leading-none">CHACON BET</h1>
            <p className="text-green-200 text-xs leading-snug">O bolão da Família Chacon na Copa de 2026! 🇧🇷</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base text-white font-semibold hidden sm:block">{profile?.name}</span>
            {profile?.is_admin && (
              <a href="/admin" className="text-sm bg-yellow-400 text-gray-900 px-3 py-1 rounded-full font-bold">
                ADMIN
              </a>
            )}
            <button onClick={logout} className="text-white hover:text-green-200 p-1">
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Saudação */}
        <p className="text-gray-600 text-lg font-medium">Olá, <span className="font-bold text-gray-900">{profile?.name}</span>! 👋</p>

        {/* Mascote */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote.gif"
            alt="Mascote CHACON BET"
            style={{ width: 260, height: 'auto' }}
            onError={e => { (e.target as HTMLImageElement).src = '/mascote.png' }}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Target className="mx-auto mb-1 text-green-600" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.totalBets}</div>
            <div className="text-sm text-gray-500 font-medium">Palpites</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Trophy className="mx-auto mb-1 text-yellow-500" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.hits}</div>
            <div className="text-sm text-gray-500 font-medium">Acertos</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Wallet className="mx-auto mb-1 text-orange-500" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.pendingBets}</div>
            <div className="text-sm text-gray-500 font-medium">Pendentes</div>
          </div>
        </div>

        {/* Valor do palpite */}
        {settings && settings.bet_value > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-1">
            <p className="text-green-800 text-base font-medium">
              Cada palpite custa{' '}
              <span className="font-black text-green-700 text-xl">{formatCurrency(settings.bet_value)}</span>
              {' '}via PIX
            </p>
            <p className="text-green-700 text-xs leading-snug">
              O prêmio final será a soma dos palpites pagos, descontada a taxa de processamento do Mercado Pago (1%).
            </p>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue={phases[0] ?? 'group'}>
          <TabsList className="bg-white border border-gray-200 w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 shadow-sm rounded-xl">
            {phases.map(phase => (
              <TabsTrigger
                key={phase}
                value={phase}
                className="text-sm font-semibold whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-600"
              >
                {phaseTabLabel[phase] ?? phase}
              </TabsTrigger>
            ))}
            <TabsTrigger
              value="ranking"
              className="text-sm font-semibold whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-yellow-500 data-[state=active]:text-white text-gray-600"
            >
              🏆 Ranking
            </TabsTrigger>
          </TabsList>

          {phases.map(phase => (
            <TabsContent key={phase} value={phase} className="mt-4 space-y-3">
              {phase === 'group' ? (
                Object.entries(
                  gamesByPhase['group'].reduce((acc, g) => {
                    const grp = g.group_name ?? '?'
                    if (!acc[grp]) acc[grp] = []
                    acc[grp].push(g)
                    return acc
                  }, {} as Record<string, Game[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([grp, grpGames]) => (
                  <div key={grp}>
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-2 px-1">
                      Grupo {grp}
                    </h3>
                    <div className="space-y-2">
                      {grpGames.map(game => (
                        <GameCard
                          key={game.id}
                          game={game}
                          prediction={myPredictions.find(p => p.game_id === game.id)}
                          userId={user.id}
                          isAdmin={isAdmin}
                          settings={settings}
                          onPredictionChange={handlePredictionChange}
                          onPredictionDelete={handlePredictionDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                gamesByPhase[phase].map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    prediction={myPredictions.find(p => p.game_id === game.id)}
                    userId={user.id}
                    isAdmin={isAdmin}
                    settings={settings}
                    onPredictionChange={handlePredictionChange}
                    onPredictionDelete={handlePredictionDelete}
                  />
                ))
              )}
            </TabsContent>
          ))}

          <TabsContent value="ranking" className="mt-4">
            <RankingTab games={games} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
