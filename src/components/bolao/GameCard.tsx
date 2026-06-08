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

// Avatar circular: foto ou iniciais coloridas
function BettorAvatar({ avatar, name, size = 32 }: { avatar: string | null; name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPhoto = !!avatar?.startsWith('http')
  return isPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatar!} alt={name} className="rounded-full object-cover shrink-0 border border-gray-200" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-green-600 flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>
}

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

type Item = { bettorName: string; homeScore: string; awayScore: string; existingId?: string }

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

  // Edição de scores dos palpites pagos (antes do jogo começar)
  const [paidEdits, setPaidEdits] = useState<Record<string, { homeScore: string; awayScore: string }>>({})

  // Apostadores colapsável
  type Bettor = { name: string; home_score: number; away_score: number; isMe: boolean; avatar: string | null; frase: string | null }
  const [bettorsOpen, setBettorsOpen] = useState(false)
  const [bettors, setBettors] = useState<Bettor[] | null>(null)
  const [bettorsLoading, setBettorsLoading] = useState(false)

  const gameOpen = isGameOpen(game.game_date, game.status)
  const isBrazilGame = game.home_team === 'Brazil' || game.away_team === 'Brazil'
  const canBet = gameOpen && isBrazilGame && (isNextBrazilGame || isAdmin)

  const paidPredictions = predictions.filter(p => p.paid)
  const unpaidPredictions = predictions.filter(p => !p.paid)
  const hasPredictions = predictions.length > 0
  const allPaid = hasPredictions && predictions.every(p => p.paid)
  const hasUnpaid = unpaidPredictions.length > 0
  // batch_id do lote pendente (para gerar/reabrir o PIX correto)
  const unpaidBatchId = unpaidPredictions[0]?.batch_id ?? null

  const isHit = game.status === 'finished' &&
    predictions.some(p => p.paid && p.home_score === game.home_score && p.away_score === game.away_score)

  const homeTeam = translateTeam(game.home_team)
  const awayTeam = translateTeam(game.away_team)

  function openDialog() {
    if (!canBet && !hasPredictions) return

    // Inicializa edições dos pagos com os scores atuais
    const edits: Record<string, { homeScore: string; awayScore: string }> = {}
    for (const p of paidPredictions) {
      edits[p.id] = { homeScore: p.home_score.toString(), awayScore: p.away_score.toString() }
    }
    setPaidEdits(edits)

    if (!canBet) {
      setItems([])
    } else if (unpaidPredictions.length > 0) {
      setItems(unpaidPredictions.map(p => ({
        bettorName: p.bettor_name ?? '',
        homeScore: p.home_score.toString(),
        awayScore: p.away_score.toString(),
        existingId: p.id,
      })))
    } else if (allPaid) {
      setItems([])
    } else {
      setItems([{ bettorName: userName, homeScore: '', awayScore: '' }])
    }

    // Carrega apostadores para checagem de placares duplicados
    if (bettors === null && !bettorsLoading) {
      setBettorsLoading(true)
      fetch(`/api/games/${game.id}/bettors`)
        .then(r => r.ok ? r.json() : { bettors: [] })
        .then(d => setBettors(d.bettors ?? []))
        .catch(() => setBettors([]))
        .finally(() => setBettorsLoading(false))
    }

    setConfirmDelete(false)
    setNameErrors([])
    setOpen(true)
  }

  // Retorna quantos outros apostadores já escolheram esse placar
  function duplicateCount(homeScore: string, awayScore: string): number {
    if (!bettors || homeScore === '' || awayScore === '') return 0
    const h = parseInt(homeScore)
    const a = parseInt(awayScore)
    if (isNaN(h) || isNaN(a)) return 0
    return bettors.filter(b => !b.isMe && b.home_score === h && b.away_score === a).length
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
    // Só valida itens com nome preenchido (ignora slots vazios não usados)
    const activeItems = items.filter(i => i.bettorName.trim() || i.homeScore || i.awayScore || i.existingId)
    const errors = items.map(i => {
      const hasContent = i.bettorName.trim() || i.homeScore || i.awayScore || i.existingId
      return !!hasContent && !i.bettorName.trim()
    })
    if (errors.some(Boolean)) {
      setNameErrors(errors)
      return
    }
    setNameErrors([])

    for (const item of activeItems) {
      const h = item.homeScore === '' ? 0 : parseInt(item.homeScore)
      const a = item.awayScore === '' ? 0 : parseInt(item.awayScore)
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
        toast.error(`Placar inválido para ${item.bettorName || 'um apostador'}`)
        return
      }
    }

    // Pede confirmação APENAS se algum campo novo ficou em branco (placeholder 0, não digitado)
    const hasEmpty = activeItems.filter(i => !i.existingId).some(i => i.homeScore === '' || i.awayScore === '')
    if (hasEmpty && !confirmScores) {
      setConfirmScores(true)
      return
    }

    setConfirmScores(false)
    setSaving(true)
    try {
      // Inclui edições dos palpites pagos como updates (existingId)
      const paidItems = paidPredictions.map(p => ({
        existingId: p.id,
        bettorName: p.bettor_name ?? '',
        homeScore: paidEdits[p.id]?.homeScore === '' ? 0 : parseInt(paidEdits[p.id]?.homeScore ?? p.home_score.toString()),
        awayScore: paidEdits[p.id]?.awayScore === '' ? 0 : parseInt(paidEdits[p.id]?.awayScore ?? p.away_score.toString()),
      }))

      const newItems = activeItems.map(i => ({
        ...(i.existingId ? { existingId: i.existingId } : {}),
        bettorName: i.bettorName.trim(),
        homeScore: i.homeScore === '' ? 0 : parseInt(i.homeScore),
        awayScore: i.awayScore === '' ? 0 : parseInt(i.awayScore),
      }))

      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          items: [...paidItems, ...newItems],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      onBatchSaved(game.id, data.predictions)
      setOpen(false)

      if (data.newCount > 0 && data.batchId) {
        toast.success(`${data.newCount} novo(s) palpite(s) salvos!`)
        setPixOpen(true)
        await createMpCharge(data.batchId)
      } else {
        toast.success('Palpites atualizados!')
      }
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
    if (!unpaidBatchId) return
    setPixOpen(true)
    await createMpCharge(unpaidBatchId)
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
    if (allPaid && !canBet) return <Badge className="bg-green-100 text-green-800 border-green-300 text-base font-bold">✓ Pago</Badge>
    if (allPaid && canBet) return <Badge className="bg-green-100 text-green-800 border-green-300 text-base font-bold cursor-pointer hover:bg-green-200" onClick={e => { e.stopPropagation(); openDialog() }}>✓ Pago · + pessoas</Badge>
    if (hasUnpaid) return (
      <Badge
        className="bg-orange-100 text-orange-700 border-orange-300 text-base cursor-pointer hover:bg-orange-200"
        onClick={e => { e.stopPropagation(); openPixForExisting() }}
      >
        💰 Pagar PIX ({formatCurrency(effectiveBetValue * unpaidPredictions.length)})
      </Badge>
    )
    if (isBrazilGame && !isNextBrazilGame) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-base">📅 Em breve</Badge>
    if (canBet) return <Badge className="bg-green-100 text-green-700 border-green-300 text-base font-semibold">🟢 Palpites abertos!</Badge>
    return <Badge className="bg-gray-100 text-gray-400 text-base">—</Badge>
  }

  // Conta apenas itens NOVOS (sem existingId) para o cálculo do valor a pagar
  const totalItems = items.filter(i => !i.existingId).reduce((acc, item) => {
    const h = item.homeScore === '' ? 0 : parseInt(item.homeScore)
    const a = item.awayScore === '' ? 0 : parseInt(item.awayScore)
    return acc + (item.bettorName.trim() && !isNaN(h) && !isNaN(a) ? 1 : 0)
  }, 0)

  return (
    <>
      <div
        className={`bg-white rounded-lg p-4 border shadow-sm transition-all ${
          (canBet || hasPredictions) ? 'cursor-pointer active:scale-95' : ''
        } ${isHit ? 'border-green-300' : allPaid ? 'border-green-100' : hasUnpaid ? 'border-orange-200' : 'border-gray-100'}`}
        onClick={() => { if (canBet || hasPredictions) openDialog() }}
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
              <div className={`border-2 rounded-md px-3 py-2 ${allPaid ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
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
              <div className="bg-gray-100 rounded-md px-3 py-2">
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
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-center">
            <p className="text-gray-500 text-sm font-medium leading-snug">
              📋 Placar para mera conferência. Palpites apenas nos jogos do Brasil.
            </p>
          </div>
        )}

        {/* Aviso para jogos do Brasil que não são o próximo */}
        {isBrazilGame && gameOpen && !isNextBrazilGame && !isAdmin && !hasPredictions && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 text-center">
            <p className="text-yellow-700 text-sm font-semibold leading-snug">
              🗓️ Palpites disponíveis após o término do jogo anterior
            </p>
          </div>
        )}

        {/* Apostadores colapsável — só em jogos do Brasil */}
        {isBrazilGame && (
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600 border border-gray-100"
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
              <div className="mt-1 border border-gray-100 rounded-md overflow-hidden">
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
                            <div key={`w${i}`} className="flex items-center justify-between px-3 py-2.5 bg-yellow-50">
                              <div className="flex items-center gap-2 min-w-0">
                                <BettorAvatar avatar={b.avatar} name={b.name} size={32} />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-yellow-800 leading-tight">{b.name}{b.isMe ? ' ⭐' : ''}</p>
                                  {b.frase && <p className="text-xs text-yellow-600 italic leading-tight truncate">{b.frase}</p>}
                                </div>
                              </div>
                              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-yellow-200 text-yellow-900 shrink-0 ml-2">
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
                                <div key={`l${i}`} className="flex items-center justify-between px-3 py-2.5 bg-white opacity-60">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <BettorAvatar avatar={b.avatar} name={b.name} size={28} />
                                    <p className="text-sm font-semibold text-gray-500 leading-tight">{b.name}</p>
                                  </div>
                                  <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 line-through shrink-0 ml-2">
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
                            <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white opacity-60">
                              <div className="flex items-center gap-2 min-w-0">
                                <BettorAvatar avatar={b.avatar} name={b.name} size={28} />
                                <p className="text-sm font-semibold text-gray-500 leading-tight">{b.name}</p>
                              </div>
                              <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 line-through shrink-0 ml-2">
                                {b.home_score} × {b.away_score}
                              </span>
                            </div>
                          ))}
                        </>
                      )
                    })()}

                    {game.status !== 'finished' && bettors.map((b, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${b.isMe ? 'bg-green-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <BettorAvatar avatar={b.avatar} name={b.name} size={32} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold leading-tight ${b.isMe ? 'text-green-700' : 'text-gray-700'}`}>
                              {b.name}{b.isMe ? ' ⭐' : ''}
                            </p>
                            {b.frase && (
                              <p className="text-xs text-gray-400 italic leading-tight truncate">{b.frase}</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ml-2 ${b.isMe ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
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
        <DialogContent className="bg-white max-w-sm mx-4 rounded-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {allPaid && canBet ? 'Palpites — Editar ou Adicionar'
                : allPaid && gameOpen ? 'Editar Placares'
                : allPaid ? 'Palpites confirmados'
                : 'Inserir Palpites'}
            </DialogTitle>
            <p className="text-xs text-gray-400">{homeTeam} × {awayTeam}</p>
          </DialogHeader>

          <div className="space-y-4 mt-2">

            {/* ── Palpites PAGOS — nome bloqueado, scores editáveis antes do jogo ── */}
            {paidPredictions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600">
                  Confirmados · {formatCurrency(effectiveBetValue * paidPredictions.length)}
                  {gameOpen && <span className="ml-1 font-normal text-green-500">(placar editável)</span>}
                </p>
                {paidPredictions.map(p => (
                  <div key={p.id} className="bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    {gameOpen ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-800 flex-1 text-sm truncate">{p.bettor_name}</span>
                          <Input
                            type="number" min="0" max="20"
                            value={paidEdits[p.id]?.homeScore ?? p.home_score.toString()}
                            onChange={e => setPaidEdits(prev => ({ ...prev, [p.id]: { homeScore: e.target.value, awayScore: prev[p.id]?.awayScore ?? p.away_score.toString() } }))}
                            className="w-12 text-center text-base font-black h-8 border-green-300 bg-white p-0"
                            placeholder="0"
                          />
                          <span className="text-green-600 font-bold shrink-0 text-sm">×</span>
                          <Input
                            type="number" min="0" max="20"
                            value={paidEdits[p.id]?.awayScore ?? p.away_score.toString()}
                            onChange={e => setPaidEdits(prev => ({ ...prev, [p.id]: { homeScore: prev[p.id]?.homeScore ?? p.home_score.toString(), awayScore: e.target.value } }))}
                            className="w-12 text-center text-base font-black h-8 border-green-300 bg-white p-0"
                            placeholder="0"
                          />
                        </div>
                        {(() => {
                          const n = duplicateCount(
                            paidEdits[p.id]?.homeScore ?? p.home_score.toString(),
                            paidEdits[p.id]?.awayScore ?? p.away_score.toString()
                          )
                          return n > 0 ? (
                            <p className="text-amber-600 text-xs font-semibold mt-1">
                              {n === 1 ? '1 usuário já escolheu' : `${n} usuários já escolheram`} esse placar. Quer prosseguir mesmo assim?
                            </p>
                          ) : null
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-green-800">{p.bettor_name}</span>
                        <span className="font-mono font-black text-green-700">{p.home_score} × {p.away_score}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Botão de salvar apenas edições de pagos (sem novo palpite) ── */}
            {gameOpen && paidPredictions.length > 0 && !canBet && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 font-bold h-10 text-sm"
                onClick={saveBatch}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            )}

            {/* ── Separador quando há pagos + formulário ── */}
            {paidPredictions.length > 0 && canBet && (
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs font-bold text-gray-400 uppercase px-2">
                  {hasUnpaid ? 'Palpites pendentes' : 'Novas pessoas'}
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            )}

            {/* ── Formulário de inserção — visível quando canBet ── */}
            {canBet && (
              <>
                {/* Jogo (flags) */}
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl">{game.home_flag}</div>
                    <div className="text-xs font-semibold mt-0.5 text-gray-600">{homeTeam}</div>
                  </div>
                  <span className="text-gray-300 text-base font-bold">×</span>
                  <div className="text-center">
                    <div className="text-2xl">{game.away_flag}</div>
                    <div className="text-xs font-semibold mt-0.5 text-gray-600">{awayTeam}</div>
                  </div>
                </div>

                {/* Lista de apostadores */}
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            value={item.bettorName}
                            onChange={e => updateItem(idx, 'bettorName', e.target.value)}
                            placeholder="Nome da pessoa"
                            className={`h-9 text-sm ${nameErrors[idx] ? 'border-red-400 bg-red-50 focus-visible:ring-red-400' : 'border-gray-200'}`}
                          />
                          {nameErrors[idx] && (
                            <p className="text-red-500 text-xs mt-0.5 font-semibold">Nome obrigatório</p>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button
                            className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-400 mb-0.5 block">{homeTeam}</Label>
                          <Input
                            type="number" min="0" max="20"
                            value={item.homeScore}
                            onChange={e => updateItem(idx, 'homeScore', e.target.value)}
                            className="text-center text-xl font-black h-10 border-gray-200"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-gray-400 text-base mt-4 font-bold">×</span>
                        <div className="flex-1">
                          <Label className="text-xs text-gray-400 mb-0.5 block">{awayTeam}</Label>
                          <Input
                            type="number" min="0" max="20"
                            value={item.awayScore}
                            onChange={e => updateItem(idx, 'awayScore', e.target.value)}
                            className="text-center text-xl font-black h-10 border-gray-200"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {(() => {
                        const n = duplicateCount(item.homeScore, item.awayScore)
                        return n > 0 ? (
                          <p className="text-amber-600 text-xs font-semibold">
                            {n === 1 ? '1 usuário já escolheu' : `${n} usuários já escolheram`} esse placar. Quer prosseguir mesmo assim?
                          </p>
                        ) : null
                      })()}
                    </div>
                  ))}
                </div>

                {/* Adicionar pessoa */}
                <button
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-md py-2.5 text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors font-semibold text-sm"
                  onClick={addItem}
                >
                  <Plus size={15} />
                  Adicionar outra pessoa
                </button>

                {/* Total a pagar (só novos) */}
                {totalItems > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2.5 flex items-center justify-between">
                    <p className="text-green-600 text-xs">
                      {totalItems} palpite{totalItems !== 1 ? 's' : ''} × {formatCurrency(effectiveBetValue)}
                    </p>
                    <span className="text-green-700 font-black text-base">
                      {formatCurrency(effectiveBetValue * totalItems)}
                    </span>
                  </div>
                )}

                {/* Confirmação de placar com zero */}
                {confirmScores && (
                  <div className="bg-amber-50 border border-amber-300 rounded-md p-3 space-y-3">
                    <p className="text-amber-800 font-bold text-sm text-center">Confirme os placares com zero</p>
                    <div className="space-y-2">
                      {items
                        .filter(i => i.homeScore === '' || i.awayScore === '')
                        .map((item, idx) => (
                          <div key={idx} className="bg-white border border-amber-200 rounded-md px-3 py-2 flex items-center justify-between">
                            <span className="font-semibold text-gray-700">{item.bettorName}</span>
                            <span className="font-mono font-black text-amber-700 text-lg">
                              {item.homeScore === '' ? '0' : item.homeScore} × {item.awayScore === '' ? '0' : item.awayScore}
                            </span>
                          </div>
                        ))}
                    </div>
                    <p className="text-amber-700 text-sm text-center">
                      Os campos em branco serão registrados como <strong>0</strong>. Confirma?
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-11 font-semibold border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setConfirmScores(false)}>
                        Corrigir
                      </Button>
                      <Button className="flex-1 h-11 font-bold bg-green-600 hover:bg-green-700 text-white" onClick={saveBatch} disabled={saving}>
                        {saving ? 'Salvando...' : 'Sim, confirmar'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Confirmar */}
                {!confirmScores && (
                  <Button
                    className="w-full bg-green-700 hover:bg-green-800 font-bold text-sm h-10"
                    onClick={saveBatch}
                    disabled={saving || (items.length === 0 && paidPredictions.length === 0)}
                  >
                    {saving ? 'Salvando...'
                      : items.some(i => !i.existingId && (i.bettorName.trim() || i.homeScore || i.awayScore))
                        ? 'Confirmar e gerar PIX'
                        : 'Salvar alterações'}
                  </Button>
                )}

                {/* Desistir dos palpites PENDENTES */}
                {hasUnpaid && !confirmDelete && (
                  <button
                    className="w-full text-sm text-red-400 hover:text-red-600 font-semibold py-1 transition-colors"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Desistir dos palpites pendentes
                  </button>
                )}

                {confirmDelete && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-md p-4 space-y-3">
                    <p className="text-red-700 font-bold text-base text-center">
                      Cancelar {unpaidPredictions.length} palpite(s) pendente(s)?
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog PIX */}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="bg-white max-w-sm mx-4 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Pagar via PIX 💸</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-gray-600 text-base">
              Envie{' '}
              <span className="font-black text-green-700 text-xl">
                {mpTotal != null ? formatCurrency(mpTotal) : formatCurrency(effectiveBetValue * unpaidPredictions.length)}
              </span>{' '}
              via PIX para confirmar {unpaidPredictions.length > 1 ? 'os palpites pendentes' : 'o palpite pendente'}
            </p>

            {unpaidPredictions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-left space-y-1">
                {unpaidPredictions.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{p.bettor_name}</span>
                    <span className="font-mono font-bold text-gray-700">{p.home_score} × {p.away_score}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              {mpLoading ? (
                <div className="w-52 h-52 rounded-md border-4 border-gray-100 bg-gray-50 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-gray-400">Gerando QR Code...</p>
                  </div>
                </div>
              ) : mpQrBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${mpQrBase64}`} alt="QR Code PIX" className="w-52 h-52 rounded-md border-4 border-gray-100" />
              ) : (
                <div className="w-52 h-52 rounded-md border-4 border-red-100 bg-red-50 flex items-center justify-center">
                  <p className="text-xs text-red-400 px-4">Erro ao gerar QR Code. Use o código abaixo.</p>
                </div>
              )}
            </div>

            {!mpLoading && (
              <button
                onClick={copyPixKey}
                disabled={!mpQrCode}
                className={`w-full flex items-center justify-center gap-2 rounded-md py-3 px-4 border-2 font-semibold text-base transition-all ${
                  copied ? 'bg-green-50 border-green-300 text-green-700'
                    : mpQrCode ? 'bg-gray-50 border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copied ? 'Código copiado!' : 'Copiar código PIX (copia e cola)'}
              </button>
            )}

            <div className="bg-green-50 rounded-md p-3 border border-green-200 text-left">
              <p className="text-xs text-green-800 font-semibold leading-snug">✅ Pagamento detectado automaticamente!</p>
              <p className="text-xs text-green-700 mt-1 leading-snug">
                Assim que o PIX for confirmado, {unpaidPredictions.length > 1 ? 'todos os palpites pendentes serão ativados' : 'o palpite será ativado'} sem precisar de aprovação manual.
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
