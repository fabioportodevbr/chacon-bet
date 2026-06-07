'use client'

import { useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Game, Prediction, Profile, Settings } from '@/lib/supabase/types'
import { formatDate, isGameOpen, phaseLabels, formatCurrency } from '@/lib/utils'
import { translateTeam } from '@/lib/teams-pt'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import GameCard from './GameCard'
import RankingTab from './RankingTab'
import FAQDialog from './FAQDialog'
import ControleTab from './ControleTab'
import ProfileEditDialog from './ProfileEditDialog'
import { APP_NAME, APP_SUBTITLE } from '@/lib/config'
import { LogOut, Trophy, Target, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  user: User
  profile: Profile | null
  games: Game[]
  predictions: Prediction[]
  settings: Settings | null
  isAdmin?: boolean
}

function AvatarCircle({ avatarUrl, name, size = 32 }: { avatarUrl?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPhoto = !!avatarUrl?.startsWith('http')
  const cls = `rounded-full object-cover border-2 border-white/40 shrink-0`
  return isPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl!} alt={name} className={cls} style={{ width: size, height: size }} />
    : <div className={`${cls} bg-green-500 flex items-center justify-center text-white font-bold`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>
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

  const phases = Object.keys(gamesByPhase)

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
    setMyPredictions(prev => [
      ...prev.filter(p => p.game_id !== gameId),
      ...newPredictions,
    ])
  }

  function handleBatchDeleted(gameId: string) {
    setMyPredictions(prev => prev.filter(p => p.game_id !== gameId))
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/entrar')
    router.refresh()
  }

  const phaseTabLabel: Record<string, string> = {
    group: 'Grupos',
    r32: 'Oitavas',
    r16: 'Quartas',
    qf: 'Semi',
    sf: 'Semi',
    '3rd': '3º Lugar',
    final: 'Final',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-green-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Logo / título */}
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-white text-lg leading-none">{APP_NAME}</h1>
            <p className="text-green-300 text-xs leading-snug truncate">{APP_SUBTITLE}</p>
          </div>

          {/* Área direita */}
          <div className="flex items-center gap-1.5">
            {/* Avatar + nome clicável → editar perfil */}
            {profile && (
              <button
                onClick={() => setProfileEditOpen(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 rounded-xl px-2.5 py-1.5 transition-colors"
                title="Editar perfil"
              >
                <AvatarCircle avatarUrl={profile.avatar_url} name={profile.name} size={30} />
                <span className="text-white text-sm font-bold leading-tight max-w-[80px] truncate hidden sm:block">
                  {profile.name}
                </span>
              </button>
            )}

            {/* Meus Palpites */}
            <button
              onClick={() => setActiveTab('controle')}
              className={`p-2 rounded-xl transition-colors ${activeTab === 'controle' ? 'bg-blue-500 text-white' : 'text-green-200 hover:bg-green-600'}`}
              title="Meus Palpites"
            >
              🎮
            </button>

            {/* Ranking */}
            <button
              onClick={() => setActiveTab('ranking')}
              className={`p-2 rounded-xl transition-colors ${activeTab === 'ranking' ? 'bg-yellow-500 text-white' : 'text-green-200 hover:bg-green-600'}`}
              title="Ranking"
            >
              🏆
            </button>

            {/* Admin */}
            {profile?.is_admin && (
              <a
                href="/admin"
                className="text-xs bg-yellow-400 text-gray-900 px-2.5 py-1.5 rounded-xl font-bold"
              >
                ADMIN
              </a>
            )}

            {/* Logout */}
            <button onClick={logout} className="text-green-200 hover:text-white p-2">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Saudação */}
        <p className="text-gray-600 text-lg font-medium">
          Olá, <span className="font-bold text-gray-900">{profile?.name}</span>! 👋
        </p>

        {/* FAQ */}
        <FAQDialog />

        {/* Mascote */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote.gif"
            alt={`Mascote ${APP_NAME}`}
            style={{ width: 260, height: 'auto' }}
            onError={e => { (e.target as HTMLImageElement).src = '/mascote.png' }}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Target className="mx-auto mb-1 text-green-600" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.totalBets}</div>
            <div className="text-base text-gray-500 font-medium">Palpites</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Trophy className="mx-auto mb-1 text-yellow-500" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.hits}</div>
            <div className="text-base text-gray-500 font-medium">Acertos</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-200 shadow-sm">
            <Wallet className="mx-auto mb-1 text-orange-500" size={26} />
            <div className="text-3xl font-black text-gray-900">{stats.pendingBets}</div>
            <div className="text-base text-gray-500 font-medium">Pendentes</div>
          </div>
        </div>

        {/* Valor do palpite */}
        {settings && settings.bet_value > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-1">
            <p className="text-green-800 text-base font-medium">
              Cada palpite custa{' '}
              <span className="font-black text-green-700 text-xl">{formatCurrency(settings.bet_value)}</span>
              {' '}via PIX
            </p>
            <p className="text-green-700 text-sm leading-snug">
              O prêmio final será a soma dos palpites pagos, descontada a taxa de processamento do Mercado Pago (1%).
            </p>
          </div>
        )}

        {/* Tabs — apenas fases de jogos */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-gray-200 w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 shadow-sm rounded-xl">
            {phases.map(phase => (
              <TabsTrigger
                key={phase}
                value={phase}
                className="text-sm font-semibold whitespace-nowrap px-3 py-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-600"
              >
                {phaseTabLabel[phase] ?? phase}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Conteúdo das fases */}
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
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-2 px-1">
                      Grupo {grp}
                    </h3>
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

          {/* Meus Palpites (acessado pelo header) */}
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

          {/* Ranking (acessado pelo header) */}
          <TabsContent value="ranking" className="mt-4">
            <RankingTab games={games} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de perfil — disparado pelo header */}
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
