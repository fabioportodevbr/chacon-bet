'use client'

import { useState, useMemo, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import GameCard from './GameCard'
import RankingTab from './RankingTab'
import ControleTab from './ControleTab'
import TorcedoresTab from './TorcedoresTab'
import StandingsTab from './StandingsTab'
import ProfileEditDialog from './ProfileEditDialog'
import { APP_NAME } from '@/lib/config'
import { LogOut, User as UserIcon, BookOpen, BarChart3, Users, Search, X, Home, ListChecks, Target, Clock, TableProperties } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { isGameDay } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'

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

const VIEW_TAB_VALUES = new Set(['perfil', 'controle', 'ranking', 'torcedores', 'standings'])

/** Returns YYYY-MM-DD in Brasília timezone for a game date string */
function toBrasiliaDay(dateStr: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(dateStr))
}

/** Returns today's date as YYYY-MM-DD in Brasília timezone */
function getTodayBrasilia(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Returns the phase tab key that should be active based on today's date */
function getDefaultPhaseTab(games: Game[]): string {
  const today = getTodayBrasilia()
  const futureGames = games
    .filter(g => g.game_date && toBrasiliaDay(g.game_date) >= today)
    .sort((a, b) => new Date(a.game_date!).getTime() - new Date(b.game_date!).getTime())

  let targetPhase: string
  if (futureGames.length > 0) {
    targetPhase = futureGames[0].phase
  } else {
    const lastGame = [...games].sort((a, b) => {
      const ai = PHASE_ORDER.indexOf(a.phase)
      const bi = PHASE_ORDER.indexOf(b.phase)
      return (bi === -1 ? 99 : bi) - (ai === -1 ? 99 : ai)
    })[0]
    targetPhase = lastGame?.phase ?? 'group'
  }

  const label = PHASE_LABEL[targetPhase] ?? targetPhase
  for (const p of PHASE_ORDER) {
    if ((PHASE_LABEL[p] ?? p) === label) return p
  }
  return targetPhase
}

/** Filters a game list by date and team search (no group filter — that's phase-specific) */
function applyDateTeamFilter(gameList: Game[], filterDate: string, filterTeam: string): Game[] {
  const search = filterTeam.trim().toLowerCase()
  return gameList.filter(g => {
    if (filterDate === 'today') {
      if (!isGameDay(g.game_date)) return false
    } else if (filterDate !== 'all') {
      if (!g.game_date) return false
      if (toBrasiliaDay(g.game_date) !== filterDate) return false
    }
    if (search) {
      const homeEn = g.home_team.toLowerCase()
      const awayEn = g.away_team.toLowerCase()
      const homePt = translateTeam(g.home_team).toLowerCase()
      const awayPt = translateTeam(g.away_team).toLowerCase()
      if (!homeEn.includes(search) && !awayEn.includes(search) && !homePt.includes(search) && !awayPt.includes(search)) return false
    }
    return true
  })
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
  const [activeTab, setActiveTab] = useState(() => getDefaultPhaseTab(initialGames))
  const [games, setGames] = useState<Game[]>(initialGames)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterDate, setFilterDate] = useState<string>(() => getTodayBrasilia())
  const [filterGroup, setFilterGroup] = useState<string | null>(null)
  const [filterTeam, setFilterTeam] = useState('')

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

  // Polling: quando há jogos ao vivo, dispara sync a cada 30s para buscar placar atualizado
  useEffect(() => {
    const hasLive = games.some(g => g.status === 'live')
    if (!hasLive) return
    fetch('/api/live-sync').catch(() => {})
    const id = setInterval(() => { fetch('/api/live-sync').catch(() => {}) }, 30_000)
    return () => clearInterval(id)
  }, [games])

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

  /** Returns the best date to display for a given phase tab (today if available, else next game date) */
  function getBestDateForTab(tab: string): string {
    const today = getTodayBrasilia()
    if (VIEW_TAB_VALUES.has(tab)) return today
    const phaseGroup = phaseGroups.find(pg => pg.key === tab)
    const tabGames = tab === 'group'
      ? (gamesByPhase['group'] ?? [])
      : (phaseGroup?.keys.flatMap(k => gamesByPhase[k] ?? []) ?? [])
    const tabDates: string[] = [...new Set<string>(
      tabGames.filter(g => g.game_date).map(g => toBrasiliaDay(g.game_date!))
    )].sort()
    if (tabDates.includes(today)) return today
    return tabDates.find(d => d >= today) ?? tabDates[tabDates.length - 1] ?? today
  }

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

  // Available dates scoped to the current active phase tab
  const availableDates = useMemo(() => {
    const phaseGroup = phaseGroups.find(pg => pg.key === activeTab)
    const phaseGames = activeTab === 'group'
      ? (gamesByPhase['group'] ?? [])
      : (phaseGroup?.keys.flatMap(k => gamesByPhase[k] ?? []) ?? games)
    const seen = new Set<string>()
    const dates: { label: string; isoDay: string }[] = []
    for (const g of phaseGames) {
      if (!g.game_date) continue
      const isoDay = toBrasiliaDay(g.game_date)
      if (!seen.has(isoDay)) {
        seen.add(isoDay)
        const label = new Date(g.game_date).toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
        })
        dates.push({ label, isoDay })
      }
    }
    return dates.sort((a, b) => a.isoDay.localeCompare(b.isoDay))
  }, [games, gamesByPhase, phaseGroups, activeTab])

  // Available groups (sorted)
  const availableGroups = useMemo(() => {
    const groups = new Set<string>()
    for (const g of games) {
      if (g.phase === 'group' && g.group_name) groups.add(g.group_name)
    }
    return Array.from(groups).sort()
  }, [games])

  // Pre-filtered group games (grouped by group_name, sorted entries)
  const filteredGroupsByName = useMemo(() => {
    const filtered = applyDateTeamFilter(gamesByPhase['group'] ?? [], filterDate, filterTeam)
      .filter(g => !filterGroup || g.group_name === filterGroup)
    const acc: Record<string, Game[]> = {}
    for (const g of filtered) {
      const grp = g.group_name ?? '?'
      if (!acc[grp]) acc[grp] = []
      acc[grp].push(g)
    }
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b))
  }, [gamesByPhase, filterDate, filterTeam, filterGroup])

  // Pre-filtered knockout phase games keyed by phaseGroup.key
  const filteredPhaseGames = useMemo(() => {
    const result: Record<string, Game[]> = {}
    for (const { key, keys } of phaseGroups) {
      if (key === 'group') continue
      result[key] = applyDateTeamFilter(
        keys.flatMap(k => gamesByPhase[k] ?? [])
          .sort((a, b) => new Date(a.game_date ?? '').getTime() - new Date(b.game_date ?? '').getTime()),
        filterDate, filterTeam
      )
    }
    return result
  }, [gamesByPhase, phaseGroups, filterDate, filterTeam])

  const isPhaseTabActive = !VIEW_TAB_VALUES.has(activeTab)
  const isNonDefaultFilter = filterDate !== getBestDateForTab(activeTab) || filterGroup !== null || filterTeam.trim() !== ''

  function handleTabChange(tab: string) {
    if (tab !== 'group') setFilterGroup(null)
    setActiveTab(tab)
    if (!VIEW_TAB_VALUES.has(tab)) {
      setFilterDate(getBestDateForTab(tab))
    }
  }

  function clearFilters() {
    setFilterDate(getBestDateForTab(activeTab))
    setFilterGroup(null)
    setFilterTeam('')
  }

  function goToDefaultPhase() {
    const defaultPhase = getDefaultPhaseTab(games)
    setActiveTab(defaultPhase)
    setFilterGroup(null)
    setFilterTeam('')
    setFilterDate(getBestDateForTab(defaultPhase))
  }

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
    { value: 'controle',   Icon: BookOpen,  label: 'Meus Palpites'   },
    { value: 'ranking',    Icon: BarChart3, label: 'Ranking'    },
    { value: 'torcedores', Icon: Users,     label: 'Torcedores' },
  ]

  // Chip style helper
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: `1px solid ${active ? '#1D3A28' : '#E0DDD7'}`,
    background: active ? '#1D3A28' : '#F3F0EA',
    color: active ? '#fff' : '#6B7280',
    flexShrink: 0,
    borderRadius: 0,
  })

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
          <button
            onClick={goToDefaultPhase}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <h1 style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>{APP_NAME}</h1>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Copa do Mundo · 2026</p>
          </button>
          <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
            {profile?.is_admin && (
              <a
                href="/admin"
                style={{ background: 'rgba(255,255,255,0.09)', border: '0.5px solid rgba(255,255,255,0.18)', padding: '3px 9px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em', textDecoration: 'none' }}
              >
                ADMIN
              </a>
            )}
            <a
              href="/duvidas"
              style={{ background: 'rgba(255,255,255,0.09)', border: '0.5px solid rgba(255,255,255,0.18)', padding: '3px 9px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em', textDecoration: 'none' }}
            >
              Dúvidas
            </a>
            <button
              onClick={goToDefaultPhase}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
              title="Início"
            >
              <Home size={18} />
            </button>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">

        {/* ── Navigation + Stats + Phases unified strip ── */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>

          {/* 1. Menu principal */}
          <div className="flex" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7', padding: '0 12px' }}>
            {viewTabs.map(({ value, Icon, label }) => (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
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

          {/* 2. Cards de stats */}
          <div className="flex" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7' }}>
            {([
              { label: 'Meus Palpites', value: stats.totalBets,   color: '#1A1A1A', Icon: ListChecks },
              { label: 'Acertos',       value: stats.hits,         color: '#2D6A4F', Icon: Target     },
              { label: 'Pendentes',     value: stats.pendingBets,  color: '#92400E', Icon: Clock      },
            ] as const).map((s, i) => (
              <div key={s.label} className="flex-1 text-center" style={{ padding: '10px 0 12px', borderLeft: i > 0 ? '1px solid #E0DDD7' : 'none' }}>
                <s.Icon size={15} strokeWidth={1.5} color={s.color} style={{ margin: '0 auto 5px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 3. Fases */}
          <div className="flex overflow-x-auto" style={{ background: '#fff', borderBottom: '1px solid #E0DDD7', padding: '0 14px' }}>
            {phaseGroups.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
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
            <button
              onClick={() => handleTabChange('standings')}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                alignSelf: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: activeTab === 'standings' ? '#fff' : '#1D3A28',
                background: activeTab === 'standings' ? '#1D3A28' : '#B8962E',
                border: activeTab === 'standings' ? '1px solid #1D3A28' : '1px solid #B8962E',
                borderRadius: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
                letterSpacing: '0.04em',
              }}
            >
              <TableProperties size={12} />
              TABELA
            </button>
          </div>

          {/* 4. Filtros (apenas em abas de fase) */}
          {isPhaseTabActive && (
            <div style={{ background: '#FAFAF8', borderBottom: '1px solid #E0DDD7', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Date chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>Data:</span>
                <button onClick={() => setFilterDate('all')} style={chip(filterDate === 'all')}>Todos</button>
                {availableDates.map(({ label, isoDay }) => (
                  <button key={isoDay} onClick={() => setFilterDate(isoDay)} style={chip(filterDate === isoDay)}>{label}</button>
                ))}
              </div>

              {/* Group chips — only in Grupos tab */}
              {activeTab === 'group' && availableGroups.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>Grupo:</span>
                  <button onClick={() => setFilterGroup(null)} style={chip(!filterGroup)}>Todos</button>
                  {availableGroups.map(grp => (
                    <button
                      key={grp}
                      onClick={() => setFilterGroup(filterGroup === grp ? null : grp)}
                      style={chip(filterGroup === grp)}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              )}

              {/* Team search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E0DDD7', padding: '6px 10px' }}>
                <Search size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
                <input
                  value={filterTeam}
                  onChange={e => setFilterTeam(e.target.value)}
                  placeholder="Buscar por time..."
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A', background: 'transparent' }}
                />
                {filterTeam && (
                  <button
                    onClick={() => setFilterTeam('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Clear all filters */}
              {isNonDefaultFilter && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={clearFilters}
                    style={{ fontSize: 11, color: '#B8962E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab content */}
          <div style={{ padding: '12px 12px 24px' }}>

            {phaseGroups.map(({ key, keys: groupKeys }) => (
              <TabsContent key={key} value={key} className="mt-0">
                {key === 'group' ? (
                  filteredGroupsByName.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <p style={{ color: '#9CA3AF', fontSize: 14 }}>Nenhum jogo encontrado.</p>
                      <button
                        onClick={clearFilters}
                        style={{ marginTop: 12, fontSize: 13, color: '#B8962E', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Limpar filtros
                      </button>
                    </div>
                  ) : (
                    filteredGroupsByName.map(([grp, grpGames]) => (
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
                  )
                ) : (
                  (() => {
                    const phaseGames = filteredPhaseGames[key] ?? applyDateTeamFilter(
                      groupKeys.flatMap(k => gamesByPhase[k] ?? [])
                        .sort((a, b) => new Date(a.game_date ?? '').getTime() - new Date(b.game_date ?? '').getTime()),
                      filterDate, filterTeam
                    )
                    return phaseGames.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <p style={{ color: '#9CA3AF', fontSize: 14 }}>Nenhum jogo encontrado.</p>
                        <button
                          onClick={clearFilters}
                          style={{ marginTop: 12, fontSize: 13, color: '#B8962E', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                        >
                          Limpar filtros
                        </button>
                      </div>
                    ) : (
                      <div>
                        {phaseGames.map(game => (
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
                    )
                  })()
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

            {/* Tabela Geral */}
            <TabsContent value="standings" className="mt-0">
              <StandingsTab />
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
