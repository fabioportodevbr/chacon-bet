'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Game, Prediction, Settings } from '@/lib/supabase/types'
import { formatDate, isGameOpen, formatCurrency } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { TeamFlag } from './TeamFlag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Copy, CheckCircle2, Users, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [bettorsOpen, setBettorsOpen] = useState(game.status !== 'finished')
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

  type Bettor = { name: string; home_score: number; away_score: number; isMe: boolean; avatar: string | null; frase: string | null }
  const [bettors, setBettors] = useState<Bettor[] | null>(null)
  const [bettorsPaidCount, setBettorsPaidCount] = useState<number>(0)
  const [bettorsLoading, setBettorsLoading] = useState(false)

  const gameOpen = isGameOpen(game.game_date, game.status)
  const isBrazilGame = game.home_team === 'Brazil' || game.away_team === 'Brazil'

  // Palpite eliminado: jogo ao vivo e placar atual já ultrapassou a previsão em qualquer time
  function isEliminated(b: Bettor): boolean {
    if (game.status !== 'live' || game.home_score == null || game.away_score == null) return false
    return game.home_score > b.home_score || game.away_score > b.away_score
  }

  const fetchBettors = useCallback(() => {
    setBettorsLoading(true)
    fetch(`/api/games/${game.id}/bettors`)
      .then(r => r.ok ? r.json() : { bettors: [], paid_count: 0 })
      .then(d => { setBettors(d.bettors ?? []); setBettorsPaidCount(d.paid_count ?? 0) })
      .catch(() => { setBettors([]); setBettorsPaidCount(0) })
      .finally(() => setBettorsLoading(false))
  }, [game.id])

  useEffect(() => {
    if (isBrazilGame) fetchBettors()
  }, [isBrazilGame, fetchBettors])
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
      fetchBettors()
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


  const effectiveBetValue = settings?.bet_value ?? 10

  function statusBadge() {
    const s: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 0, letterSpacing: '0.03em' }
    if (game.status === 'finished') {
      if (isHit) return <span style={{ ...s, background: '#ECFDF5', color: '#065F46' }}>acertou!</span>
      return <span style={{ ...s, background: '#F5F4F1', color: '#78716C' }}>encerrado</span>
    }
    if (game.status === 'live') return (
      <span style={{ ...s, background: '#FEF2F2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
        ao vivo
      </span>
    )
    if (!gameOpen) return <span style={{ ...s, background: '#F5F4F1', color: '#78716C' }}>fechado</span>
    if (allPaid && !canBet) return <span style={{ ...s, background: '#ECFDF5', color: '#065F46' }}>confirmado</span>
    if (allPaid && canBet) return <span style={{ ...s, background: '#ECFDF5', color: '#065F46', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); openDialog() }}>confirmado</span>
    if (hasUnpaid) return <span style={{ ...s, background: '#FEF3C7', color: '#92400E', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); openPixForExisting() }}>pendente</span>
    if (isBrazilGame && !isNextBrazilGame) return <span style={{ ...s, background: '#F5F4F1', color: '#78716C' }}>em breve</span>
    if (canBet) return <span style={{ ...s, background: '#ECFDF5', color: '#065F46' }}>aberto</span>
    return null
  }

  // Conta apenas itens NOVOS (sem existingId) para o cálculo do valor a pagar
  const totalItems = items.filter(i => !i.existingId).reduce((acc, item) => {
    const h = item.homeScore === '' ? 0 : parseInt(item.homeScore)
    const a = item.awayScore === '' ? 0 : parseInt(item.awayScore)
    return acc + (item.bettorName.trim() && !isNaN(h) && !isNaN(a) ? 1 : 0)
  }, 0)

  const btnBase: React.CSSProperties = {
    WebkitAppearance: 'none',
    appearance: 'none',
    display: 'inline-block',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
    padding: '4px 9px',
    borderRadius: 0,
    border: '1px solid #1D3A28',
    background: '#F0F4F1',
    color: '#1D3A28',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    boxShadow: 'none',
    outline: 'none',
  }
  const btnPix: React.CSSProperties = { ...btnBase, border: '1px solid #92400E', background: '#FEF3C7', color: '#92400E' }

  return (
    <>
      <div
        style={{
          background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.07)',
          borderLeft: isBrazilGame ? '3px solid #7C5432' : undefined,
          marginBottom: 6,
          cursor: (canBet || hasPredictions) ? 'pointer' : 'default',
        }}
        onClick={() => { if (canBet || hasPredictions) openDialog() }}
      >
        {/* Meta: date + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px 0' }}>
          <span style={{ fontSize: 11, color: '#A09890' }}>{formatDate(game.game_date)}</span>
          {statusBadge()}
        </div>

        {/* Match */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px 10px', gap: 4 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <TeamFlag team={game.home_team} size={36} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#3D3530', textAlign: 'center', lineHeight: 1.2, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam}</span>
          </div>

          <div style={{ minWidth: 60, textAlign: 'center', flexShrink: 0 }}>
            {(game.status === 'finished' || game.status === 'live') && game.home_score != null ? (
              <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: -1, lineHeight: 1 }}>
                {game.home_score} × {game.away_score}
              </span>
            ) : (
              <span style={{ fontSize: 14, color: '#C7C0B8' }}>vs</span>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <TeamFlag team={game.away_team} size={36} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#3D3530', textAlign: 'center', lineHeight: 1.2, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam}</span>
          </div>
        </div>

        {/* Footer: Brazil games with palpite activity */}
        {isBrazilGame && (canBet || hasPredictions) && (
          <div style={{ borderTop: '1px solid #F5F3F0', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#78716C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hasPredictions
                ? predictions.map(p => p.bettor_name).filter(Boolean).join(' · ')
                : 'Nenhum palpite ainda'}
            </span>
            {game.status === 'finished' && isHit ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46', flexShrink: 0 }}>✓ acertou!</span>
            ) : hasUnpaid ? (
              <button style={btnPix} onClick={e => { e.stopPropagation(); openPixForExisting() }}>
                pagar via PIX
              </button>
            ) : canBet ? (
              <button style={btnBase} onClick={e => { e.stopPropagation(); openDialog() }}>
                + inserir palpite
              </button>
            ) : null}
          </div>
        )}

        {/* Apostadores — colapsável; aberto antes/durante, fechado após encerrado */}
        {isBrazilGame && (
          <div style={{ padding: '0 12px 8px' }} onClick={e => e.stopPropagation()}>
            <button
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: bettorsOpen ? 4 : 0 }}
              onClick={() => setBettorsOpen(v => !v)}
            >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#B0ABA5' }}>
              <Users size={11} />
              <span>
                {bettorsLoading
                  ? 'carregando...'
                  : bettors === null || bettors.length === 0
                    ? 'nenhum apostador ainda'
                    : game.status === 'finished'
                      ? (() => {
                          const w = bettors.filter(b => b.home_score === game.home_score && b.away_score === game.away_score).length
                          return w > 0
                            ? `${w} ganhador${w !== 1 ? 'es' : ''} · ${bettors.length} apostadores`
                            : `${bettors.length} apostadores · ninguém acertou`
                        })()
                      : (() => {
                          if (game.status !== 'live') return `${bettors.length} apostador${bettors.length !== 1 ? 'es' : ''}`
                          const elim = bettors.filter(b => isEliminated(b)).length
                          if (elim === 0) return `${bettors.length} apostador${bettors.length !== 1 ? 'es' : ''} · todos vivos`
                          const alive = bettors.length - elim
                          return `${alive} vivo${alive !== 1 ? 's' : ''} · ${elim} eliminado${elim !== 1 ? 's' : ''}`
                        })()}
              </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {!bettorsLoading && bettorsPaidCount > 0 && (settings?.bet_value ?? 0) > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2D6A4F' }}>
                    {formatCurrency(bettorsPaidCount * (settings?.bet_value ?? 0))}
                  </span>
                )}
                {bettorsOpen ? <ChevronUp size={12} color="#C7C0B8" /> : <ChevronDown size={12} color="#C7C0B8" />}
              </div>
            </div>
            </button>

            {bettorsOpen && bettors !== null && bettors.length > 0 && (
              <div style={{ paddingTop: 6, borderTop: '1px solid #F5F3F0' }} className="space-y-2">
                {bettorsLoading ? (
                  <p style={{ fontSize: 11, color: '#B0ABA5' }}>Carregando...</p>
                ) : !bettors || bettors.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#B0ABA5' }}>Nenhum palpite ainda.</p>
                ) : (
                  <>
                    {game.status === 'finished' && (() => {
                      const winners = bettors.filter(b => b.home_score === game.home_score && b.away_score === game.away_score)
                      const losers  = bettors.filter(b => !(b.home_score === game.home_score && b.away_score === game.away_score))
                      return (
                        <>
                          {winners.length > 0 && (
                            <>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>Acertaram</p>
                              {winners.map((b, i) => (
                                <div key={`w${i}`} className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <BettorAvatar avatar={b.avatar} name={b.name} size={20} />
                                    <div className="min-w-0">
                                      <p style={{ fontSize: 12, fontWeight: 600, color: '#3D3530', lineHeight: 1.2 }}>{b.name}{b.isMe ? ' ★' : ''}</p>
                                      {b.frase && <p style={{ fontSize: 11, color: '#A09890', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.frase}</p>}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{b.home_score}–{b.away_score}</span>
                                </div>
                              ))}
                            </>
                          )}
                          {losers.length > 0 && (
                            <>
                              <p style={{ fontSize: 11, color: '#B0ABA5', marginTop: 4 }}>{winners.length > 0 ? 'Não acertaram' : 'Ninguém acertou'}</p>
                              {losers.map((b, i) => (
                                <div key={`l${i}`} className="flex items-center justify-between opacity-50">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <BettorAvatar avatar={b.avatar} name={b.name} size={20} />
                                    <p style={{ fontSize: 12, color: '#78716C' }}>{b.name}</p>
                                  </div>
                                  <span style={{ fontSize: 12, color: '#B0ABA5', textDecoration: 'line-through', flexShrink: 0, marginLeft: 8 }}>{b.home_score}–{b.away_score}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )
                    })()}
                    {game.status !== 'finished' && (() => {
                      const alive = bettors.filter(b => !isEliminated(b))
                      const eliminated = bettors.filter(b => isEliminated(b))
                      return (
                        <>
                          {alive.map((b, i) => (
                            <div key={`a${i}`} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <BettorAvatar avatar={b.avatar} name={b.name} size={20} />
                                <div className="min-w-0">
                                  <p style={{ fontSize: 12, fontWeight: 600, color: b.isMe ? '#1D3A28' : '#3D3530', lineHeight: 1.2 }}>
                                    {b.name}{b.isMe ? ' ★' : ''}
                                  </p>
                                  {b.frase && <p style={{ fontSize: 11, color: '#A09890', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.frase}</p>}
                                </div>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: b.isMe ? '#1D3A28' : '#78716C', flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                                {b.home_score}–{b.away_score}
                              </span>
                            </div>
                          ))}
                          {eliminated.length > 0 && (
                            <>
                              {alive.length > 0 && <div style={{ borderTop: '1px solid #F5F3F0', margin: '4px 0' }} />}
                              {eliminated.map((b, i) => (
                                <div key={`e${i}`} className="flex items-center justify-between" style={{ opacity: 0.4 }}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <BettorAvatar avatar={b.avatar} name={b.name} size={20} />
                                    <p style={{ fontSize: 12, color: '#78716C', textDecoration: 'line-through' }}>{b.name}{b.isMe ? ' ★' : ''}</p>
                                  </div>
                                  <span style={{ fontSize: 12, color: '#B0ABA5', textDecoration: 'line-through', flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                                    {b.home_score}–{b.away_score}
                                  </span>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog de palpites — multi-entrada */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white rounded-lg max-h-[85vh] overflow-y-auto">
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
                  <div className="text-center flex flex-col items-center gap-1">
                    <TeamFlag team={game.home_team} size={32} />
                    <div className="text-xs font-semibold text-gray-600">{homeTeam}</div>
                  </div>
                  <span className="text-gray-300 text-base font-bold">×</span>
                  <div className="text-center flex flex-col items-center gap-1">
                    <TeamFlag team={game.away_team} size={32} />
                    <div className="text-xs font-semibold text-gray-600">{awayTeam}</div>
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
        <DialogContent className="bg-white rounded-lg">
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
