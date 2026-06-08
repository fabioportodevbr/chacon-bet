'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { Wallet, Target, CheckCircle2, Trophy, TrendingUp, History } from 'lucide-react'

interface PrizeSummary {
  prediction_id: string
  game_id: string
  bettor_name: string | null
  prize_amount: number
  prize_paid: boolean
  prize_paid_at: string | null
}

interface Props {
  profile: Profile
  predictions: Prediction[]
  games: Game[]
  settings: Settings | null
}

function SectionHeader({ icon: Icon, iconBg, iconColor, title }: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-md ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <h3 className="font-bold text-gray-800 text-base">{title}</h3>
    </div>
  )
}

export default function ControleTab({ profile, predictions, games, settings }: Props) {
  const [prizes, setPrizes] = useState<PrizeSummary[]>([])
  const [prizesLoading, setPrizesLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me/prize-summary')
      .then(r => r.json())
      .then(d => { if (d.prizes) setPrizes(d.prizes) })
      .catch(() => {})
      .finally(() => setPrizesLoading(false))
  }, [])

  const betValue = settings?.bet_value ?? 0

  const totalPalpites = predictions.length
  const pagos = predictions.filter(p => p.paid).length
  const pendentes = predictions.filter(p => !p.paid).length

  const acertos = useMemo(() => {
    return predictions.filter(p => {
      if (!p.paid) return false
      const game = games.find(g => g.id === p.game_id)
      return game?.status === 'finished' &&
        game.home_score === p.home_score &&
        game.away_score === p.away_score
    }).length
  }, [predictions, games])

  const credito = useMemo(() =>
    prizes.filter(p => !p.prize_paid).reduce((acc, p) => acc + p.prize_amount, 0),
    [prizes]
  )
  const recebido = useMemo(() =>
    prizes.filter(p => p.prize_paid).reduce((acc, p) => acc + p.prize_amount, 0),
    [prizes]
  )

  const gameGroups = useMemo(() => {
    const map: Record<string, Prediction[]> = {}
    for (const p of predictions) {
      if (!map[p.game_id]) map[p.game_id] = []
      map[p.game_id].push(p)
    }
    return Object.entries(map)
      .map(([gameId, preds]) => ({
        game: games.find(g => g.id === gameId),
        preds,
      }))
      .filter(item => item.game)
      .sort((a, b) => {
        const da = a.game?.game_date ? new Date(a.game.game_date).getTime() : 0
        const db = b.game?.game_date ? new Date(b.game.game_date).getTime() : 0
        return db - da
      })
  }, [predictions, games])

  return (
    <div className="space-y-5">
      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { Icon: Target,       bg: 'bg-green-50',  color: 'text-green-700', val: totalPalpites, label: 'Palpites'  },
          { Icon: CheckCircle2, bg: 'bg-blue-50',   color: 'text-blue-600',  val: pagos,         label: 'Pagos'     },
          { Icon: Wallet,       bg: 'bg-orange-50', color: 'text-orange-500',val: pendentes,     label: 'Pendentes' },
        ].map(({ Icon, bg, color, val, label }) => (
          <div key={label} className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100">
            <div className={`w-8 h-8 rounded-md ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon size={16} className={color} />
            </div>
            <div className="text-2xl font-black text-gray-900 leading-none">{val}</div>
            <div className="text-xs text-gray-400 font-medium mt-1.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { Icon: Trophy,     bg: 'bg-amber-50',  color: 'text-amber-500',  val: acertos,                                       label: 'Acertos',       mono: false },
          { Icon: TrendingUp, bg: 'bg-purple-50', color: 'text-purple-500', val: prizesLoading ? '…' : formatCurrency(credito), label: 'A receber',    mono: true  },
          { Icon: Wallet,     bg: 'bg-green-50',  color: 'text-green-600',  val: prizesLoading ? '…' : formatCurrency(recebido),label: 'Recebido',     mono: true  },
        ].map(({ Icon, bg, color, val, label, mono }) => (
          <div key={label} className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100">
            <div className={`w-8 h-8 rounded-md ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon size={16} className={color} />
            </div>
            <div className={`font-black text-gray-900 leading-none ${mono ? 'text-base' : 'text-2xl'}`}>{val}</div>
            <div className="text-xs text-gray-400 font-medium mt-1.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Total investido ─────────────────────────────────────────────────── */}
      {betValue > 0 && pagos > 0 && (
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between">
          <span className="text-gray-600 font-medium text-sm">Total investido</span>
          <span className="font-black text-green-700 text-base">{formatCurrency(pagos * betValue)}</span>
        </div>
      )}

      {/* ── Histórico ───────────────────────────────────────────────────────── */}
      <SectionHeader icon={History} iconBg="bg-slate-100" iconColor="text-slate-500" title="Histórico por jogo" />

      {gameGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-8 text-center text-gray-400 text-sm">
          Nenhum palpite registrado ainda.
        </div>
      ) : gameGroups.map(({ game, preds }) => {
        if (!game) return null
        const isFinished = game.status === 'finished'
        const allPaid = preds.every(p => p.paid)
        const hasUnpaid = preds.some(p => !p.paid)
        const gamePrizes = prizes.filter(p => p.game_id === game.id)
        const homeTeam = translateTeam(game.home_team)
        const awayTeam = translateTeam(game.away_team)

        return (
          <div key={game.id} className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
            isFinished && gamePrizes.length > 0 ? 'border-amber-200' :
            allPaid ? 'border-green-100' :
            hasUnpaid ? 'border-orange-200' : 'border-gray-100'
          }`}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm leading-tight">
                  {game.home_flag} {homeTeam} × {awayTeam} {game.away_flag}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(game.game_date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {isFinished && (
                  <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                    {game.home_score} × {game.away_score}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isFinished ? 'bg-gray-100 text-gray-500' :
                  allPaid ? 'bg-green-100 text-green-700' :
                  hasUnpaid ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {isFinished ? 'Encerrado' : allPaid ? '✅ Pago' : '⏳ Pendente'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {preds.map((pred, i) => {
                const prize = gamePrizes.find(p => p.prediction_id === pred.id)
                const isWinner = isFinished && pred.paid &&
                  pred.home_score === game.home_score && pred.away_score === game.away_score

                return (
                  <div key={pred.id} className={`flex items-center gap-3 px-4 py-3 ${isWinner ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isWinner && <Trophy size={13} className="text-amber-500 shrink-0" />}
                        <p className={`font-semibold text-sm ${isWinner ? 'text-amber-800' : 'text-gray-900'}`}>
                          {pred.bettor_name ?? profile.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-mono font-bold ${
                          isWinner ? 'text-amber-600' :
                          isFinished ? 'text-gray-400 line-through' : 'text-green-700'
                        }`}>
                          {pred.home_score} × {pred.away_score}
                        </span>
                        <span className="text-gray-200">·</span>
                        <span className={`text-xs font-medium ${pred.paid ? 'text-green-600' : 'text-orange-500'}`}>
                          {pred.paid ? 'Pago' : 'Pendente'}
                        </span>
                        {betValue > 0 && pred.paid && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{formatCurrency(betValue)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {prize && (
                      <div className={`text-right shrink-0 px-2.5 py-1.5 rounded-md ${prize.prize_paid ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <p className={`text-xs font-bold ${prize.prize_paid ? 'text-green-700' : 'text-amber-700'}`}>
                          {formatCurrency(prize.prize_amount)}
                        </p>
                        <p className={`text-xs ${prize.prize_paid ? 'text-green-500' : 'text-amber-500'}`}>
                          {prize.prize_paid ? 'Recebido' : 'A receber'}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {betValue > 0 && preds.some(p => p.paid) && (
              <div className="px-4 py-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {preds.filter(p => p.paid).length} pago(s) neste jogo
                </span>
                <span className="text-xs font-bold text-gray-600">
                  {formatCurrency(preds.filter(p => p.paid).length * betValue)}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
