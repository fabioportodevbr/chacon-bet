'use client'

import { useState } from 'react'
import type { Member, Settings, Game } from '@/lib/supabase/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, generateInviteCode } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { toast } from 'sonner'
import { Copy, Plus, Check, X, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface PredictionWithProfile {
  id: string
  user_id: string
  game_id: string
  home_score: number
  away_score: number
  paid: boolean
  paid_at: string | null
  created_at: string
  profiles: { name: string } | null
}

interface Props {
  members: Member[]
  settings: Settings | null
  games: Game[]
  predictions: PredictionWithProfile[]
}

export default function AdminClient({ members: initialMembers, settings: initialSettings, games, predictions: initialPredictions }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [settings, setSettings] = useState(initialSettings)
  const [predictions, setPredictions] = useState(initialPredictions)
  const [newMemberName, setNewMemberName] = useState('')
  const [saving, setSaving] = useState(false)
  const [gameScores, setGameScores] = useState<Record<string, { home: string; away: string }>>({})

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/bolao" className="text-green-200 hover:text-white p-1">
            <ArrowLeft size={22} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascote.png" alt="Mascote" style={{ width: 40, height: 'auto' }} />
          <div>
            <h1 className="font-black text-white text-lg leading-none">Painel Admin</h1>
            <p className="text-green-200 text-sm">CHACON BET</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Resumo financeiro */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-black text-gray-900">{members.length}</div>
            <div className="text-sm text-gray-500 font-medium">Membros</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-3xl font-black text-orange-500">{pendingPredictions.length}</div>
            <div className="text-sm text-gray-500 font-medium">PIX pendentes</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm text-center">
            <div className="text-2xl font-black text-green-600">{formatCurrency(totalArrecadado)}</div>
            <div className="text-sm text-gray-500 font-medium">Arrecadado</div>
          </div>
        </div>

        {/* Tabs — always show text */}
        <Tabs defaultValue="payments">
          <TabsList className="bg-white border border-gray-200 w-full p-1 gap-1 rounded-xl shadow-sm h-auto flex-wrap">
            <TabsTrigger
              value="payments"
              className="flex-1 font-bold text-sm py-2.5 rounded-lg text-gray-600 data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              💰 Pagamentos
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="flex-1 font-bold text-sm py-2.5 rounded-lg text-gray-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              👥 Membros
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="flex-1 font-bold text-sm py-2.5 rounded-lg text-gray-600 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              ⚽ Resultados
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex-1 font-bold text-sm py-2.5 rounded-lg text-gray-600 data-[state=active]:bg-yellow-500 data-[state=active]:text-white"
            >
              ⚙️ Config
            </TabsTrigger>
          </TabsList>

          {/* PAGAMENTOS */}
          <TabsContent value="payments" className="mt-4 space-y-5">
            {pendingPredictions.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-orange-600 mb-3">⏳ Aguardando confirmação ({pendingPredictions.length})</h3>
                <div className="space-y-2">
                  {pendingPredictions.map(p => {
                    const game = games.find(g => g.id === p.game_id)
                    return (
                      <div key={p.id} className="bg-white rounded-xl p-4 border-2 border-orange-200 shadow-sm flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base">{p.profiles?.name}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {game ? `${game.home_flag ?? ''} ${translateTeam(game.home_team)} × ${translateTeam(game.away_team)} ${game.away_flag ?? ''}` : '—'}
                          </p>
                          <p className="text-sm text-green-700 font-bold font-mono mt-0.5">
                            Palpite: {p.home_score} × {p.away_score}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 h-10 w-10 p-0 rounded-xl shrink-0"
                          onClick={() => togglePaid(p.id, true)}
                        >
                          <Check size={18} />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-green-700 mb-3">✅ Pagamentos confirmados ({paidPredictions.length})</h3>
              <div className="space-y-2">
                {paidPredictions.length === 0 ? (
                  <p className="text-gray-400 text-sm">Nenhum pagamento confirmado ainda.</p>
                ) : paidPredictions.map(p => {
                  const game = games.find(g => g.id === p.game_id)
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 opacity-80">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-base">{p.profiles?.name}</p>
                        <p className="text-sm text-gray-400 truncate">
                          {game ? `${game.home_flag ?? ''} ${translateTeam(game.home_team)} × ${translateTeam(game.away_team)} ${game.away_flag ?? ''}` : '—'}
                        </p>
                        <p className="text-sm text-green-600 font-bold font-mono mt-0.5">
                          Palpite: {p.home_score} × {p.away_score}
                        </p>
                      </div>
                      <button
                        className="text-gray-300 hover:text-red-400 p-1"
                        onClick={() => togglePaid(p.id, false)}
                        title="Desfazer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* MEMBROS */}
          <TabsContent value="members" className="mt-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 text-lg">Novo membro</h3>
              <div className="flex gap-2">
                <Input
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Nome do familiar"
                  className="border-gray-200 text-gray-900 text-base h-12"
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                />
                <Button
                  className="bg-blue-600 hover:bg-blue-700 h-12 w-12 p-0 shrink-0 rounded-xl"
                  onClick={addMember}
                  disabled={saving || !newMemberName.trim()}
                >
                  <Plus size={20} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-base">{m.name}</p>
                    <p className="font-mono text-sm text-gray-500 tracking-widest">{m.invite_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={m.used ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200'}>
                      {m.used ? 'Ativo' : 'Pendente'}
                    </Badge>
                    <button
                      className="text-gray-400 hover:text-blue-600 p-1"
                      onClick={() => copyCode(m.invite_code)}
                      title="Copiar código"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* RESULTADOS */}
          <TabsContent value="games" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Insira os resultados manualmente ou sincronize.</p>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-2 font-semibold"
                onClick={syncGames}
                disabled={saving}
              >
                <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
                Sincronizar
              </Button>
            </div>

            {games.filter(g => g.status === 'scheduled' || g.status === 'live').slice(0, 20).map(game => (
              <div key={game.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-400 mb-3">{formatDate(game.game_date)}</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-right font-bold text-gray-800 text-sm">
                    {game.home_flag} {translateTeam(game.home_team)}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    className="w-16 text-center h-10 border-2 border-gray-200 text-gray-900 text-lg font-bold rounded-lg"
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
                    className="w-16 text-center h-10 border-2 border-gray-200 text-gray-900 text-lg font-bold rounded-lg"
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
                    className="bg-purple-600 hover:bg-purple-700 h-10 font-semibold shrink-0"
                    onClick={() => saveResult(game.id)}
                    disabled={saving || !gameScores[game.id]?.home || !gameScores[game.id]?.away}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* CONFIGURAÇÕES */}
          <TabsContent value="settings" className="mt-4">
            {settings && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-5">
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Chave PIX</Label>
                  <Input
                    value={settings.pix_key}
                    onChange={e => setSettings({ ...settings, pix_key: e.target.value })}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    className="border-gray-200 text-gray-900 text-base h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Nome do recebedor (até 25 chars)</Label>
                  <Input
                    value={settings.pix_name}
                    onChange={e => setSettings({ ...settings, pix_name: e.target.value.substring(0, 25) })}
                    className="border-gray-200 text-gray-900 text-base h-12"
                    maxLength={25}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Cidade (até 15 chars)</Label>
                  <Input
                    value={settings.pix_city}
                    onChange={e => setSettings({ ...settings, pix_city: e.target.value.substring(0, 15) })}
                    className="border-gray-200 text-gray-900 text-base h-12"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Valor por palpite (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.bet_value}
                    onChange={e => setSettings({ ...settings, bet_value: parseFloat(e.target.value) || 0 })}
                    className="border-gray-200 text-gray-900 text-base h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">% do total que vira prêmio</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.prize_percent}
                    onChange={e => setSettings({ ...settings, prize_percent: parseFloat(e.target.value) || 0 })}
                    className="border-gray-200 text-gray-900 text-base h-12"
                  />
                </div>
                <Button
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-lg h-12"
                  onClick={saveSettings}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
