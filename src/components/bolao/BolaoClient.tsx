'use client'

import { useState, useMemo, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { formatCurrency } from '@/lib/utils'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import GameCard from './GameCard'
import RankingTab from './RankingTab'
import FAQDialog from './FAQDialog'
import ControleTab from './ControleTab'
import TorcedoresTab from './TorcedoresTab'
import ProfileEditDialog from './ProfileEditDialog'
import { APP_NAME } from '@/lib/config'
import { LogOut, Trophy, User as UserIcon, BookOpen, BarChart3, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PHASE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

const PHASE_LABEL: Record<string, string> = {
  group: 'Grupos',
  r32:   'Oitavas',
  r16:   'Quartas',
  qf:    'Semi',
  sf:    'Semi',
  '3rd': '3º Lugar',
  final: 'Final',
}

function AvatarCircle({ avatarUrl, name, size = 32 }: { avatarUrl?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPhoto = !!avatarUrl?.startsWith('http')
  const cls = `rounded-full object-cover shrink-0`
  return isPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl!} alt={name} className={cls} style={{ width: size, height: size }} />
    : <div className={`${cls} bg-green-700 flex items-center justify-center text-white font-bold`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>
}

interface Props {
  user: User
  profile: Profile | null
  games: Game[]
  predictions: Prediction[]
  settings: Settings | null
  isAdmin?: boolean
}

export default function BolaoClient({ user, profile: initialProfile, games: initialGames, predictions, settings, isAdmin = false }: Props) {
  const router = useRouter()
  const [myPredictions, setMyPredictions] = useState<Prediction[]>(predictions)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('group')
  const [games, setGames] = useState<Game[]>(initialGames)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('games-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, payload => {
        setGames(prev => prev.map(g => g.id === payload.new.id ? (payload.new as Game) : g))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const gamesByPhase = useMemo(() => {
    const phases: Record<string, Game[]> = {}
    for (const g of games) {
      if (!phases[g.phase]) phases[g.phase] = []
      phases[g.phase].push(g)
    }
    return phases
  }, [games])

  const nextBrazilGameId = useMemo(() => {
    const now = new Date()
    const upcoming = games
      .filter(g =>
        (g.home_team === 'Brazil' || g.away_team === 'Brazil') &&
        g.status === 'scheduled' &&
        g.game_date != null &&
        new Date(g.game_date) > now
      )
      .sort((a, b) => new Date(a.game_date!).getTime() - new Date(b.game_date!).getTime())
    return upcoming[0]?.id ?? null
  }, [games])

  const phases = useMemo(() =>
    Object.keys(gamesByPhase).sort((a, b) => {
      const ai = PHASE_ORDER.indexOf(a)
      const bi = PHASE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }), [gamesByPhase])

  // Merge phases that share the same label (e.g. qf + sf both labeled "Semi")
  const phaseGroups = useMemo(() => {
    const groups: { key: string; label: string; keys: string[] }[] = []
    for (const key of phases) {
      const label = PHASE_LABEL[key] ?? key
      const existing = groups.find(g => g.label === label)
      if (existing) existing.keys.push(key)
      else groups.push({ key, label, keys: [key] })
    }
    return groups
  }, [phases])

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

  function handleBatchSaved(gameId: string, newPredictions: Prediction[]) {
    setMyPredictions(prev => {
      const paidForGame = prev.filter(p => p.game_id === gameId && p.paid)
      const otherGames = prev.filter(p => p.game_id !== gameId)
      return [...otherGames, ...paidForGame, ...newPredictions]
    })
  }

  function handleBatchDeleted(gameId: string) {
    setMyPredictions(prev => prev.filter(p => p.game_id !== gameId || p.paid))
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/entrar')
    router.refresh()
  }

  const viewTabs = [
    { value: 'perfil',     Icon: UserIcon,  label: 'Perfil'     },
    { value: 'controle',   Icon: BookOpen,  label: 'Palpites'   },
    { value: 'ranking',    Icon: BarChart3, label: 'Ranking'    },
    { value: 'torcedores', Icon: Users,     label: 'Torcedores' },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-green-900 sticky top-0 z-50 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Trophy size={22} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-white text-lg leading-none tracking-tight">{APP_NAME}</h1>
          </div>
          <div className="flex items-center gap-2">
            {profile?.is_admin && (
              <a
                href="/admin"
                className="text-xs bg-amber-400 text-green-900 px-2.5 py-1.5 rounded-lg font-black tracking-wide"
              >
                ADMIN
              </a>
            )}
            <button onClick={logout} className="text-green-400 hover:text-white p-1.5 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Saudação ─────────────────────────────────────────────────────── */}
        <div className="pt-1 border-b border-gray-200 pb-4">
          <p className="text-gray-900 font-bold text-lg leading-tight">Olá, {profile?.name}</p>
          <p className="text-gray-400 text-sm mt-0.5">Copa do Mundo 2026</p>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span><strong className="text-gray-900 font-bold tabular-nums">{stats.totalBets}</strong> palpites</span>
          <span className="text-gray-300">·</span>
          <span><strong className="text-green-700 font-bold tabular-nums">{stats.hits}</strong> acertos</span>
          <span className="text-gray-300">·</span>
          <span><strong className="text-orange-500 font-bold tabular-nums">{stats.pendingBets}</strong> pendentes</span>
        </div>

        {/* ── Valor do palpite ──────────────────────────────────────────────── */}
        {settings && settings.bet_value > 0 && (
          <p className="text-sm text-gray-500">
            Cada palpite: <strong className="text-gray-800">{formatCurrency(settings.bet_value)}</strong> via PIX
            <span className="text-gray-400 text-xs"> · prêmio = total − 1% taxa MP</span>
          </p>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <FAQDialog />

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Barra de etapas */}
          <div className="border-b border-gray-200">
            <div className="flex gap-0">
              {phaseGroups.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === key
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Barra de views */}
          <div className="border-b border-gray-200">
            <div className="flex gap-0">
              {viewTabs.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === value
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={16} strokeWidth={activeTab === value ? 2.5 : 1.8} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Conteúdo das fases ─────────────────────────────────────────── */}
          {phaseGroups.map(({ key, keys: groupKeys }) => (
            <TabsContent key={key} value={key} className="mt-4 space-y-3">
              {key === 'group' ? (
                Object.entries(
                  (gamesByPhase['group'] ?? []).reduce((acc, g) => {
                    const grp = g.group_name ?? '?'
                    if (!acc[grp]) acc[grp] = []
                    acc[grp].push(g)
                    return acc
                  }, {} as Record<string, Game[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([grp, grpGames]) => (
                  <div key={grp} className="mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Grupo {grp}</p>
                    <p className="text-xs text-gray-400 italic mb-3">Placares para conferência. Palpites apenas nos jogos do Brasil.</p>
                    <div>
                      {grpGames.map(game => (
                        <GameCard
                          key={game.id}
                          game={game}
                          predictions={myPredictions.filter(p => p.game_id === game.id)}
                          userId={user.id}
                          userName={profile?.name ?? ''}
                          isAdmin={isAdmin}
                          isNextBrazilGame={game.id === nextBrazilGameId}
                          settings={settings}
                          onBatchSaved={handleBatchSaved}
                          onBatchDeleted={handleBatchDeleted}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                groupKeys
                  .flatMap(k => gamesByPhase[k] ?? [])
                  .sort((a, b) => new Date(a.game_date ?? '').getTime() - new Date(b.game_date ?? '').getTime())
                  .map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      predictions={myPredictions.filter(p => p.game_id === game.id)}
                      userId={user.id}
                      userName={profile?.name ?? ''}
                      isAdmin={isAdmin}
                      isNextBrazilGame={game.id === nextBrazilGameId}
                      settings={settings}
                      onBatchSaved={handleBatchSaved}
                      onBatchDeleted={handleBatchDeleted}
                    />
                  ))
              )}
            </TabsContent>
          ))}

          {/* ── Perfil ──────────────────────────────────────────────────────── */}
          <TabsContent value="perfil" className="mt-4">
            {profile ? (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col items-center gap-4 text-center">
                  <AvatarCircle avatarUrl={profile.avatar_url} name={profile.name} size={96} />
                  <div>
                    <h2 className="font-black text-2xl text-gray-900">{profile.name}</h2>
                    {profile.frase
                      ? <p className="text-gray-500 italic mt-1.5 text-sm">"{profile.frase}"</p>
                      : <p className="text-gray-300 text-sm mt-1.5">Sem frase de torcedor</p>
                    }
                  </div>
                  <button
                    onClick={() => setProfileEditOpen(true)}
                    className="bg-green-900 hover:bg-green-800 text-white font-bold px-6 py-2.5 rounded-md transition-colors text-sm"
                  >
                    ✏️ Editar Perfil
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Perfil não encontrado.</p>
            )}
          </TabsContent>

          {/* ── Meus Palpites ──────────────────────────────────────────────── */}
          <TabsContent value="controle" className="mt-4">
            {profile ? (
              <ControleTab
                profile={profile}
                predictions={myPredictions}
                games={games}
                settings={settings}
              />
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Perfil não encontrado.</p>
            )}
          </TabsContent>

          {/* ── Ranking ────────────────────────────────────────────────────── */}
          <TabsContent value="ranking" className="mt-4">
            <RankingTab games={games} />
          </TabsContent>

          {/* ── Torcedores ─────────────────────────────────────────────────── */}
          <TabsContent value="torcedores" className="mt-4">
            <TorcedoresTab />
          </TabsContent>
        </Tabs>
      </div>

      {profile && (
        <ProfileEditDialog
          profile={profile}
          open={profileEditOpen}
          onClose={() => setProfileEditOpen(false)}
          onSaved={p => { setProfile(p); setProfileEditOpen(false) }}
        />
      )}
    </div>
  )
}
