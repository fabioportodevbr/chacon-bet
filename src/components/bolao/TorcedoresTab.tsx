'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface PublicProfile {
  id: string
  name: string
  avatar_url: string | null
  frase: string | null
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ avatarUrl, name, size }: { avatarUrl: string | null; name: string; size: number }) {
  const isPhoto = !!avatarUrl?.startsWith('http')
  const base = 'rounded-full shrink-0 object-cover'
  return isPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={avatarUrl!} alt={name} className={base} style={{ width: size, height: size }} />
    : (
      <div
        className={`${base} bg-green-600 flex items-center justify-center text-white font-bold`}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {initials(name)}
      </div>
    )
}

export default function TorcedoresTab() {
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PublicProfile | null>(null)

  useEffect(() => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(d => { if (d.profiles) setProfiles(d.profiles) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="text-center text-gray-400 py-12 text-base">Carregando torcedores...</div>
  )

  if (profiles.length === 0) return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">👥</div>
      <p className="text-gray-500">Nenhum torcedor ainda.</p>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col items-center gap-3 hover:border-green-300 hover:shadow-md transition-all w-full"
          >
            <Avatar avatarUrl={p.avatar_url} name={p.name} size={64} />
            <div className="text-center w-full min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{p.name}</p>
              {p.frase
                ? <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">"{p.frase}"</p>
                : <p className="text-xs text-gray-300 mt-1">🇧🇷 Torcedor</p>
              }
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        {selected && (
          <DialogContent className="bg-white max-w-xs mx-4 rounded-2xl">
            <div className="flex flex-col items-center gap-4 pt-2 pb-2 text-center">
              <Avatar avatarUrl={selected.avatar_url} name={selected.name} size={96} />
              <div>
                <h2 className="font-black text-2xl text-gray-900">{selected.name}</h2>
                {selected.frase
                  ? <p className="text-gray-500 italic mt-2 text-sm">"{selected.frase}"</p>
                  : <p className="text-gray-300 text-sm mt-2">Sem frase de torcedor</p>
                }
              </div>
              <span className="text-xs text-green-700 font-semibold bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
                🇧🇷 Torcedor do Bolão
              </span>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
