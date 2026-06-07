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
  const [step, setStep] = useState<'code' | 'name' | 'login'>('code')
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-green-700">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <div className="bg-white rounded-full p-3 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mascote.gif"
                alt="Mascote CHACON BET"
                style={{ width: 200, height: 'auto', borderRadius: '50%' }}
                onError={e => { (e.target as HTMLImageElement).src = '/mascote.png' }}
              />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow">CHACON BET</h1>
          <p className="text-green-100 text-base font-semibold leading-snug">O bolão da Família Chacon na Copa de 2026! Pra frente Brasil!! 🇧🇷</p>
        </div>

        <Card className="bg-white border-0 shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-2xl font-bold">
              {step === 'code' && 'Digite seu convite'}
              {step === 'name' && `Olá, ${memberName}! 👋`}
              {step === 'login' && (memberName ? `Olá, ${memberName}!` : 'Entrar na minha conta')}
            </CardTitle>
            <CardDescription className="text-gray-500 text-base">
              {step === 'code' && 'Insira o código de convite recebido'}
              {step === 'name' && 'Crie sua conta para participar do bolão'}
              {step === 'login' && 'Entre com seu e-mail e senha'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'code' && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Código de convite</Label>
                  <Input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Ex: ABCD1234"
                    className="border-gray-300 text-gray-900 text-center text-2xl font-mono tracking-widest uppercase h-14"
                    maxLength={8}
                    onKeyDown={e => e.key === 'Enter' && validateCode()}
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-12"
                  onClick={validateCode}
                  disabled={loading || inviteCode.length < 4}
                >
                  {loading ? 'Verificando...' : 'Continuar →'}
                </Button>
                <button
                  className="w-full text-base text-green-700 hover:text-green-900 font-semibold py-2"
                  onClick={() => setStep('login')}
                >
                  Já tenho conta → Entrar
                </button>
              </>
            )}

            {step === 'name' && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Seu nome</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="border-gray-300 text-gray-900 text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="border-gray-300 text-gray-900 text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="border-gray-300 text-gray-900 text-lg h-12"
                    onKeyDown={e => e.key === 'Enter' && register()}
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-12"
                  onClick={register}
                  disabled={loading}
                >
                  {loading ? 'Criando conta...' : 'Criar conta e entrar'}
                </Button>
                <button
                  className="w-full text-base text-green-700 hover:text-green-900 font-semibold py-2"
                  onClick={() => setStep('login')}
                >
                  Já tenho conta → Entrar
                </button>
              </>
            )}

            {step === 'login' && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="border-gray-300 text-gray-900 text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 text-base font-semibold">Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="border-gray-300 text-gray-900 text-lg h-12"
                    onKeyDown={e => e.key === 'Enter' && login()}
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg h-12"
                  onClick={login}
                  disabled={loading}
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <button
                  className="w-full text-base text-gray-500 hover:text-gray-700 font-semibold py-2"
                  onClick={() => { setStep('code'); setEmail(''); setPassword('') }}
                >
                  ← Voltar
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Aviso legal */}
        <div className="bg-green-800/50 border border-green-600 rounded-2xl px-4 py-3 text-center">
          <p className="text-green-100 text-sm leading-snug">
            ⚠️ <span className="font-bold">Este aplicativo não é um app de apostas.</span>
            {' '}Serve apenas para gerenciar o bolão dos jogos do Brasil na Copa do Mundo da Família Chacon.
          </p>
        </div>
      </div>
    </div>
  )
}
