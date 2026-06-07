'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Profile } from '@/lib/supabase/types'

const AVATARES = [
  '🦁', '🐯', '🦊', '🦝', '🐺', '🦄', '🐉', '🦅',
  '🦋', '🐸', '🦩', '🦚', '🦜', '🐝', '🐙', '🦑',
  '🦈', '🐊', '🦎', '🐧', '🌵', '🌊', '🔥', '⚡',
  '🌟', '🎯', '🏆', '⚽', '🇧🇷', '🥇', '🎸', '🚀',
]

interface Props {
  profile: Profile
  open: boolean
  onClose: () => void
  onSaved: (profile: Profile) => void
}

export default function ProfileEditDialog({ profile, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(profile.name)
  const [avatar, setAvatar] = useState(profile.avatar_url ?? '')
  const [frase, setFrase] = useState(profile.frase ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), avatar_url: avatar || null, frase: frase.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Perfil atualizado! 🎉')
      onSaved(data.profile as Profile)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-white max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">✏️ Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2 py-4 bg-green-50 rounded-2xl border border-green-100">
            <span className="text-6xl leading-none">{avatar || '👤'}</span>
            <p className="font-black text-gray-900 text-lg">{name || 'Seu nome'}</p>
            {frase && <p className="text-sm text-gray-500 italic text-center px-4">&ldquo;{frase}&rdquo;</p>}
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-semibold text-sm">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              className="h-11 text-base border-gray-200"
              maxLength={40}
            />
          </div>

          {/* Avatar */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-semibold text-sm">Avatar (emoji)</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARES.map(e => (
                <button
                  key={e}
                  onClick={() => setAvatar(e)}
                  className={`text-2xl rounded-xl p-1.5 transition-all ${
                    avatar === e
                      ? 'bg-green-100 ring-2 ring-green-400 scale-110'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            {avatar && (
              <button
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                onClick={() => setAvatar('')}
              >
                ✕ Remover avatar
              </button>
            )}
          </div>

          {/* Frase */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-semibold text-sm">Frase de torcedor <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input
              value={frase}
              onChange={e => setFrase(e.target.value)}
              placeholder="Ex: Hexa é nossa obrigação! 🇧🇷"
              className="h-11 text-base border-gray-200"
              maxLength={80}
            />
            <p className="text-xs text-gray-400">{frase.length}/80 caracteres</p>
          </div>

          <Button
            className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold text-base"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
