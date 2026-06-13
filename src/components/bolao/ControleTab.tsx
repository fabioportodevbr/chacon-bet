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
    <div className="space-y-1.5">

      {/* Stats row 1 */}
      <div className="grid grid-cols-3 gap-1.5">
        {([
          { val: totalPalpites, label: 'Palpites',  color: '#1A1A1A' },
          { val: pagos,         label: 'Pagos',     color: '#2D6A4F' },
          { val: pendentes,     label: 'Pendentes', color: '#92400E' },
        ] as const).map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '11px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stats row 2 */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { val: acertos,                                        label: 'Acertos',   color: '#B8962E', mono: false },
          { val: prizesLoading ? '…' : formatCurrency(credito), label: 'A receber', color: '#1D3A28', mono: true  },
          { val: prizesLoading ? '…' : formatCurrency(recebido),label: 'Recebido',  color: '#2D6A4F', mono: true  },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '11px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: s.mono ? 13 : 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Total investido */}
      {betValue > 0 && pagos > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#78716C' }}>Total investido</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1D3A28' }}>{formatCurrency(pagos * betValue)}</span>
        </div>
      )}

      {/* Histórico header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', paddingTop: 8, paddingBottom: 4 }}>
        Histórico por jogo
      </div>

      {gameGroups.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '28px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#B0ABA5' }}>Nenhum palpite registrado ainda.</p>
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
          <div key={game.id} style={{
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.07)',
            borderLeft: gamePrizes.length > 0 ? '3px solid #B8962E' :
                        allPaid ? '3px solid #2D6A4F' :
                        hasUnpaid ? '3px solid #92400E' : undefined,
            marginBottom: 4,
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #F5F3F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#3D3530' }}>
                  {game.home_flag} {homeTeam} × {awayTeam} {game.away_flag}
                </p>
                <p style={{ fontSize: 11, color: '#A09890', marginTop: 2 }}>{formatDate(game.game_date)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {isFinished && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3530', fontVariantNumeric: 'tabular-nums' }}>
                    {game.home_score}–{game.away_score}
                  </span>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 0,
                  background: isFinished ? '#F5F4F1' : allPaid ? '#ECFDF5' : '#FEF3C7',
                  color: isFinished ? '#78716C' : allPaid ? '#065F46' : '#92400E',
                }}>
                  {isFinished ? 'encerrado' : allPaid ? 'pago' : 'pendente'}
                </span>
              </div>
            </div>

            <div>
              {preds.map((pred, i) => {
                const prize = gamePrizes.find(p => p.prediction_id === pred.id)
                const isWinner = isFinished && pred.paid &&
                  pred.home_score === game.home_score && pred.away_score === game.away_score

                return (
                  <div key={pred.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: isWinner ? '#FFFBEB' : i % 2 === 0 ? '#fff' : 'rgba(0,0,0,0.01)',
                    borderTop: i > 0 ? '1px solid #F5F3F0' : undefined,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: isWinner ? '#92400E' : '#3D3530' }}>
                        {pred.bettor_name ?? profile.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' as const }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: isWinner ? '#B8962E' : isFinished ? '#B0ABA5' : '#1D3A28',
                          textDecoration: isFinished && !isWinner ? 'line-through' : undefined,
                        }}>
                          {pred.home_score}–{pred.away_score}
                        </span>
                        <span style={{ color: '#E0DDD7', fontSize: 11 }}>·</span>
                        <span style={{ fontSize: 11, color: pred.paid ? '#2D6A4F' : '#92400E' }}>
                          {pred.paid ? 'pago' : 'pendente'}
                        </span>
                        {betValue > 0 && pred.paid && (
                          <>
                            <span style={{ color: '#E0DDD7', fontSize: 11 }}>·</span>
                            <span style={{ fontSize: 11, color: '#B0ABA5' }}>{formatCurrency(betValue)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {prize && (
                      <div style={{
                        textAlign: 'right', flexShrink: 0, padding: '4px 8px',
                        background: prize.prize_paid ? '#ECFDF5' : '#FFFBEB',
                        border: `0.5px solid ${prize.prize_paid ? '#A7F3D0' : '#FDE68A'}`,
                      }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: prize.prize_paid ? '#065F46' : '#92400E' }}>
                          {formatCurrency(prize.prize_amount)}
                        </p>
                        <p style={{ fontSize: 11, color: prize.prize_paid ? '#2D6A4F' : '#B8962E' }}>
                          {prize.prize_paid ? 'recebido' : 'a receber'}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {betValue > 0 && preds.some(p => p.paid) && (
              <div style={{ padding: '6px 12px', background: '#FAFAF9', borderTop: '1px solid #F5F3F0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#A09890' }}>{preds.filter(p => p.paid).length} pago(s) neste jogo</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3D3530' }}>{formatCurrency(preds.filter(p => p.paid).length * betValue)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
