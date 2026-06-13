'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { APP_NAME, APP_SUBTITLE, FAMILY_NAME, ADMIN_NAME, ADMIN_WHATSAPP } from '@/lib/config'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #D6D2CC', borderRadius: 0,
  padding: '0 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  color: '#1A1A1A', background: '#fff', fontFamily: 'inherit',
}

const BTN: React.CSSProperties = {
  WebkitAppearance: 'none', appearance: 'none', width: '100%', display: 'block',
  fontSize: 12, fontWeight: 700, padding: '10px 0', borderRadius: 0,
  border: '1px solid #1D3A28', background: '#1D3A28', color: '#fff',
  cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit',
}

const BTN_GHOST: React.CSSProperties = {
  ...BTN, background: 'transparent', color: '#78716C', border: '1px solid #D6D2CC',
}

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#3D3530', display: 'block', marginBottom: 4,
}

export default function EntrarPage() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'name' | 'login' | 'used'>('login')
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [memberName, setMemberName] = useState('')

  async function validateCode() {
    if (!inviteCode.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/validate-invite?code=${inviteCode.trim().toUpperCase()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.used) {
        setStep('used')
      } else {
        setMemberName(data.name)
        setName(data.name)
        setStep('name')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  async function register() {
    if (!email || !password || password.length < 6) {
      toast.error('Preencha e-mail e senha (mínimo 6 caracteres)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase(), name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) throw loginError
      toast.success(`Bem-vindo ao ${APP_NAME}!`)
      router.push('/bolao')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  async function login() {
    if (!email || !password) {
      toast.error('Preencha e-mail e senha')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/bolao')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'E-mail ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#E8E4DE' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50 overflow-hidden"
        style={{ background: '#1D3A28', borderBottom: '2px solid #B8962E' }}
      >
        <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', border: '0.5px solid rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -36, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', right: 60, top: 8, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.025)' }} />
        <div className="max-w-sm mx-auto px-4" style={{ paddingTop: 18, paddingBottom: 14, position: 'relative' }}>
          <h1 style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>{APP_NAME}</h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{APP_SUBTITLE}</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto px-4 py-6 space-y-4">

        {/* Mascote */}
        <div className="flex flex-col items-center pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote.gif"
            alt={`Mascote ${APP_NAME}`}
            style={{ width: 160, height: 'auto' }}
            onError={e => { (e.target as HTMLImageElement).src = '/mascote.png' }}
          />
        </div>

        {/* Formulário */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '24px 20px', width: '100%' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 4, lineHeight: 1.2 }}>
            {step === 'login' && (memberName ? `Olá, ${memberName}!` : 'Entrar na minha conta')}
            {step === 'code' && 'Primeiro acesso'}
            {step === 'name' && `Olá, ${memberName}!`}
            {step === 'used' && 'Código já utilizado'}
          </h2>
          <p style={{ fontSize: 12, color: '#78716C', marginBottom: 20, lineHeight: 1.4 }}>
            {step === 'login' && 'Entre com seu e-mail e senha'}
            {step === 'code' && 'Insira o código de convite recebido'}
            {step === 'name' && 'Crie sua conta para participar do bolão'}
            {step === 'used' && 'Este convite já foi ativado por outro acesso'}
          </p>

          <div className="space-y-4">
            {step === 'login' && (
              <>
                <div>
                  <label style={LABEL}>E-mail</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={INPUT_STYLE} className="rounded-none" />
                </div>
                <div>
                  <label style={LABEL}>Senha</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} style={INPUT_STYLE} className="rounded-none" onKeyDown={e => e.key === 'Enter' && login()} />
                </div>
                <button style={BTN} onClick={login} disabled={loading}>
                  {loading ? 'Entrando...' : 'ENTRAR'}
                </button>
                <button style={BTN_GHOST} onClick={() => { setStep('code'); setEmail(''); setPassword('') }}>
                  Primeiro acesso? Clique aqui
                </button>
              </>
            )}

            {step === 'code' && (
              <>
                <div>
                  <label style={LABEL}>Código de convite</label>
                  <input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Ex: ABCD1234"
                    style={{ ...INPUT_STYLE, textAlign: 'center', fontSize: 20, fontFamily: 'monospace', letterSpacing: '0.2em', height: 52 }}
                    maxLength={8}
                    onKeyDown={e => e.key === 'Enter' && validateCode()}
                  />
                </div>
                <button style={BTN} onClick={validateCode} disabled={loading || inviteCode.length < 4}>
                  {loading ? 'Verificando...' : 'CONTINUAR'}
                </button>
                <button style={BTN_GHOST} onClick={() => setStep('login')}>
                  ← Já tenho conta
                </button>
              </>
            )}

            {step === 'used' && (
              <>
                <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', padding: '12px 14px' }}>
                  <p style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600, lineHeight: 1.5 }}>
                    Este código de convite já foi utilizado e não pode ser usado novamente.
                  </p>
                  <p style={{ fontSize: 11, color: '#78716C', marginTop: 6, lineHeight: 1.5 }}>
                    Cada código é de uso único. Para acessar o {APP_NAME}, solicite um novo convite ao administrador.
                  </p>
                </div>
                <a
                  href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(`Olá ${ADMIN_NAME}, preciso de um novo código de convite para o ${APP_NAME}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...BTN, textDecoration: 'none', textAlign: 'center', display: 'block' }}
                >
                  Solicitar novo código ao {ADMIN_NAME}
                </a>
                <button style={BTN_GHOST} onClick={() => { setStep('code'); setInviteCode('') }}>
                  ← Tentar outro código
                </button>
                <button style={{ ...BTN_GHOST, border: 'none', color: '#A09890', fontSize: 11 }} onClick={() => { setStep('login'); setInviteCode('') }}>
                  Já tenho conta — fazer login
                </button>
              </>
            )}

            {step === 'name' && (
              <>
                <div>
                  <label style={LABEL}>Seu nome</label>
                  <Input value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} className="rounded-none" />
                </div>
                <div>
                  <label style={LABEL}>E-mail</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={INPUT_STYLE} className="rounded-none" />
                </div>
                <div>
                  <label style={LABEL}>Senha</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={INPUT_STYLE} className="rounded-none" onKeyDown={e => e.key === 'Enter' && register()} />
                </div>
                <button style={BTN} onClick={register} disabled={loading}>
                  {loading ? 'Criando conta...' : 'CRIAR CONTA E ENTRAR'}
                </button>
                <button style={BTN_GHOST} onClick={() => setStep('login')}>
                  ← Voltar ao login
                </button>
              </>
            )}
          </div>
        </div>

        {/* Aviso legal */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px 16px', width: '100%' }}>
          <p style={{ fontSize: 11, color: '#78716C', lineHeight: 1.6 }}>
            <strong style={{ color: '#3D3530' }}>ATENÇÃO:</strong> Este não é um app de apostas. Ele serve apenas para gerenciar o bolão dos jogos do Brasil na Copa do Mundo da Família {FAMILY_NAME}. Ninguém lucra com ele e existe uma taxa de uso da plataforma PIX do MercadoPago. Ao acessar, você concorda com as regras da brincadeira.
          </p>
        </div>

      </div>
    </div>
  )
}
