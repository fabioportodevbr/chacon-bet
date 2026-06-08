'use client'

import { useState, useMemo } from 'react'
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
import { LogOut, Trophy, Target, Wallet, User as UserIcon, BookOpen, BarChart3, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

export default function BolaoClient({ user, profile: initialProfile, games, predictions, settings, isAdmin = false }: Props) {
  const router = useRouter()
  const [myPredictions, setMyPredictions] = useState<Prediction[]>(predictions)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('group')

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

  const phaseTabLabel: Record<string, string> = {
    group: 'Grupos',
    r32:   'Oitavas',
    r16:   'Quartas',
    qf:    'Semi',
    sf:    'Semi',
    '3rd': '3º Lugar',
    final: 'Final',
  }

  const PHASE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']
  const phases = Object.keys(gamesByPhase).sort(
    (a, b) => {
      const ai = PHASE_ORDER.indexOf(a)
      const bi = PHASE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }
  )

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

        {/* ── Hero card ────────────────────────────────────────────────────── */}
        <div className="relative bg-green-700 rounded-lg overflow-hidden shadow-lg">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-green-600/40 pointer-events-none" />
          <div className="absolute bottom-0 right-16 w-24 h-24 rounded-full bg-green-800/50 translate-y-10 pointer-events-none" />

          <div className="relative px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={20} className="text-amber-400 shrink-0" />
              <span className="bg-amber-400 text-green-900 text-xs font-black px-3 py-1 rounded-full tracking-wide">2026</span>
            </div>
            <p className="text-green-100 text-base leading-snug">
              Olá, <span className="font-bold text-white">{profile?.name}</span>! 🇧🇷
            </p>
            <p className="text-green-300 text-xs mt-1 leading-snug">
              Faça seus palpites e vamos torcer pelo Brasil!
            </p>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100 min-w-0">
            <div className="w-9 h-9 rounded-md bg-green-50 flex items-center justify-center mx-auto mb-2">
              <Target size={18} className="text-green-700" />
            </div>
            <div className="text-3xl font-black text-gray-900 tabular-nums leading-none">{stats.totalBets}</div>
            <div className="text-xs text-gray-400 font-semibold mt-1.5">Palpites</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100 min-w-0">
            <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center mx-auto mb-2">
              <Trophy size={18} className="text-amber-500" />
            </div>
            <div className="text-3xl font-black text-gray-900 tabular-nums leading-none">{stats.hits}</div>
            <div className="text-xs text-gray-400 font-semibold mt-1.5">Acertos</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm border border-gray-100 min-w-0">
            <div className="w-9 h-9 rounded-md bg-orange-50 flex items-center justify-center mx-auto mb-2">
              <Wallet size={18} className="text-orange-500" />
            </div>
            <div className="text-3xl font-black text-gray-900 tabular-nums leading-none">{stats.pendingBets}</div>
            <div className="text-xs text-gray-400 font-semibold mt-1.5">Pendentes</div>
          </div>
        </div>

        {/* ── Valor do palpite ──────────────────────────────────────────────── */}
        {settings && settings.bet_value > 0 && (
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-green-50 flex items-center justify-center shrink-0">
              <span className="text-green-700 font-black text-base">R$</span>
            </div>
            <div>
              <p className="text-gray-800 text-sm font-semibold leading-snug">
                Cada palpite: <span className="font-black text-green-700">{formatCurrency(settings.bet_value)}</span> via PIX
              </p>
              <p className="text-gray-400 text-xs leading-snug mt-0.5">
                Prêmio = total arrecadado − 1% taxa Mercado Pago
              </p>
            </div>
          </div>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <FAQDialog />

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Barra de etapas — grid 3 colunas, sem scroll */}
          <div className="bg-white border border-gray-200 rounded-md p-1 shadow-sm">
            <div className="grid grid-cols-3 gap-1">
              {phases.map(phase => (
                <button
                  key={phase}
                  onClick={() => setActiveTab(phase)}
                  className={`py-2 rounded-md text-xs font-semibold transition-colors text-center ${
                    activeTab === phase
                      ? 'bg-green-900 text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {phaseTabLabel[phase] ?? phase}
                </button>
              ))}
            </div>
          </div>

          {/* Barra de views */}
          <div className="bg-white border border-gray-200 w-full p-1 gap-1 shadow-sm rounded-md mt-2 flex">
            {viewTabs.map(({ value, Icon, label }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === value
                    ? 'text-white bg-green-900'
                    : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} strokeWidth={activeTab === value ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── Conteúdo das fases ─────────────────────────────────────────── */}
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
                    <div className="flex items-center gap-2 mb-2 px-0.5">
                      <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-green-700 font-black text-xs leading-none">{grp}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Grupo {grp}</span>
                    </div>
                    <div className="space-y-2">
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
                gamesByPhase[phase].map(game => (
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
