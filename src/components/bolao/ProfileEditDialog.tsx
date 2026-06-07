'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/supabase/types'

interface Props {
  profile: Profile
  open: boolean
  onClose: () => void
  onSaved: (profile: Profile) => void
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function ProfileEditDialog({ profile, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(profile.name)
  const [frase, setFrase] = useState(profile.frase ?? '')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(profile.avatar_url ?? '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Foto deve ter no máximo 5 MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const displayAvatar = preview ?? currentAvatarUrl
  const isPhoto = !!displayAvatar?.startsWith('http') || !!preview

  async function save() {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      let newAvatarUrl = currentAvatarUrl || null

      // 1. Upload foto se houver nova seleção
      if (pendingFile) {
        const fd = new FormData()
        fd.append('avatar', pendingFile)
        const upRes = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
        const upData = await upRes.json()
        if (!upRes.ok) throw new Error(upData.error)
        newAvatarUrl = upData.url
        setCurrentAvatarUrl(upData.url)
        setPendingFile(null)
        setPreview(null)
      }

      // 2. Salva nome + frase
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatar_url: newAvatarUrl,
          frase: frase.trim() || null,
        }),
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
          <DialogTitle className="text-xl font-bold text-gray-900">✏️ Meu Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Foto de perfil */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {isPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayAvatar!}
                  alt={name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-green-200 shadow-md"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-green-600 flex items-center justify-center border-4 border-green-200 shadow-md">
                  <span className="text-white font-black text-3xl">{initials(name || 'U')}</span>
                </div>
              )}
              {/* Botão de upload sobre a foto */}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg transition-colors"
              >
                <Camera size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-400">Toque na câmera para alterar a foto</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Preview do nome atual */}
          {(name || frase) && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center border border-gray-100">
              <p className="font-black text-gray-900 text-base leading-tight">{name || 'Seu nome'}</p>
              {frase && <p className="text-xs text-gray-400 italic mt-1">&ldquo;{frase}&rdquo;</p>}
            </div>
          )}

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

          {/* Frase */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-semibold text-sm">
              Frase de torcedor{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <Input
              value={frase}
              onChange={e => setFrase(e.target.value)}
              placeholder="Ex: Hexa é nossa obrigação! 🇧🇷"
              className="h-11 text-base border-gray-200"
              maxLength={80}
            />
            <p className="text-xs text-gray-400 text-right">{frase.length}/80</p>
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
