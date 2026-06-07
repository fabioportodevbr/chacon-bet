'use client'

import { useState } from 'react'
import type { Game, Prediction, Settings } from '@/lib/supabase/types'
import { formatDate, isGameOpen, formatCurrency } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Copy, CheckCircle2, Users, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

interface Props {
  game: Game
  predictions: Prediction[]
  userId: string
  userName?: string
  isAdmin?: boolean
  isNextBrazilGame?: boolean
  settings: Settings | null
  onBatchSaved: (gameId: string, newPredictions: Prediction[]) => void
  onBatchDeleted: (gameId: string) => void
}

type Item = { bettorName: string; homeScore: string; awayScore: string }

export default function GameCard({
  game, predictions, userId, userName = '', isAdmin = false,
  isNextBrazilGame = false, settings, onBatchSaved, onBatchDeleted,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pixOpen, setPixOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmScores, setConfirmScores] = useState(false)
  const [nameErrors, setNameErrors] = useState<boolean[]>([])
  const [copied, setCopied] = useState(false)
  const [mpQrCode, setMpQrCode] = useState<string | null>(null)
  const [mpQrBase64, setMpQrBase64] = useState<string | null>(null)
  const [mpLoading, setMpLoading] = useState(false)
  const [mpTotal, setMpTotal] = useState<number | null>(null)

  // Itens do formulário multi-entrada
  const [items, setItems] = useState<Item[]>([])

  // Apostadores colapsável
  type Bettor = { name: string; home_score: number; away_score: number; isMe: boolean }
  const [bettorsOpen, setBettorsOpen] = useState(false)
  const [bettors, setBettors] = useState<Bettor[] | null>(null)
  const [bettorsLoading, setBettorsLoading] = useState(false)

  const gameOpen = isGameOpen(game.game_date, game.status)
  const isBrazilGame = game.home_team === 'Brazil' || game.away_team === 'Brazil'
  const canBet = gameOpen && isBrazilGame && (isNextBrazilGame || isAdmin)

  const hasPredictions = predictions.length > 0
  const allPaid = hasPredictions && predictions.every(p => p.paid)
  const hasUnpaid = hasPredictions && predictions.some(p => !p.paid)
  const batchId = predictions[0]?.batch_id ?? null

  const isHit = game.status === 'finished' &&
    predictions.some(p => p.paid && p.home_score === game.home_score && p.away_score === game.away_score)

  const homeTeam = translateTeam(game.home_team)
  const awayTeam = translateTeam(game.away_team)

  function openDialog() {
    if (!canBet && !hasPredictions) return
    // Pré-popula com palpites existentes (não pagos) ou item em branco
    if (predictions.length > 0 && !allPaid) {
      setItems(predictions.map(p => ({
        bettorName: p.bettor_name ?? '',
        homeScore: p.home_score.toString(),
        awayScore: p.away_score.toString(),
      })))
    } else if (predictions.length === 0) {
      setItems([{ bettorName: userName, homeScore: '', awayScore: '' }])
    }
    setConfirmDelete(false)
    setNameErrors([])
    setOpen(true)
  }

  function addItem() {
    setItems(prev => [...prev, { bettorName: '', homeScore: '', awayScore: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setConfirmScores(false)
    if (field === 'bettorName') {
      setNameErrors(prev => prev.map((e, i) => i === idx ? false : e))
    }
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function saveBatch() {
    // Validação: destaca campos de nome vazios
    const errors = items.map(i => !i.bettorName.trim())
    if (errors.some(Boolean)) {
      setNameErrors(errors)
      return
    }
    setNameErrors([])

    for (const item of items) {
      // Campo vazio é tratado como 0 (ver confirmação abaixo); outros valores devem ser numéricos
      const h = item.homeScore === '' ? 0 : parseInt(item.homeScore)
      const a = item.awayScore === '' ? 0 : parseInt(item.awayScore)
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
        toast.error(`Placar inválido para ${item.bettorName || 'um apostador'}`)
        return
      }
    }

    // Pede confirmação APENAS se algum campo ficou em branco (placeholder 0, não digitado)
    const hasEmpty = items.some(i => i.homeScore === '' || i.awayScore === '')
    if (hasEmpty && !confirmScores) {
      setConfirmScores(true)
      return
    }

    setConfirmScores(false)
    setSaving(true)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          items: items.map(i => ({
            bettorName: i.bettorName.trim(),
            homeScore: i.homeScore === '' ? 0 : parseInt(i.homeScore),
            awayScore: i.awayScore === '' ? 0 : parseInt(i.awayScore),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      onBatchSaved(game.id, data.predictions)
      toast.success(`${data.predictions.length} palpite(s) salvos!`)
      setOpen(false)

      // Abre PIX automaticamente
      setPixOpen(true)
      await createMpCharge(data.batchId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar palpites')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBatch() {
    setDeleting(true)
    try {
      const res = await fetch('/api/predictions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Palpites cancelados.')
      setConfirmDelete(false)
      setOpen(false)
      onBatchDeleted(game.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar')
    } finally {
      setDeleting(false)
    }
  }

  async function openPixForExisting() {
    if (!batchId) return
    setPixOpen(true)
    await createMpCharge(batchId)
  }

  async function createMpCharge(bId: string) {
    setMpLoading(true)
    setMpQrCode(null)
    setMpQrBase64(null)
    setMpTotal(null)
    try {
      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: bId }),
      })
      if (res.ok) {
        const d = await res.json()
        setMpQrCode(d.qrCode)
        setMpQrBase64(d.qrCodeBase64)
        setMpTotal(d.totalAmount)
      }
    } catch { /* silencia */ }
    setMpLoading(false)
  }

  function copyPixKey() {
    if (!mpQrCode) return
    navigator.clipboard.writeText(mpQrCode)
    setCopied(true)
    toast.success('Código PIX copiado!')
    setTimeout(() => setCopied(false), 3000)
  }

  async function toggleBettors(e: React.MouseEvent) {
    e.stopPropagation()
    if (bettors !== null) { setBettorsOpen(v => !v); return }
    setBettorsOpen(true)
    setBettorsLoading(true)
    try {
      const res = await fetch(`/api/games/${game.id}/bettors`)
      if (res.ok) { const d = await res.json(); setBettors(d.bettors) }
      else setBettors([])
    } catch { setBettors([]) }
    setBettorsLoading(false)
  }

  const effectiveBetValue = settings?.bet_value ?? 10

  function statusBadge() {
    if (game.status === 'finished') {
      if (isHit) return <Badge className="bg-green-100 text-green-800 border-green-300 text-base font-bold">✓ Acertou!</Badge>
      if (hasPredictions) return <Badge className="bg-red-100 text-red-700 border-red-300 text-base">Errou</Badge>
      return <Badge className="bg-gray-100 text-gray-500 text-base">Encerrado</Badge>
    }
    if (game.status === 'live') return <Badge className="bg-red-500 text-white text-base animate-pulse">● Ao Vivo</Badge>
    if (!gameOpen) return <Badge className="bg-gray-100 text-gray-500 text-base">Fechado</Badge>
    if (allPaid) return <Badge className="bg-green-100 text-green-800 border-green-300 text-base font-bold">✓ Pago</Badge>
    if (hasUnpaid) return (
      <Badge
        className="bg-orange-100 text-orange-700 border-orange-300 text-base cursor-pointer hover:bg-orange-200"
        onClick={e => { e.stopPropagation(); openPixForExisting() }}
      >
        💰 Pagar PIX ({formatCurrency(effectiveBetValue * predictions.length)})
      </Badge>
    )
    if (isBrazilGame && !isNextBrazilGame) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-base">📅 Em breve</Badge>
    if (canBet) return <Badge className="bg-green-100 text-green-700 border-green-300 text-base font-semibold">🟢 Palpites abertos!</Badge>
    return <Badge className="bg-gray-100 text-gray-400 text-base">—</Badge>
  }

  const totalItems = items.reduce((acc, item) => {
    const h = item.homeScore === '' ? 0 : parseInt(item.homeScore)
    const a = item.awayScore === '' ? 0 : parseInt(item.awayScore)
    return acc + (item.bettorName.trim() && !isNaN(h) && !isNaN(a) ? 1 : 0)
  }, 0)

  return (
    <>
      <div
        className={`bg-white rounded-2xl p-4 border-2 shadow-sm transition-all ${
          (canBet || hasPredictions) ? 'cursor-pointer active:scale-95' : ''
        } ${isHit ? 'border-green-400' : allPaid ? 'border-blue-200' : hasUnpaid ? 'border-orange-200' : 'border-gray-100'}`}
        onClick={() => { if (canBet || (hasPredictions && !allPaid)) openDialog() }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-base text-gray-400 font-medium">{formatDate(game.game_date)}</span>
          {statusBadge()}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{game.home_flag ?? '🏳️'}</div>
            <div className="text-lg font-bold text-gray-800 leading-tight">{homeTeam}</div>
            {game.status === 'finished' && (
              <div className="text-4xl font-black text-gray-900 mt-2">{game.home_score}</div>
            )}
          </div>

          <div className="text-center px-2 min-w-[100px]">
            {game.status === 'finished' ? (
              <span className="text-2xl font-bold text-gray-400">×</span>
            ) : hasPredictions ? (
              <div className={`border-2 rounded-xl px-3 py-2 ${allPaid ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                {predictions.length === 1 ? (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 truncate max-w-[80px] mx-auto">{predictions[0].bettor_name}</p>
                    <p className={`font-black text-lg ${allPaid ? 'text-green-700' : 'text-orange-700'}`}>
                      {predictions[0].home_score} × {predictions[0].away_score}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className={`font-black text-base ${allPaid ? 'text-green-700' : 'text-orange-700'}`}>
                      {predictions.length} palpites
                    </p>
                    <p className="text-xs text-gray-500 leading-tight">
                      {predictions.map(p => p.bettor_name).filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            ) : canBet ? (
              <div className="bg-gray-100 rounded-xl px-3 py-2">
                <span className="text-gray-400 font-bold text-sm">Inserir Palpite</span>
              </div>
            ) : (
              <span className="text-gray-400 text-xl font-bold">vs</span>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{game.away_flag ?? '🏳️'}</div>
            <div className="text-lg font-bold text-gray-800 leading-tight">{awayTeam}</div>
            {game.status === 'finished' && (
              <div className="text-4xl font-black text-gray-900 mt-2">{game.away_score}</div>
            )}
          </div>
        </div>

        {game.venue && (
          <p className="text-sm text-gray-400 text-center mt-3">{game.venue}</p>
        )}

        {/* Aviso para jogos sem Brasil */}
        {!isBrazilGame && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-center">
            <p className="text-gray-500 text-sm font-medium leading-snug">
              📋 Placar para mera conferência. Palpites apenas nos jogos do Brasil.
            </p>
          </div>
        )}

        {/* Aviso para jogos do Brasil que não são o próximo */}
        {isBrazilGame && gameOpen && !isNextBrazilGame && !isAdmin && !hasPredictions && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-center">
            <p className="text-yellow-700 text-sm font-semibold leading-snug">
              🗓️ Palpites disponíveis após o término do jogo anterior
            </p>
          </div>
        )}

        {/* Apostadores colapsável — só em jogos do Brasil */}
        {isBrazilGame && (
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600 border border-gray-100"
              onClick={toggleBettors}
            >
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">
                  {bettors !== null
                    ? bettors.length === 0
                      ? 'Nenhum apostador ainda'
                      : game.status === 'finished'
                        ? (() => {
                            const w = bettors.filter(b => b.home_score === game.home_score && b.away_score === game.away_score).length
                            return w > 0
                              ? `🏆 ${w} ganhador${w !== 1 ? 'es' : ''} · ${bettors.length} apostador${bettors.length !== 1 ? 'es' : ''}`
                              : `${bettors.length} apostador${bettors.length !== 1 ? 'es' : ''} · ninguém acertou`
                          })()
                        : `${bettors.length} apostador${bettors.length !== 1 ? 'es' : ''}`
                    : 'Ver apostadores'}
                </span>
              </div>
              {bettorsOpen
                ? <ChevronUp size={14} className="text-gray-400" />
                : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {bettorsOpen && (
              <div className="mt-1 border border-gray-100 rounded-xl overflow-hidden">
                {bettorsLoading ? (
                  <p className="text-sm text-gray-400 text-center py-3">Carregando...</p>
                ) : !bettors || bettors.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">Nenhum palpite ainda. Seja o primeiro! 🎯</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {game.status === 'finished' && (() => {
                      const winners = bettors.filter(b => b.home_score === game.home_score && b.away_score === game.away_score)
                      const losers = bettors.filter(b => !(b.home_score === game.home_score && b.away_score === game.away_score))
                      if (winners.length > 0) return (
                        <>
                          <div className="bg-yellow-50 px-3 py-1.5 border-b border-yellow-100">
                            <p className="text-sm font-bold text-yellow-700">🏆 Acertaram o placar!</p>
                          </div>
                          {winners.map((b, i) => (
                            <div key={`w${i}`} className="flex items-center justify-between px-3 py-2 bg-yellow-50">
                              <span className="text-sm font-bold text-yellow-800">🥇 {b.isMe ? '⭐ ' : ''}{b.name}</span>
                              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-yellow-200 text-yellow-900">
                                {b.home_score} × {b.away_score}
                              </span>
                            </div>
                          ))}
                          {losers.length > 0 && (
                            <>
                              <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100">
                                <p className="text-sm font-semibold text-gray-400">Não acertaram</p>
                              </div>
                              {losers.map((b, i) => (
                                <div key={`l${i}`} className="flex items-center justify-between px-3 py-2 bg-white opacity-60">
                                  <span className="text-sm font-semibold text-gray-500">{b.isMe ? '⭐ ' : ''}{b.name}</span>
                                  <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 line-through">
                                    {b.home_score} × {b.away_score}
                                  </span>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )
                      return (
                        <>
                          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100">
                            <p className="text-sm font-semibold text-gray-400">Ninguém acertou o placar</p>
                          </div>
                          {bettors.map((b, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white opacity-60">
                              <span className="text-sm font-semibold text-gray-500">{b.isMe ? '⭐ ' : ''}{b.name}</span>
                              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 line-through">
                                {b.home_score} × {b.away_score}
                              </span>
                            </div>
                          ))}
                        </>
                      )
                    })()}

                    {game.status !== 'finished' && bettors.map((b, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 ${b.isMe ? 'bg-green-50' : 'bg-white'}`}>
                        <span className={`text-sm font-semibold ${b.isMe ? 'text-green-700' : 'text-gray-700'}`}>
                          {b.isMe ? '⭐ ' : ''}{b.name}
                        </span>
                        <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-lg ${b.isMe ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {b.home_score} × {b.away_score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog de palpites — multi-entrada */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {allPaid ? '✅ Seus Palpites' : 'Inserir Palpites'}
            </DialogTitle>
            <p className="text-sm text-gray-500">{homeTeam} × {awayTeam}</p>
          </DialogHeader>

          {/* Visualização readonly para palpites pagos */}
          {allPaid ? (
            <div className="space-y-3 mt-2">
              {predictions.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <span className="font-semibold text-green-800">{p.bettor_name}</span>
                  <span className="font-mono font-black text-green-700 text-lg">{p.home_score} × {p.away_score}</span>
                </div>
              ))}
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                <p className="text-green-700 font-bold">✅ Pagamento confirmado!</p>
                <p className="text-green-600 text-sm">{predictions.length} palpite(s) · {formatCurrency(effectiveBetValue * predictions.length)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Jogo */}
              <div className="flex items-center justify-center gap-4 py-1">
                <div className="text-center">
                  <div className="text-3xl">{game.home_flag}</div>
                  <div className="text-sm font-bold mt-1 text-gray-700">{homeTeam}</div>
                </div>
                <span className="text-gray-400 text-xl font-bold">×</span>
                <div className="text-center">
                  <div className="text-3xl">{game.away_flag}</div>
                  <div className="text-sm font-bold mt-1 text-gray-700">{awayTeam}</div>
                </div>
              </div>

              {/* Lista de apostadores */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 font-semibold mb-1 block">Nome da pessoa</Label>
                        <Input
                          value={item.bettorName}
                          onChange={e => updateItem(idx, 'bettorName', e.target.value)}
                          placeholder="Ex: João, Maria..."
                          className={`h-10 text-base ${nameErrors[idx] ? 'border-red-400 bg-red-50 focus-visible:ring-red-400' : 'border-gray-200'}`}
                        />
                        {nameErrors[idx] && (
                          <p className="text-red-500 text-xs mt-1 font-semibold">⚠️ Nome obrigatório</p>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button
                          className="mt-5 text-gray-400 hover:text-red-500 transition-colors p-1"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1 block">{homeTeam}</Label>
                        <Input
                          type="number" min="0" max="20"
                          value={item.homeScore}
                          onChange={e => updateItem(idx, 'homeScore', e.target.value)}
                          className="text-center text-2xl font-black h-12 border-gray-200"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-gray-400 text-xl mt-4 font-bold">×</span>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1 block">{awayTeam}</Label>
                        <Input
                          type="number" min="0" max="20"
                          value={item.awayScore}
                          onChange={e => updateItem(idx, 'awayScore', e.target.value)}
                          className="text-center text-2xl font-black h-12 border-gray-200"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão adicionar pessoa */}
              <button
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors font-semibold text-base"
                onClick={addItem}
              >
                <Plus size={18} />
                Adicionar outra pessoa
              </button>

              {/* Total */}
              {totalItems > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-semibold text-base">Total a pagar:</span>
                    <span className="text-green-700 font-black text-xl">
                      {formatCurrency(effectiveBetValue * totalItems)}
                    </span>
                  </div>
                  <p className="text-green-600 text-sm mt-0.5">
                    {totalItems} palpite{totalItems !== 1 ? 's' : ''} × {formatCurrency(effectiveBetValue)}
                  </p>
                </div>
              )}

              {/* Confirmação de placar com zero */}
              {confirmScores && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                  <p className="text-amber-800 font-black text-base text-center">
                    ⚠️ Confirme os placares com zero
                  </p>
                  <div className="space-y-2">
                    {items
                      .filter(i => i.homeScore === '' || i.awayScore === '')
                      .map((item, idx) => {
                        const h = item.homeScore === '' ? '0' : item.homeScore
                        const a = item.awayScore === '' ? '0' : item.awayScore
                        return (
                          <div key={idx} className="bg-white border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between">
                            <span className="font-semibold text-gray-700">{item.bettorName}</span>
                            <span className="font-mono font-black text-amber-700 text-lg">
                              {h} × {a}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                  <p className="text-amber-700 text-sm text-center">
                    Os campos em branco serão registrados como <strong>0</strong>. Confirma?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 font-semibold border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => setConfirmScores(false)}
                    >
                      Corrigir
                    </Button>
                    <Button
                      className="flex-1 h-11 font-bold bg-green-600 hover:bg-green-700 text-white"
                      onClick={saveBatch}
                      disabled={saving}
                    >
                      {saving ? 'Salvando...' : 'Sim, confirmar'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirmar */}
              {!confirmScores && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 font-bold text-lg h-12"
                  onClick={saveBatch}
                  disabled={saving || items.length === 0}
                >
                  {saving ? 'Salvando...' : `Confirmar e gerar PIX`}
                </Button>
              )}

              {/* Desistir do lote */}
              {hasUnpaid && !confirmDelete && (
                <button
                  className="w-full text-sm text-red-400 hover:text-red-600 font-semibold py-1 transition-colors"
                  onClick={() => setConfirmDelete(true)}
                >
                  Desistir de todos os palpites deste jogo
                </button>
              )}

              {confirmDelete && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-red-700 font-bold text-base text-center">
                    Cancelar {predictions.length} palpite(s)?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-11 font-semibold" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                      Não
                    </Button>
                    <Button className="flex-1 h-11 font-bold bg-red-600 hover:bg-red-700 text-white" onClick={deleteBatch} disabled={deleting}>
                      {deleting ? 'Cancelando...' : 'Sim, cancelar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog PIX */}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="bg-white max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Pagar via PIX 💸</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-gray-600 text-base">
              Envie{' '}
              <span className="font-black text-green-700 text-xl">
                {mpTotal != null ? formatCurrency(mpTotal) : formatCurrency(effectiveBetValue * predictions.length)}
              </span>{' '}
              via PIX para confirmar {predictions.length > 1 ? 'todos os palpites' : 'seu palpite'}
            </p>

            {predictions.length > 1 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-left space-y-1">
                {predictions.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{p.bettor_name}</span>
                    <span className="font-mono font-bold text-gray-700">{p.home_score} × {p.away_score}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              {mpLoading ? (
                <div className="w-52 h-52 rounded-xl border-4 border-gray-100 bg-gray-50 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-gray-400">Gerando QR Code...</p>
                  </div>
                </div>
              ) : mpQrBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${mpQrBase64}`} alt="QR Code PIX" className="w-52 h-52 rounded-xl border-4 border-gray-100" />
              ) : (
                <div className="w-52 h-52 rounded-xl border-4 border-red-100 bg-red-50 flex items-center justify-center">
                  <p className="text-xs text-red-400 px-4">Erro ao gerar QR Code. Use o código abaixo.</p>
                </div>
              )}
            </div>

            {!mpLoading && (
              <button
                onClick={copyPixKey}
                disabled={!mpQrCode}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 border-2 font-semibold text-base transition-all ${
                  copied ? 'bg-green-50 border-green-300 text-green-700'
                    : mpQrCode ? 'bg-gray-50 border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copied ? 'Código copiado!' : 'Copiar código PIX (copia e cola)'}
              </button>
            )}

            <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-left">
              <p className="text-xs text-green-800 font-semibold leading-snug">✅ Pagamento detectado automaticamente!</p>
              <p className="text-xs text-green-700 mt-1 leading-snug">
                Assim que o PIX for confirmado, {predictions.length > 1 ? 'todos os palpites serão ativados' : 'seu palpite será ativado'} sem precisar de aprovação manual.
              </p>
            </div>

            <Button className="w-full h-12 text-base font-bold" variant="outline" onClick={() => setPixOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
