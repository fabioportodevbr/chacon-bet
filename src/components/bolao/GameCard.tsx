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
import { Copy, CheckCircle2 } from 'lucide-react'

interface Props {
  game: Game
  prediction: Prediction | undefined
  userId: string
  settings: Settings | null
  onPredictionChange: (p: Prediction) => void
  onPredictionDelete: (gameId: string) => void
}

export default function GameCard({ game, prediction, userId, settings, onPredictionChange, onPredictionDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [pixOpen, setPixOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [liveSettings, setLiveSettings] = useState<Settings | null>(settings)

  const gameOpen = isGameOpen(game.game_date, game.status)
  const hasPrediction = !!prediction
  const isHit = game.status === 'finished' &&
    prediction?.home_score === game.home_score &&
    prediction?.away_score === game.away_score

  const isBrazilGame = game.home_team === 'Brazil' || game.away_team === 'Brazil'
  const homeTeam = translateTeam(game.home_team)
  const awayTeam = translateTeam(game.away_team)

  const effectiveSettings = liveSettings ?? settings

  async function savePrediction() {
    const h = parseInt(homeScore)
    const a = parseInt(awayScore)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error('Placar inválido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, homeScore: h, awayScore: a }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onPredictionChange(data.prediction)
      toast.success('Palpite salvo!')
      setOpen(false)

      if (!data.prediction.paid) {
        // Busca settings frescos para garantir que pix_key está atualizado
        try {
          const sRes = await fetch('/api/settings')
          if (sRes.ok) {
            const sData = await sRes.json()
            if (sData.settings) setLiveSettings(sData.settings)
          }
        } catch { /* usa settings que já tem */ }
        setPixOpen(true)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar palpite')
    } finally {
      setSaving(false)
    }
  }

  async function deletePrediction() {
    if (!prediction) return
    setDeleting(true)
    try {
      const res = await fetch('/api/predictions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId: prediction.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Palpite cancelado.')
      setConfirmDelete(false)
      setOpen(false)
      onPredictionDelete(game.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar palpite')
    } finally {
      setDeleting(false)
    }
  }

  async function openPixForExisting() {
    try {
      const sRes = await fetch('/api/settings')
      if (sRes.ok) {
        const sData = await sRes.json()
        if (sData.settings) setLiveSettings(sData.settings)
      }
    } catch { /* usa settings que já tem */ }
    setPixOpen(true)
  }

  function copyPixKey() {
    const key = effectiveSettings?.pix_key
    if (!key) return
    navigator.clipboard.writeText(key)
    setCopied(true)
    toast.success('Chave PIX copiada!')
    setTimeout(() => setCopied(false), 3000)
  }

  const qrUrl = effectiveSettings?.pix_key
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(effectiveSettings.pix_key)}`
    : null

  function statusBadge() {
    if (game.status === 'finished') {
      if (isHit) return <Badge className="bg-green-100 text-green-800 border-green-300 text-sm font-bold">✓ Acertou!</Badge>
      if (hasPrediction) return <Badge className="bg-red-100 text-red-700 border-red-300 text-sm">Errou</Badge>
      return <Badge className="bg-gray-100 text-gray-500 text-sm">Encerrado</Badge>
    }
    if (game.status === 'live') return <Badge className="bg-red-500 text-white text-sm animate-pulse">● Ao Vivo</Badge>
    if (!gameOpen) return <Badge className="bg-gray-100 text-gray-500 text-sm">Fechado</Badge>
    if (hasPrediction && prediction?.paid) return <Badge className="bg-green-100 text-green-800 border-green-300 text-sm font-bold">✓ Pago</Badge>
    if (hasPrediction && !prediction?.paid) return (
      <Badge
        className="bg-orange-100 text-orange-700 border-orange-300 text-sm cursor-pointer hover:bg-orange-200"
        onClick={e => { e.stopPropagation(); openPixForExisting() }}
      >
        💰 Pagar PIX
      </Badge>
    )
    return <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-sm font-semibold">Aberto</Badge>
  }

  return (
    <>
      <div
        className={`bg-white rounded-2xl p-4 border-2 shadow-sm transition-all ${
          gameOpen && isBrazilGame ? 'cursor-pointer active:scale-95' : ''
        } ${isHit ? 'border-green-400' : hasPrediction ? 'border-blue-200' : isBrazilGame ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}
        onClick={() => { if (gameOpen && isBrazilGame) setOpen(true) }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400 font-medium">{formatDate(game.game_date)}</span>
          {statusBadge()}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{game.home_flag ?? '🏳️'}</div>
            <div className="text-base font-bold text-gray-800 leading-tight">{homeTeam}</div>
            {game.status === 'finished' && (
              <div className="text-4xl font-black text-gray-900 mt-2">{game.home_score}</div>
            )}
          </div>

          <div className="text-center px-2 min-w-[80px]">
            {game.status === 'finished' ? (
              <span className="text-2xl font-bold text-gray-400">×</span>
            ) : hasPrediction ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl px-3 py-2">
                <span className="text-green-700 font-black text-xl">
                  {prediction.home_score} × {prediction.away_score}
                </span>
              </div>
            ) : gameOpen && isBrazilGame ? (
              <div className="bg-gray-100 rounded-xl px-3 py-2">
                <span className="text-gray-400 font-bold text-base">Apostar</span>
              </div>
            ) : (
              <span className="text-gray-400 text-xl font-bold">vs</span>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{game.away_flag ?? '🏳️'}</div>
            <div className="text-base font-bold text-gray-800 leading-tight">{awayTeam}</div>
            {game.status === 'finished' && (
              <div className="text-4xl font-black text-gray-900 mt-2">{game.away_score}</div>
            )}
          </div>
        </div>

        {game.venue && (
          <p className="text-xs text-gray-400 text-center mt-3">{game.venue}</p>
        )}
      </div>

      {/* Dialog de palpite */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Seu Palpite</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="text-center">
                <div className="text-4xl">{game.home_flag}</div>
                <div className="text-base font-bold mt-1 text-gray-800">{homeTeam}</div>
              </div>
              <span className="text-gray-400 text-2xl font-bold">×</span>
              <div className="text-center">
                <div className="text-4xl">{game.away_flag}</div>
                <div className="text-base font-bold mt-1 text-gray-800">{awayTeam}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-sm text-gray-500 font-semibold">{homeTeam}</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={homeScore}
                  onChange={e => setHomeScore(e.target.value)}
                  className="text-center text-4xl font-black h-16 border-2 border-gray-200 rounded-xl"
                  placeholder="0"
                />
              </div>
              <span className="text-gray-400 text-2xl mt-5 font-bold">×</span>
              <div className="flex-1 space-y-1">
                <Label className="text-sm text-gray-500 font-semibold">{awayTeam}</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={awayScore}
                  onChange={e => setAwayScore(e.target.value)}
                  className="text-center text-4xl font-black h-16 border-2 border-gray-200 rounded-xl"
                  placeholder="0"
                />
              </div>
            </div>

            {effectiveSettings && effectiveSettings.bet_value > 0 && (
              <p className="text-sm text-gray-500 text-center">
                Este palpite custa <span className="font-bold text-green-700">{formatCurrency(effectiveSettings.bet_value)}</span> via PIX
              </p>
            )}

            <Button
              className="w-full bg-green-600 hover:bg-green-700 font-bold text-lg h-12"
              onClick={savePrediction}
              disabled={saving || deleting || homeScore === '' || awayScore === ''}
            >
              {saving ? 'Salvando...' : hasPrediction ? 'Atualizar palpite' : 'Confirmar palpite'}
            </Button>

            {/* Opção de desistir — só aparece se tem palpite, não pagou e jogo aberto */}
            {hasPrediction && !prediction?.paid && (
              confirmDelete ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-red-700 font-bold text-base text-center">
                    Tem certeza que quer desistir deste palpite?
                  </p>
                  <p className="text-red-500 text-sm text-center">
                    Seu palpite será removido e você poderá fazer um novo antes do jogo começar.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 font-semibold border-gray-300"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 h-11 font-bold bg-red-600 hover:bg-red-700 text-white"
                      onClick={deletePrediction}
                      disabled={deleting}
                    >
                      {deleting ? 'Removendo...' : 'Sim, desistir'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full text-sm text-red-400 hover:text-red-600 font-semibold py-1 transition-colors"
                  onClick={() => setConfirmDelete(true)}
                >
                  Desistir deste palpite
                </button>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de PIX */}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="bg-white max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Pagar via PIX 💸</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-gray-600 text-base">
              Envie{' '}
              <span className="font-black text-green-700 text-xl">
                {formatCurrency(effectiveSettings?.bet_value ?? 10)}
              </span>{' '}
              para a chave abaixo
            </p>

            {qrUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="QR Code PIX"
                  className="w-52 h-52 rounded-xl border-4 border-gray-100"
                />
              </div>
            )}

            <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
              <p className="text-sm text-gray-500 mb-2 font-semibold">Chave PIX</p>
              <p className="font-mono text-lg font-bold text-green-800 break-all">
                {effectiveSettings?.pix_key || '—'}
              </p>
              {effectiveSettings?.pix_name && (
                <p className="text-sm text-gray-400 mt-1">{effectiveSettings.pix_name}</p>
              )}
            </div>

            <button
              onClick={copyPixKey}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 border-2 font-semibold text-base transition-all ${
                copied
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {copied ? 'Chave copiada!' : 'Copiar chave PIX'}
            </button>

            <p className="text-sm text-gray-400">
              Após o pagamento, o Fabio confirma e seu palpite fica ativo. ✅
            </p>

            <Button
              className="w-full h-12 text-base font-bold"
              variant="outline"
              onClick={() => setPixOpen(false)}
            >
              Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
