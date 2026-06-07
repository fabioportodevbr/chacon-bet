'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { Pencil, Wallet, Target, CheckCircle2, Trophy, TrendingUp } from 'lucide-react'
import ProfileEditDialog from './ProfileEditDialog'

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
  onProfileUpdated: (p: Profile) => void
}

export default function ControleTab({ profile, predictions, games, settings, onProfileUpdated }: Props) {
  const [editOpen, setEditOpen] = useState(false)
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

  // ─── Stats globais ────────────────────────────────────────────────────────────
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

  // ─── Agrupa palpites por jogo ──────────────────────────────────────────────
  const gameGroups = useMemo(() => {
    const map: Record<string, Prediction[]> = {}
    for (const p of predictions) {
      if (!map[p.game_id]) map[p.game_id] = []
      map[p.game_id].push(p)
    }
    // Ordena por data do jogo (mais recente primeiro)
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
      {/* ── Cartão de perfil ─────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-5 flex items-center gap-4 cursor-pointer hover:border-green-400 transition-colors active:scale-[0.99]"
        onClick={() => setEditOpen(true)}
      >
        <span className="text-5xl leading-none shrink-0">{profile.avatar_url || '👤'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 text-xl leading-tight">{profile.name}</p>
          {profile.frase
            ? <p className="text-sm text-gray-400 italic mt-0.5 truncate">&ldquo;{profile.frase}&rdquo;</p>
            : <p className="text-sm text-green-600 font-medium mt-0.5">Toque para personalizar seu perfil ✏️</p>
          }
        </div>
        <Pencil size={18} className="text-gray-300 shrink-0" />
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm text-center">
          <Target className="mx-auto mb-1 text-green-600" size={20} />
          <div className="text-2xl font-black text-gray-900">{totalPalpites}</div>
          <div className="text-xs text-gray-500 font-medium leading-tight">Palpites</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm text-center">
          <CheckCircle2 className="mx-auto mb-1 text-blue-500" size={20} />
          <div className="text-2xl font-black text-gray-900">{pagos}</div>
          <div className="text-xs text-gray-500 font-medium leading-tight">Pagos</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-orange-100 shadow-sm text-center bg-orange-50">
          <Wallet className="mx-auto mb-1 text-orange-500" size={20} />
          <div className="text-2xl font-black text-orange-600">{pendentes}</div>
          <div className="text-xs text-orange-500 font-medium leading-tight">Pendentes</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-yellow-200 shadow-sm text-center bg-yellow-50">
          <Trophy className="mx-auto mb-1 text-yellow-500" size={20} />
          <div className="text-2xl font-black text-yellow-600">{acertos}</div>
          <div className="text-xs text-yellow-600 font-medium leading-tight">Acertos</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-purple-200 shadow-sm text-center bg-purple-50">
          <TrendingUp className="mx-auto mb-1 text-purple-500" size={20} />
          <div className="text-lg font-black text-purple-700 leading-tight">
            {prizesLoading ? '…' : formatCurrency(credito)}
          </div>
          <div className="text-xs text-purple-600 font-medium leading-tight">Crédito prêmio</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-green-200 shadow-sm text-center bg-green-50">
          <Wallet className="mx-auto mb-1 text-green-600" size={20} />
          <div className="text-lg font-black text-green-700 leading-tight">
            {prizesLoading ? '…' : formatCurrency(recebido)}
          </div>
          <div className="text-xs text-green-600 font-medium leading-tight">Já recebido</div>
        </div>
      </div>

      {/* ── Gasto total ──────────────────────────────────────────────────────── */}
      {betValue > 0 && pagos > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between">
          <span className="text-blue-700 font-semibold text-sm">Total investido em palpites pagos</span>
          <span className="font-black text-blue-800 text-lg">{formatCurrency(pagos * betValue)}</span>
        </div>
      )}

      {/* ── Por jogo ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700 text-base">📋 Histórico por jogo</h3>

        {gameGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
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
            <div key={game.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${
              isFinished && gamePrizes.length > 0 ? 'border-yellow-200' :
              allPaid ? 'border-blue-100' :
              hasUnpaid ? 'border-orange-200' : 'border-gray-100'
            }`}>
              {/* Cabeçalho do jogo */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 text-sm leading-tight">
                    {game.home_flag} {homeTeam} × {awayTeam} {game.away_flag}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(game.game_date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {isFinished && (
                    <span className="text-xs font-mono font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                      {game.home_score} × {game.away_score}
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isFinished ? 'bg-gray-100 text-gray-500' :
                    allPaid ? 'bg-green-100 text-green-700' :
                    hasUnpaid ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {isFinished ? 'Encerrado' : allPaid ? '✅ Pago' : '⏳ Pendente'}
                  </span>
                </div>
              </div>

              {/* Palpites deste jogo */}
              <div className="divide-y divide-gray-50">
                {preds.map((pred, i) => {
                  const prize = gamePrizes.find(p => p.prediction_id === pred.id)
                  const isWinner = isFinished && pred.paid &&
                    pred.home_score === game.home_score && pred.away_score === game.away_score

                  return (
                    <div key={pred.id} className={`flex items-center gap-3 px-4 py-3 ${isWinner ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isWinner && <span className="text-base">🏆</span>}
                          <p className={`font-semibold text-sm ${isWinner ? 'text-yellow-800' : 'text-gray-900'}`}>
                            {pred.bettor_name ?? profile.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-mono font-bold ${
                            isWinner ? 'text-yellow-700' :
                            isFinished ? 'text-gray-400 line-through' : 'text-green-700'
                          }`}>
                            {pred.home_score} × {pred.away_score}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className={`text-xs font-semibold ${pred.paid ? 'text-green-600' : 'text-orange-500'}`}>
                            {pred.paid ? '✅ Pago' : '⏳ Aguardando'}
                          </span>
                          {betValue > 0 && pred.paid && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{formatCurrency(betValue)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Prêmio */}
                      {prize && (
                        <div className={`text-right shrink-0 px-2.5 py-1.5 rounded-xl ${prize.prize_paid ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          <p className={`text-xs font-bold ${prize.prize_paid ? 'text-green-700' : 'text-yellow-700'}`}>
                            {formatCurrency(prize.prize_amount)}
                          </p>
                          <p className={`text-xs ${prize.prize_paid ? 'text-green-600' : 'text-yellow-600'}`}>
                            {prize.prize_paid ? '💸 Recebido' : '⏳ A receber'}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Subtotal do jogo */}
              {betValue > 0 && preds.some(p => p.paid) && (
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {preds.filter(p => p.paid).length} palpite(s) pago(s) neste jogo
                  </span>
                  <span className="text-xs font-bold text-gray-700">
                    {formatCurrency(preds.filter(p => p.paid).length * betValue)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dialog de edição de perfil */}
      <ProfileEditDialog
        profile={profile}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onProfileUpdated}
      />
    </div>
  )
}
