'use client'

import { useState } from 'react'
import type { Member, Settings, Game } from '@/lib/supabase/types'
import { APP_NAME } from '@/lib/config'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, formatCurrency, generateInviteCode } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { toast } from 'sonner'
import { Copy, Plus, Check, X, ArrowLeft, RefreshCw, Trash2, ChevronDown, ChevronUp, CreditCard, Users, Trophy, Target, Settings2 } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/lib/supabase/types'
import ProfileEditDialog from '@/components/bolao/ProfileEditDialog'

interface PredictionWithProfile {
  id: string
  user_id: string
  game_id: string
  bettor_name: string | null
  batch_id: string | null
  home_score: number
  away_score: number
  paid: boolean
  paid_at: string | null
  prize_paid: boolean
  prize_paid_at: string | null
  created_at: string
  profiles: { name: string; avatar_url: string | null; frase: string | null } | null
}

interface Props {
  adminProfile: Profile | null
  members: Member[]
  settings: Settings | null
  games: Game[]
  predictions: PredictionWithProfile[]
}

function AvatarCircle({ avatarUrl, name, size = 32 }: { avatarUrl?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPhoto = !!avatarUrl?.startsWith('http')
  return isPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl!} alt={name} className="rounded-full object-cover border-2 border-white/40 shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-green-700 flex items-center justify-center text-white font-bold shrink-0 border-2 border-white/40" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>
}

export default function AdminClient({ adminProfile: initialAdminProfile, members: initialMembers, settings: initialSettings, games, predictions: initialPredictions }: Props) {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(initialAdminProfile)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [members, setMembers] = useState(initialMembers)
  const [settings, setSettings] = useState(initialSettings)
  const [predictions, setPredictions] = useState(initialPredictions)
  const [newMemberName, setNewMemberName] = useState('')
  const [saving, setSaving] = useState(false)
  const [gameScores, setGameScores] = useState<Record<string, { home: string; away: string }>>({})
  const [adminTab, setAdminTab] = useState('payments')

  // ─── Membros ─────────────────────────────────────────────────────────────────

  async function addMember() {
    if (!newMemberName.trim()) return
    const code = generateInviteCode()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName.trim(), invite_code: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMembers(prev => [data.member, ...prev])
      setNewMemberName('')
      toast.success(`Convite criado: ${code}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar membro')
    } finally {
      setSaving(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success('Código copiado!')
  }

  // ─── Configurações ────────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettings(data.settings)
      toast.success('Configurações salvas!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ─── Sync football-data.org ──────────────────────────────────────────────────

  async function syncGames() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/sync-games', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Sincronizado! ${data.created} novos, ${data.updated} atualizados (total: ${data.total})`)
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSaving(false)
    }
  }

  // ─── Resultados ──────────────────────────────────────────────────────────────

  async function saveResult(gameId: string) {
    const scores = gameScores[gameId]
    if (!scores) return
    const h = parseInt(scores.home)
    const a = parseInt(scores.away)
    if (isNaN(h) || isNaN(a)) { toast.error('Placar inválido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, homeScore: h, awayScore: a, status: 'finished' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Resultado salvo!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar resultado')
    } finally {
      setSaving(false)
    }
  }

  // ─── Pagamentos ──────────────────────────────────────────────────────────────

  async function togglePrizePaid(predictionId: string, prizePaid: boolean) {
    try {
      const res = await fetch('/api/admin/prize-payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId, prizePaid }),
      })
      if (!res.ok) throw new Error('Erro')
      setPredictions(prev => prev.map(p =>
        p.id === predictionId
          ? { ...p, prize_paid: prizePaid, prize_paid_at: prizePaid ? new Date().toISOString() : null }
          : p
      ))
      toast.success(prizePaid ? '💸 Prêmio marcado como pago!' : 'Prêmio desmarcado')
    } catch {
      toast.error('Erro ao atualizar prêmio')
    }
  }

  async function togglePaid(predictionId: string, paid: boolean) {
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId, paid }),
      })
      if (!res.ok) throw new Error('Erro')
      setPredictions(prev => prev.map(p =>
        p.id === predictionId ? { ...p, paid } : p
      ))
      toast.success(paid ? 'Marcado como pago' : 'Marcado como pendente')
    } catch {
      toast.error('Erro ao atualizar pagamento')
    }
  }

  const pendingPredictions = predictions.filter(p => !p.paid)
  const paidPredictions = predictions.filter(p => p.paid)
  const totalArrecadado = paidPredictions.length * (settings?.bet_value ?? 0)

  // ─── Palpites ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [predictionsFilter, setPredictionsFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set())
  const [addPredGameId, setAddPredGameId] = useState<string | null>(null)
  const [addPredForm, setAddPredForm] = useState({ userId: '', bettorName: '', homeScore: '', awayScore: '', paid: true })
  const [addingPred, setAddingPred] = useState(false)

  const registeredMembers = members.filter(m => m.user_id)

  async function addPrediction(gameId: string) {
    if (!addPredForm.userId || !addPredForm.bettorName.trim()) {
      toast.error('Selecione o usuário e informe o nome do apostador')
      return
    }
    setAddingPred(true)
    try {
      const res = await fetch('/api/admin/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          userId: addPredForm.userId,
          bettorName: addPredForm.bettorName,
          homeScore: addPredForm.homeScore === '' ? 0 : Number(addPredForm.homeScore),
          awayScore: addPredForm.awayScore === '' ? 0 : Number(addPredForm.awayScore),
          paid: addPredForm.paid,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPredictions(prev => [...prev, data.prediction])
      setAddPredGameId(null)
      setAddPredForm({ userId: '', bettorName: '', homeScore: '', awayScore: '', paid: true })
      toast.success('Palpite inserido!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao inserir palpite')
    } finally {
      setAddingPred(false)
    }
  }

  async function deletePrediction(predictionId: string) {
    setDeletingId(predictionId)
    try {
      const res = await fetch('/api/admin/predictions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setPredictions(prev => prev.filter(p => p.id !== predictionId))
      setConfirmDeleteId(null)
      toast.success('Palpite excluído!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  function toggleGameExpand(gameId: string) {
    setExpandedGames(prev => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId); else next.add(gameId)
      return next
    })
  }

  // Agrupa palpites por jogo
  const filteredPredictions = predictions.filter(p =>
    predictionsFilter === 'all' ? true :
    predictionsFilter === 'paid' ? p.paid : !p.paid
  )
  const predictionsByGame = games.map(game => ({
    game,
    preds: filteredPredictions.filter(p => p.game_id === game.id),
  })).filter(item => item.preds.length > 0)

  return (
    <div className="min-h-screen" style={{ background: '#E8E4DE' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 overflow-hidden"
        style={{ background: '#1D3A28', borderBottom: '2px solid #B8962E' }}
      >
        <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', border: '0.5px solid rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -36, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', right: 60, top: 8, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.025)' }} />
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3" style={{ paddingTop: 16, paddingBottom: 12, position: 'relative' }}>
          <Link href="/bolao" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>Painel Admin</h1>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{APP_NAME}</p>
          </div>
          {adminProfile && (
            <button
              onClick={() => setProfileEditOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.09)', border: '0.5px solid rgba(255,255,255,0.18)', padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}
            >
              <AvatarCircle avatarUrl={adminProfile.avatar_url} name={adminProfile.name} size={26} />
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }} className="hidden sm:block max-w-[80px] truncate">
                {adminProfile.name}
              </span>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto" style={{ padding: '12px 12px 24px' }}>
        {/* Resumo financeiro */}
        <div className="grid grid-cols-3 gap-1.5" style={{ marginBottom: 12 }}>
          {([
            { val: members.length,             label: 'Membros',     color: '#1A1A1A' },
            { val: pendingPredictions.length,   label: 'PIX pend.',  color: '#92400E' },
            { val: formatCurrency(totalArrecadado), label: 'Arrecadado', color: '#1D3A28', small: true },
          ] as const).map(s => (
            <div key={s.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '11px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 'small' in s && s.small ? 14 : 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={adminTab} onValueChange={setAdminTab}>
          <div className="flex overflow-x-auto" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7', padding: '0 12px', marginBottom: 12 }}>
            {([
              { value: 'payments',    Icon: CreditCard, label: 'Pagamentos' },
              { value: 'members',     Icon: Users,      label: 'Membros'    },
              { value: 'games',       Icon: Trophy,     label: 'Resultados' },
              { value: 'predictions', Icon: Target,     label: 'Palpites'   },
              { value: 'settings',    Icon: Settings2,  label: 'Config'     },
            ] as const).map(({ value, Icon, label }) => (
              <button
                key={value}
                onClick={() => setAdminTab(value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '9px 8px',
                  fontSize: 12, fontWeight: adminTab === value ? 600 : 500,
                  color: adminTab === value ? '#1D3A28' : '#9CA3AF',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${adminTab === value ? '#B8962E' : 'transparent'}`,
                  marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
                }}
              >
                <Icon size={13} strokeWidth={adminTab === value ? 2.5 : 1.8} />
                {label}
              </button>
            ))}
          </div>

          {/* PAGAMENTOS */}
          <TabsContent value="payments" className="mt-0 space-y-4">
            {pendingPredictions.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 8 }}>
                  Aguardando confirmação ({pendingPredictions.length})
                </div>
                <div className="space-y-1.5">
                  {pendingPredictions.map(p => {
                    const game = games.find(g => g.id === p.game_id)
                    return (
                      <div key={p.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderLeft: '3px solid #92400E', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AvatarCircle avatarUrl={p.profiles?.avatar_url} name={p.bettor_name ?? p.profiles?.name ?? '?'} size={34} />
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{p.bettor_name ?? p.profiles?.name}</p>
                          {p.profiles?.frase && <p style={{ fontSize: 10, color: '#A09890', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.profiles.frase}</p>}
                          <p style={{ fontSize: 11, color: '#78716C', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {game ? `${game.home_flag ?? ''} ${translateTeam(game.home_team)} × ${translateTeam(game.away_team)} ${game.away_flag ?? ''}` : '—'}
                          </p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#1D3A28', marginTop: 2 }}>
                            Palpite: {p.home_score}–{p.away_score}
                          </p>
                        </div>
                        <button
                          style={{ background: '#1D3A28', border: 'none', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 0, flexShrink: 0 }}
                          onClick={() => togglePaid(p.id, true)}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 8 }}>
                Pagamentos confirmados ({paidPredictions.length})
              </div>
              <div className="space-y-1.5">
                {paidPredictions.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#B0ABA5' }}>Nenhum pagamento confirmado ainda.</p>
                ) : paidPredictions.map(p => {
                  const game = games.find(g => g.id === p.game_id)
                  return (
                    <div key={p.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
                      <AvatarCircle avatarUrl={p.profiles?.avatar_url} name={p.bettor_name ?? p.profiles?.name ?? '?'} size={34} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#3D3530' }}>{p.bettor_name ?? p.profiles?.name}</p>
                        {p.profiles?.frase && <p style={{ fontSize: 10, color: '#A09890', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.profiles.frase}</p>}
                        <p style={{ fontSize: 11, color: '#78716C', marginTop: 2 }}>
                          {game ? `${game.home_flag ?? ''} ${translateTeam(game.home_team)} × ${translateTeam(game.away_team)} ${game.away_flag ?? ''}` : '—'}
                        </p>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#2D6A4F', marginTop: 2 }}>
                          {p.home_score}–{p.away_score}
                        </p>
                      </div>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4 }} onClick={() => togglePaid(p.id, false)}>
                        <X size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* MEMBROS */}
          <TabsContent value="members" className="mt-0 space-y-3">
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 8 }}>
              Convidar novo membro
            </div>
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 12px' }}>
              <div className="flex gap-2">
                <Input
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Nome do familiar"
                  className="rounded-none border-gray-200 text-gray-900 text-sm h-10"
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                />
                <button
                  style={{ background: '#1D3A28', border: 'none', color: '#fff', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 0, flexShrink: 0, opacity: saving || !newMemberName.trim() ? 0.5 : 1 }}
                  onClick={addMember}
                  disabled={saving || !newMemberName.trim()}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {members.map(m => (
                <div key={m.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="flex-1">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{m.name}</p>
                    <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#78716C', letterSpacing: '0.15em', marginTop: 2 }}>{m.invite_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 0, background: m.used ? '#ECFDF5' : '#F5F4F1', color: m.used ? '#065F46' : '#78716C' }}>
                      {m.used ? 'ativo' : 'pendente'}
                    </span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A09890', padding: 4 }} onClick={() => copyCode(m.invite_code)}>
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* RESULTADOS */}
          <TabsContent value="games" className="mt-0 space-y-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em' }}>
                Resultados dos jogos
              </div>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 0, border: '1px solid #1D3A28', background: '#F0F4F1', color: '#1D3A28', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                onClick={syncGames}
                disabled={saving}
              >
                <RefreshCw size={12} className={saving ? 'animate-spin' : ''} />
                Sincronizar
              </button>
            </div>

            {games.filter(g => g.status === 'scheduled' || g.status === 'live').slice(0, 20).map(game => (
              <div key={game.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px' }}>
                <p style={{ fontSize: 10, color: '#A09890', marginBottom: 8 }}>{formatDate(game.game_date)}</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-right font-bold text-gray-800 text-sm">
                    {game.home_flag} {translateTeam(game.home_team)}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    className="w-16 text-center h-10 border border-gray-200 text-gray-900 text-lg font-bold rounded-none"
                    placeholder="0"
                    value={gameScores[game.id]?.home ?? ''}
                    onChange={e => setGameScores(prev => ({
                      ...prev,
                      [game.id]: { home: e.target.value, away: prev[game.id]?.away ?? '' }
                    }))}
                  />
                  <span className="text-gray-400 font-bold text-lg">×</span>
                  <Input
                    type="number"
                    min="0"
                    className="w-16 text-center h-10 border border-gray-200 text-gray-900 text-lg font-bold rounded-md"
                    placeholder="0"
                    value={gameScores[game.id]?.away ?? ''}
                    onChange={e => setGameScores(prev => ({
                      ...prev,
                      [game.id]: { home: prev[game.id]?.home ?? '', away: e.target.value }
                    }))}
                  />
                  <span className="flex-1 font-bold text-gray-800 text-sm">
                    {translateTeam(game.away_team)} {game.away_flag}
                  </span>
                  <Button
                    size="sm"
                    className="bg-green-900 hover:bg-green-800 h-10 font-semibold shrink-0"
                    onClick={() => saveResult(game.id)}
                    disabled={saving || !gameScores[game.id]?.home || !gameScores[game.id]?.away}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* PALPITES */}
          <TabsContent value="predictions" className="mt-0">
            {/* Filtro + contador */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3530' }}>{filteredPredictions.length} palpites</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'paid', 'pending'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPredictionsFilter(f)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 0, cursor: 'pointer',
                      background: predictionsFilter === f ? '#1D3A28' : '#fff',
                      color: predictionsFilter === f ? '#fff' : '#78716C',
                      border: predictionsFilter === f ? '1px solid #1D3A28' : '1px solid #D6D2CC',
                    }}
                  >
                    {f === 'all' ? 'Todos' : f === 'paid' ? 'Pagos' : 'Pendentes'}
                  </button>
                ))}
              </div>
            </div>

            {predictionsByGame.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: 13, color: '#B0ABA5' }}>Nenhum palpite encontrado.</p>
              </div>
            ) : predictionsByGame.map(({ game, preds }) => {
              const isExpanded = expandedGames.has(game.id)
              const isFinished = game.status === 'finished'
              const isLive = game.status === 'live'
              const isClosed = !['scheduled'].includes(game.status)

              // Cálculos financeiros
              const paidPreds = preds.filter(p => p.paid)
              const arrecadado = paidPreds.length * (settings?.bet_value ?? 0)
              const taxaMP = arrecadado * 0.01
              const arrecadadoLiquido = arrecadado - taxaMP
              const premioTotal = arrecadadoLiquido * ((settings?.prize_percent ?? 100) / 100)
              const winners = isFinished
                ? preds.filter(p => p.home_score === game.home_score && p.away_score === game.away_score)
                : []
              const premioPorGanhador = winners.length > 0 ? premioTotal / winners.length : 0

              const gameCardBorderLeft = isFinished && winners.length > 0 ? '3px solid #B8962E'
                : isFinished ? '3px solid rgba(0,0,0,0.07)'
                : isClosed ? '3px solid #92400E'
                : '3px solid #2D6A4F'

              return (
                <div key={game.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', borderLeft: gameCardBorderLeft, marginBottom: 4 }}>

                  {/* Cabeçalho do jogo */}
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 0 }}
                    onClick={() => toggleGameExpand(game.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>
                        {game.home_flag} {translateTeam(game.home_team)} × {translateTeam(game.away_team)} {game.away_flag}
                        {isFinished && (
                          <span style={{ marginLeft: 8, fontFamily: 'monospace', color: '#2D6A4F' }}>({game.home_score} × {game.away_score})</span>
                        )}
                      </p>
                      <p style={{ fontSize: 10, color: '#A09890', marginTop: 2 }}>{formatDate(game.game_date)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 0,
                        background: isFinished ? '#F5F4F1' : isLive ? '#FEF2F2' : isClosed ? '#FEF3C7' : '#ECFDF5',
                        color: isFinished ? '#78716C' : isLive ? '#B91C1C' : isClosed ? '#92400E' : '#065F46',
                      }}>
                        {isFinished ? '✓ Encerrado' : isLive ? '● Ao vivo' : isClosed ? '🔒 Fechado' : '🟢 Aberto'}
                      </span>
                      <span style={{ fontSize: 10, color: '#A09890' }}>{preds.length} palpite{preds.length !== 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp size={14} color="#A09890" /> : <ChevronDown size={14} color="#A09890" />}
                    </div>
                  </button>

                  {/* Relatório financeiro (jogo fechado ou encerrado) */}
                  {isClosed && preds.length > 0 && (
                    <div style={{ borderTop: '1px solid #F5F3F0', padding: '8px 12px', background: isFinished && winners.length > 0 ? '#FFFBEB' : '#FAFAF9', display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                      {[
                        { val: String(preds.length), label: 'apostadores', color: '#1A1A1A' },
                        { val: formatCurrency(arrecadado), label: 'arrecadado', color: '#2D6A4F' },
                        { val: `−${formatCurrency(taxaMP)}`, label: 'taxa MP (1%)', color: '#B91C1C' },
                        { val: formatCurrency(premioTotal), label: `prêmio (${settings?.prize_percent ?? 0}%)`, color: '#1D3A28' },
                        ...(isFinished ? [{ val: winners.length > 0 ? `${winners.length} 🏆` : '—', label: 'ganhadores', color: winners.length > 0 ? '#B8962E' : '#A09890' }] : []),
                        ...(isFinished && winners.length > 0 ? [{ val: formatCurrency(premioPorGanhador), label: 'p/ ganhador', color: '#B8962E' }] : []),
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 14, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</p>
                          <p style={{ fontSize: 9, color: '#A09890', marginTop: 2 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ganhadores em destaque */}
                  {isFinished && winners.length > 0 && (
                    <div style={{ borderTop: '1px solid #F5F3F0', padding: '8px 12px', background: '#FFFBEB' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>🏆 Ganhadores — recebem {formatCurrency(premioPorGanhador)} cada</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                        {winners.map(w => (
                          <span key={w.id} style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#78350F', padding: '2px 8px', borderRadius: 0, border: '0.5px solid #FDE68A' }}>
                            {w.bettor_name ?? w.profiles?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isFinished && winners.length === 0 && preds.length > 0 && (
                    <div style={{ borderTop: '1px solid #F5F3F0', padding: '8px 12px', background: '#FAFAF9' }}>
                      <p style={{ fontSize: 10, color: '#A09890' }}>Ninguém acertou o placar — prêmio acumula</p>
                    </div>
                  )}

                  {/* Lista de palpites (expande ao clicar) */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #F5F3F0' }}>
                      <div>
                        {preds.map((p, pi) => {
                          const isWinner = isFinished &&
                            p.home_score === game.home_score &&
                            p.away_score === game.away_score
                          return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isWinner ? '#FFFBEB' : pi % 2 === 0 ? '#fff' : 'rgba(0,0,0,0.01)', borderTop: pi > 0 ? '1px solid #F5F3F0' : undefined }}>
                              <AvatarCircle avatarUrl={p.profiles?.avatar_url} name={p.bettor_name ?? p.profiles?.name ?? '?'} size={30} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: isWinner ? '#92400E' : '#1A1A1A' }}>
                                  {p.bettor_name ?? p.profiles?.name ?? '—'}
                                </p>
                                {p.profiles?.frase && (
                                  <p style={{ fontSize: 10, color: '#A09890', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.profiles.frase}</p>
                                )}
                                <p style={{ fontSize: 10, color: '#78716C', marginTop: 2 }}>
                                  Palpite:{' '}
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: isWinner ? '#B8962E' : isFinished ? '#B91C1C' : '#2D6A4F', textDecoration: isFinished && !isWinner ? 'line-through' : undefined }}>
                                    {p.home_score} × {p.away_score}
                                  </span>
                                  {' · '}
                                  {p.paid
                                    ? <span style={{ color: '#2D6A4F', fontWeight: 600 }}>Pago</span>
                                    : <span style={{ color: '#92400E', fontWeight: 600 }}>Pendente</span>
                                  }
                                  {isWinner && p.paid && (
                                    <>
                                      {' · '}
                                      {p.prize_paid
                                        ? <span style={{ color: '#1D3A28', fontWeight: 600 }}>Prêmio pago</span>
                                        : <span style={{ color: '#B8962E', fontWeight: 600 }}>Prêmio pendente</span>
                                      }
                                    </>
                                  )}
                                </p>
                              </div>

                              {/* Ações */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                {isWinner && p.paid && (
                                  <button
                                    style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 0, cursor: 'pointer', background: p.prize_paid ? '#ECFDF5' : '#FFFBEB', color: p.prize_paid ? '#065F46' : '#92400E', border: `0.5px solid ${p.prize_paid ? '#A7F3D0' : '#FDE68A'}` }}
                                    onClick={() => togglePrizePaid(p.id, !p.prize_paid)}
                                    title={p.prize_paid ? 'Desmarcar prêmio' : 'Marcar prêmio como pago'}
                                  >
                                    {p.prize_paid ? '✓ Pago' : '$ Pagar'}
                                  </button>
                                )}

                                {confirmDeleteId === p.id ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 0, cursor: 'pointer', background: '#B91C1C', color: '#fff', border: 'none' }}
                                      onClick={() => deletePrediction(p.id)}
                                      disabled={deletingId === p.id}
                                    >
                                      {deletingId === p.id ? '...' : 'Sim'}
                                    </button>
                                    <button
                                      style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 0, cursor: 'pointer', background: '#F5F4F1', color: '#78716C', border: '0.5px solid #D6D2CC' }}
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#D6D2CC' }}
                                    onClick={() => setConfirmDeleteId(p.id)}
                                    title="Excluir palpite"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* ── Inserir palpite (admin) — só jogos abertos ── */}
                      {!isClosed && (
                        <div style={{ borderTop: '1px dashed #E0DDD7', padding: '10px 12px', background: '#FAFAF9' }}>
                          {addPredGameId === game.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em' }}>➕ Inserir palpite manual</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 4 }}>Usuário responsável</label>
                                  <select
                                    value={addPredForm.userId}
                                    onChange={e => {
                                      const m = registeredMembers.find(m => m.user_id === e.target.value)
                                      setAddPredForm(f => ({ ...f, userId: e.target.value, bettorName: m?.name ?? f.bettorName }))
                                    }}
                                    style={{ width: '100%', height: 38, border: '1px solid #D6D2CC', borderRadius: 0, padding: '0 8px', fontSize: 13, background: '#fff' }}
                                  >
                                    <option value="">Selecione um membro...</option>
                                    {registeredMembers.map(m => (
                                      <option key={m.user_id!} value={m.user_id!}>{m.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 4 }}>Nome do apostador</label>
                                  <Input
                                    value={addPredForm.bettorName}
                                    onChange={e => setAddPredForm(f => ({ ...f, bettorName: e.target.value }))}
                                    placeholder="Nome de quem está apostando"
                                    style={{ height: 38, border: '1px solid #D6D2CC', borderRadius: 0, fontSize: 13 }}
                                    className="rounded-none"
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 4 }}>{translateTeam(game.home_team)}</label>
                                    <Input
                                      type="number" min="0" max="20"
                                      value={addPredForm.homeScore}
                                      onChange={e => setAddPredForm(f => ({ ...f, homeScore: e.target.value }))}
                                      style={{ height: 38, border: '1px solid #D6D2CC', borderRadius: 0, fontSize: 16, fontWeight: 700, textAlign: 'center' }}
                                      className="rounded-none"
                                      placeholder="0"
                                    />
                                  </div>
                                  <span style={{ color: '#A09890', fontWeight: 700, paddingBottom: 8 }}>×</span>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 4 }}>{translateTeam(game.away_team)}</label>
                                    <Input
                                      type="number" min="0" max="20"
                                      value={addPredForm.awayScore}
                                      onChange={e => setAddPredForm(f => ({ ...f, awayScore: e.target.value }))}
                                      style={{ height: 38, border: '1px solid #D6D2CC', borderRadius: 0, fontSize: 16, fontWeight: 700, textAlign: 'center' }}
                                      className="rounded-none"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={addPredForm.paid}
                                    onChange={e => setAddPredForm(f => ({ ...f, paid: e.target.checked }))}
                                    style={{ width: 16, height: 16, accentColor: '#1D3A28' }}
                                  />
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#3D3530' }}>Marcar como pago (dinheiro)</span>
                                </label>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '9px 0', borderRadius: 0, cursor: 'pointer', background: 'transparent', color: '#78716C', border: '1px solid #D6D2CC' }}
                                  onClick={() => setAddPredGameId(null)}
                                  disabled={addingPred}
                                >
                                  Cancelar
                                </button>
                                <button
                                  style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '9px 0', borderRadius: 0, cursor: 'pointer', background: '#1D3A28', color: '#fff', border: '1px solid #1D3A28' }}
                                  onClick={() => addPrediction(game.id)}
                                  disabled={addingPred}
                                >
                                  {addingPred ? 'Salvando...' : 'Salvar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:text-green-600 transition-colors py-1"
                              onClick={() => { setAddPredGameId(game.id); setAddPredForm({ userId: '', bettorName: '', homeScore: '', awayScore: '', paid: true }) }}
                            >
                              <Plus size={16} />
                              Inserir palpite manual
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </TabsContent>

          {/* CONFIGURAÇÕES */}
          <TabsContent value="settings" className="mt-0">
            {settings && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 6 }}>Valor por palpite (R$)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.bet_value}
                    onChange={e => setSettings({ ...settings, bet_value: parseFloat(e.target.value) || 0 })}
                    style={{ height: 44, border: '1px solid #D6D2CC', borderRadius: 0, fontSize: 16, color: '#1A1A1A' }}
                    className="rounded-none"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 6 }}>% do total que vira prêmio</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.prize_percent}
                    onChange={e => setSettings({ ...settings, prize_percent: parseFloat(e.target.value) || 0 })}
                    style={{ height: 44, border: '1px solid #D6D2CC', borderRadius: 0, fontSize: 16, color: '#1A1A1A' }}
                    className="rounded-none"
                  />
                </div>
                <button
                  style={{ width: '100%', fontSize: 12, fontWeight: 700, padding: '12px 0', borderRadius: 0, cursor: 'pointer', background: '#1D3A28', color: '#fff', border: '1px solid #1D3A28', letterSpacing: '0.04em' }}
                  onClick={saveSettings}
                  disabled={saving}
                >
                  {saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de perfil do admin */}
      {adminProfile && (
        <ProfileEditDialog
          profile={adminProfile}
          open={profileEditOpen}
          onClose={() => setProfileEditOpen(false)}
          onSaved={p => { setAdminProfile(p); setProfileEditOpen(false) }}
        />
      )}
    </div>
  )
}
