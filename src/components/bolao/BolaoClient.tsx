'use client'

import { useState, useMemo, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import GameCard from './GameCard'
import RankingTab from './RankingTab'
import ControleTab from './ControleTab'
import TorcedoresTab from './TorcedoresTab'
import ProfileEditDialog from './ProfileEditDialog'
import { APP_NAME } from '@/lib/config'
import { LogOut, User as UserIcon, BookOpen, BarChart3, Users } from 'lucide-react'
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
    <div className="min-h-screen" style={{ background: '#E8E4DE' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 overflow-hidden"
        style={{ background: '#1D3A28', borderBottom: '2px solid #B8962E' }}
      >
        <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', border: '0.5px solid rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -36, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: 60, top: 8, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.025)' }} />
        <div className="max-w-2xl mx-auto px-4 flex items-start justify-between" style={{ paddingTop: 18, paddingBottom: 14, position: 'relative' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>{APP_NAME}</h1>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Copa do Mundo · 2026</p>
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
            {profile?.is_admin && (
              <a
                href="/admin"
                style={{ background: 'rgba(255,255,255,0.09)', border: '0.5px solid rgba(255,255,255,0.18)', padding: '3px 9px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em', textDecoration: 'none' }}
              >
                ADMIN
              </a>
            )}
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Banner FIFA 2026 ── */}
      <div style={{ background: 'linear-gradient(110deg, #002FA7 0%, #0047CC 55%, #0038A8 100%)', position: 'relative', overflow: 'hidden' }}>
        {/* Diagonal streaks */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(-52deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 28px, rgba(255,255,255,0.045) 28px, rgba(255,255,255,0.045) 56px)', pointerEvents: 'none' }} />
        <div className="max-w-2xl mx-auto flex items-center" style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
          {/* "2[🏆]6" + FIFA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, paddingBottom: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>
              <span style={{ fontSize: 72, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Arial, sans-serif', letterSpacing: '-4px' }}>2</span>
              <span style={{ fontSize: 44, margin: '0 -2px', marginTop: -4 }}>🏆</span>
              <span style={{ fontSize: 72, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Arial, sans-serif', letterSpacing: '-4px' }}>6</span>
            </div>
            <div style={{ background: '#fff', padding: '2px 14px', marginTop: -4 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#002FA7', letterSpacing: '0.12em', fontFamily: '"Arial Black", Arial, sans-serif' }}>FIFA</span>
            </div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 64, background: 'rgba(255,255,255,0.25)', margin: '0 16px', flexShrink: 0 }} />

          {/* Text */}
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: 1.25, margin: 0, fontFamily: 'inherit' }}>
            Vamos torcer pelo<br />Hexa do Brasil! 🇧🇷
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">

        {/* ── Stats ── */}
        <div className="flex" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7' }}>
          {([
            { label: 'Palpites', value: stats.totalBets, color: '#1A1A1A' },
            { label: 'Acertos',  value: stats.hits,      color: '#2D6A4F' },
            { label: 'Pendentes',value: stats.pendingBets,color: '#92400E' },
          ] as const).map((s, i) => (
            <div key={s.label} className="flex-1 text-center" style={{ padding: '12px 0', borderLeft: i > 0 ? '1px solid #E0DDD7' : 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          {/* Phase tabs */}
          <div className="flex overflow-x-auto" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7', padding: '0 14px' }}>
            {phaseGroups.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '9px 8px',
                  fontSize: 13,
                  fontWeight: activeTab === key ? 600 : 500,
                  color: activeTab === key ? '#1D3A28' : '#9CA3AF',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === key ? '#B8962E' : 'transparent'}`,
                  marginBottom: -1,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap' as const,
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7', padding: '0 12px' }}>
            {viewTabs.map(({ value, Icon, label }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  gap: 3,
                  padding: '5px 4px 7px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: activeTab === value ? '#1D3A28' : '#9CA3AF',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === value ? '#B8962E' : 'transparent'}`,
                  marginBottom: -1,
                  cursor: 'pointer',
                }}
              >
                <Icon size={15} strokeWidth={activeTab === value ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '12px 12px 24px' }}>

            {phaseGroups.map(({ key, keys: groupKeys }) => (
              <TabsContent key={key} value={key} className="mt-0">
                {key === 'group' ? (
                  Object.entries(
                    (gamesByPhase['group'] ?? []).reduce((acc, g) => {
                      const grp = g.group_name ?? '?'
                      if (!acc[grp]) acc[grp] = []
                      acc[grp].push(g)
                      return acc
                    }, {} as Record<string, Game[]>)
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([grp, grpGames]) => (
                    <div key={grp} style={{ marginBottom: 22 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <span style={{ background: '#1D3A28', color: '#B8962E', fontSize: 11, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.08em' }}>
                          GRUPO {grp}
                        </span>
                        <span style={{ fontSize: 11, color: '#A09890', fontStyle: 'italic' }}>
                          palpites apenas nos jogos do Brasil
                        </span>
                      </div>
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
                  <div>
                    {groupKeys
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
                      ))}
                  </div>
                )}
              </TabsContent>
            ))}

            {/* Perfil */}
            <TabsContent value="perfil" className="mt-0">
              {profile ? (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: 24 }}>
                  <div className="flex flex-col items-center gap-4 text-center">
                    <AvatarCircle avatarUrl={profile.avatar_url} name={profile.name} size={84} />
                    <div>
                      <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1A1A1A' }}>{profile.name}</h2>
                      {profile.frase
                        ? <p style={{ color: '#78716C', fontStyle: 'italic', marginTop: 6, fontSize: 14 }}>"{profile.frase}"</p>
                        : <p style={{ color: '#D1D5DB', fontSize: 14, marginTop: 6 }}>Sem frase de torcedor</p>
                      }
                    </div>
                    <button
                      onClick={() => setProfileEditOpen(true)}
                      style={{ WebkitAppearance: 'none', appearance: 'none', fontSize: 12, fontWeight: 600, padding: '5px 14px', border: '1px solid #1D3A28', background: '#F0F4F1', color: '#1D3A28', cursor: 'pointer', borderRadius: 0 }}
                    >
                      Editar Perfil
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Perfil não encontrado.</p>
              )}
            </TabsContent>

            {/* Controle */}
            <TabsContent value="controle" className="mt-0">
              {profile ? (
                <ControleTab profile={profile} predictions={myPredictions} games={games} settings={settings} />
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Perfil não encontrado.</p>
              )}
            </TabsContent>

            {/* Ranking */}
            <TabsContent value="ranking" className="mt-0">
              <RankingTab games={games} />
            </TabsContent>

            {/* Torcedores */}
            <TabsContent value="torcedores" className="mt-0">
              <TorcedoresTab />
            </TabsContent>

          </div>
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
