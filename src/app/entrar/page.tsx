'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function EntrarPage() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'name' | 'login'>('login')
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
        setMemberName(data.name)
        setStep('login')
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
      toast.success('Bem-vindo ao CHACON BET!')
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
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header verde igual ao app */}
      <header className="bg-green-700 shadow-md sticky top-0 z-10">
        <div className="max-w-sm mx-auto px-4 py-3">
          <h1 className="font-black text-white text-xl leading-none">CHACON BET</h1>
          <p className="text-green-200 text-xs leading-snug">O bolão da Família Chacon na Copa de 2026! 🇧🇷</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto px-4 py-6 space-y-5">

        {/* Mascote centralizado, maior */}
        <div className="flex flex-col items-center pt-2 space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote.gif"
            alt="Mascote CHACON BET"
            style={{ width: 240, height: 'auto' }}
            onError={e => { (e.target as HTMLImageElement).src = '/mascote.png' }}
          />
          <p className="text-green-700 text-xl font-bold italic">"Bacaninha!"</p>
        </div>

        {/* Card de login em verde */}
        <Card className="bg-green-700 border-0 shadow-2xl w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-2xl font-bold">
              {step === 'login' && (memberName ? `Olá, ${memberName}!` : 'Entrar na minha conta')}
              {step === 'code' && 'Primeiro acesso'}
              {step === 'name' && `Olá, ${memberName}! 👋`}
            </CardTitle>
            <CardDescription className="text-green-200 text-base">
              {step === 'login' && 'Entre com seu e-mail e senha'}
              {step === 'code' && 'Insira o código de convite recebido'}
              {step === 'name' && 'Crie sua conta para participar do bolão'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'login' && (
              <>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-white border-0 text-gray-900 text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">Senha</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-white border-0 text-gray-900 text-lg h-12" onKeyDown={e => e.key === 'Enter' && login()} />
                </div>
                <Button className="w-full bg-white hover:bg-gray-100 text-green-700 font-black text-lg h-12" onClick={login} disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <button
                  className="w-full text-base text-white font-black py-2 underline underline-offset-4 hover:text-green-200 tracking-wide"
                  onClick={() => { setStep('code'); setEmail(''); setPassword('') }}
                >
                  PRIMEIRO ACESSO? CLIQUE AQUI
                </button>
              </>
            )}

            {step === 'code' && (
              <>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">Código de convite</Label>
                  <Input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Ex: ABCD1234"
                    className="bg-white border-0 text-gray-900 text-center text-2xl font-mono tracking-widest uppercase h-14"
                    maxLength={8}
                    onKeyDown={e => e.key === 'Enter' && validateCode()}
                  />
                </div>
                <Button className="w-full bg-white hover:bg-gray-100 text-green-700 font-black text-lg h-12" onClick={validateCode} disabled={loading || inviteCode.length < 4}>
                  {loading ? 'Verificando...' : 'Continuar →'}
                </Button>
                <button className="w-full text-base text-green-200 hover:text-white font-semibold py-2" onClick={() => setStep('login')}>
                  ← Já tenho conta
                </button>
              </>
            )}

            {step === 'name' && (
              <>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">Seu nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="bg-white border-0 text-gray-900 text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-white border-0 text-gray-900 text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="text-green-100 text-base font-semibold">Senha</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-white border-0 text-gray-900 text-lg h-12" onKeyDown={e => e.key === 'Enter' && register()} />
                </div>
                <Button className="w-full bg-white hover:bg-gray-100 text-green-700 font-black text-lg h-12" onClick={register} disabled={loading}>
                  {loading ? 'Criando conta...' : 'Criar conta e entrar'}
                </Button>
                <button className="w-full text-base text-green-200 hover:text-white font-semibold py-2" onClick={() => setStep('login')}>
                  ← Voltar ao login
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Aviso legal */}
        <div className="bg-green-700 border border-green-600 rounded-2xl px-4 py-3 text-center w-full">
          <p className="text-white text-sm leading-snug">
            ⚠️ <span className="font-bold">Este aplicativo não é um app de apostas.</span>
            {' '}Serve apenas para gerenciar o bolão dos jogos do Brasil na Copa do Mundo da Família Chacon.
          </p>
        </div>

      </div>
    </div>
  )
}
