'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Users } from 'lucide-react'

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
        className={`${base} bg-green-700 flex items-center justify-center text-white font-bold`}
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
    <div style={{ textAlign: 'center', color: '#B0ABA5', padding: '40px 0', fontSize: 13 }}>Carregando torcedores...</div>
  )

  if (profiles.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#78716C' }}>Nenhum torcedor ainda.</p>
    </div>
  )

  return (
    <>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 10 }}>
        Participantes ({profiles.length})
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 0, width: '100%', textAlign: 'center' as const }}
          >
            <Avatar avatarUrl={p.avatar_url} name={p.name} size={56} />
            <div style={{ minWidth: 0, width: '100%' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</p>
              {p.frase
                ? <p style={{ fontSize: 10, color: '#A09890', fontStyle: 'italic', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>"{p.frase}"</p>
                : <p style={{ fontSize: 10, color: '#D1D5DB', marginTop: 4 }}>🇧🇷</p>
              }
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        {selected && (
          <DialogContent className="bg-white max-w-xs mx-4" style={{ borderRadius: 0 }}>
            <div className="flex flex-col items-center gap-4 pt-2 pb-2 text-center">
              <Avatar avatarUrl={selected.avatar_url} name={selected.name} size={80} />
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 18, color: '#1A1A1A' }}>{selected.name}</h2>
                {selected.frase
                  ? <p style={{ color: '#78716C', fontStyle: 'italic', marginTop: 8, fontSize: 13 }}>"{selected.frase}"</p>
                  : <p style={{ color: '#D1D5DB', fontSize: 13, marginTop: 8 }}>Sem frase de torcedor</p>
                }
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#1D3A28', background: '#F0F4F1', border: '1px solid #1D3A28', padding: '3px 10px', borderRadius: 0 }}>
                Torcedor do Bolão
              </span>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
