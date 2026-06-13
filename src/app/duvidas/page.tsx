'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { APP_NAME, FAMILY_NAME, ADMIN_NAME, ADMIN_WHATSAPP } from '@/lib/config'
import {
  Home, KeyRound, CircleDot, Calendar, Pencil, Users,
  QrCode, Clock, Trash2, Eye, Trophy, BarChart2,
  Wallet, Smartphone, HelpCircle, type LucideIcon,
} from 'lucide-react'

const faqs: { icon: LucideIcon; q: string; a: string }[] = [
  {
    icon: KeyRound,
    q: `Como acesso o ${APP_NAME}?`,
    a: `O acesso é exclusivo para membros da Família ${FAMILY_NAME}. Você precisa de um código de convite enviado pelo administrador (${ADMIN_NAME}).\n\nNo primeiro acesso, clique em "PRIMEIRO ACESSO? CLIQUE AQUI", insira o código, escolha seu e-mail e senha. Nas próximas visitas, basta entrar com e-mail e senha normalmente.`,
  },
  {
    icon: CircleDot,
    q: 'Em quais jogos posso palpitar?',
    a: `Apenas nos jogos do Brasil na Copa do Mundo 2026! Os demais jogos aparecem na lista apenas para acompanhamento — o botão "Inserir Palpite" só fica disponível nas partidas do Brasil.`,
  },
  {
    icon: Calendar,
    q: 'Quando posso registrar meu palpite?',
    a: `Os palpites do próximo jogo do Brasil ficam abertos assim que o jogo anterior for encerrado — e permanecem abertos até o início da partida.\n\nO card do próximo jogo exibirá o badge "🟢 Palpites abertos!" quando estiver disponível. Os jogos seguintes mostrarão "📅 Em breve" até chegarem sua vez.\n\nDepois do início da partida, os palpites são encerrados automaticamente.`,
  },
  {
    icon: Pencil,
    q: 'Posso alterar meu palpite?',
    a: `Sim! Enquanto o jogo não começou, você pode editar o placar dos seus palpites a qualquer hora — mesmo depois do pagamento confirmado.\n\nBasta clicar no card do jogo: os palpites confirmados (✅) aparecem com campos de placar editáveis. Altere o que quiser e clique em "Salvar alterações". O pagamento já realizado não é afetado — apenas o palpite é atualizado.\n\nPalpites pendentes (ainda não pagos) também podem ser editados, ou até cancelados (opção "Desistir dos palpites pendentes").\n\nDepois que o jogo começar, os palpites são encerrados e não podem mais ser alterados.`,
  },
  {
    icon: Users,
    q: 'Posso registrar palpites para outras pessoas?',
    a: `Sim! Você pode registrar palpites para quantas pessoas quiser em um único envio — mesmo que elas não tenham conta no app.\n\nAo clicar no card do próximo jogo, você verá o formulário com:\n• Nome da pessoa + placar dela\n• Botão "+ Adicionar outra pessoa" para incluir mais\n\nO valor total é cobrado em um único PIX. Ao pagar, todos os palpites do lote são ativados de uma vez.\n\nCada pessoa aparecerá com seu próprio nome na lista de apostadores e poderá ganhar o prêmio individualmente.`,
  },
  {
    icon: QrCode,
    q: 'Como funciona o pagamento via PIX?',
    a: `Após registrar seu palpite, um QR Code PIX é gerado automaticamente pelo Mercado Pago. Você pode escanear o QR Code ou copiar o código "copia e cola" para pagar pelo app do seu banco.\n\nAssim que o pagamento for confirmado pelo Mercado Pago, seu palpite é ativado automaticamente — sem precisar de aprovação manual!`,
  },
  {
    icon: Clock,
    q: 'O que acontece se eu não pagar?',
    a: `Palpites não pagos ficam com status "⏳ Pendente". Eles aparecem no sistema, mas NÃO são válidos para concorrer ao prêmio.\n\nVocê pode pagar a qualquer momento antes do início do jogo. Se o jogo começar sem o pagamento confirmado, o palpite perde a validade — mesmo que o PIX seja realizado depois do início da partida. Nesse caso, você receberá o seu dinheiro de volta.\n\nRegra de ouro: registrou, pague logo! 💡`,
  },
  {
    icon: Trash2,
    q: 'Posso desistir de um palpite?',
    a: `Você pode cancelar apenas palpites ainda não pagos (⏳ Pendentes), desde que o jogo não tenha começado. Abra o card do jogo e use a opção "Desistir dos palpites pendentes".\n\nPalpites já pagos (✅ Confirmados) não podem ser cancelados — mas o placar pode ser editado livremente até o início da partida.`,
  },
  {
    icon: Eye,
    q: 'Posso ver os palpites dos outros?',
    a: `Sim! Em cada card de jogo do Brasil há um botão "Ver apostadores". Ao clicar, você vê a lista de todos que já chutaram e seus respectivos palpites — ótimo para escolher um placar exclusivo!\n\nO app também avisa em tempo real se alguém já chutou no mesmo placar que você está digitando.`,
  },
  {
    icon: Trophy,
    q: 'Como funciona o prêmio?',
    a: `O prêmio é formado pela soma de todos os palpites pagos, descontada a taxa de processamento do Mercado Pago (1%). O percentual destinado ao prêmio é definido pelo administrador (padrão: 100% do arrecadado líquido).\n\nQuem acertar o placar exato do jogo divide o prêmio igualmente. Se ninguém acertar, o valor acumula.\n\n📊 Exemplo com 5 participantes:\n─────────────────────────\n• 5 palpites × R$ 10,00 = R$ 50,00 arrecadado\n• Taxa MP (1%) = − R$ 0,50\n• Prêmio líquido = R$ 49,50\n• 2 pessoas acertam o placar\n• Cada ganhador recebe R$ 24,75\n─────────────────────────\nSe apenas 1 pessoa acertar, leva os R$ 49,50 inteiros! 🥇`,
  },
  {
    icon: BarChart2,
    q: 'Como acompanho os resultados?',
    a: `Os resultados são lançados pelo administrador após cada partida. Quando o placar é registrado:\n\n• O card do jogo mostra o resultado final\n• Ao expandir "Ver apostadores", os ganhadores aparecem em destaque com 🏆\n• Na aba "🏆 Ranking", você acompanha a classificação geral da família\n• No seu painel, os contadores de "Palpites" e "Acertos" são atualizados`,
  },
  {
    icon: Wallet,
    q: 'Quando recebo o prêmio?',
    a: `O prêmio é calculado automaticamente pelo app assim que o resultado for lançado. O administrador vê no painel o valor exato a ser pago para cada ganhador.\n\nO pagamento do prêmio é combinado diretamente entre os ganhadores e o administrador — o app não realiza transferências automáticas de prêmios.`,
  },
  {
    icon: Smartphone,
    q: 'Posso instalar o app no celular?',
    a: `Sim! O ${APP_NAME} é um PWA (Progressive Web App) e pode ser instalado direto no seu celular, sem precisar de App Store ou Play Store.\n\nNo iPhone: abra no Safari → toque em "Compartilhar" → "Adicionar à Tela de Início".\nNo Android: abra no Chrome → toque nos 3 pontinhos → "Instalar aplicativo".`,
  },
  {
    icon: HelpCircle,
    q: 'Ainda tenho dúvidas. Com quem falo?',
    a: `Fale diretamente com o ${ADMIN_NAME} (WhatsApp ${ADMIN_WHATSAPP}), administrador do bolão. Ele pode criar convites, excluir palpites errados, realizar os repasses dos prêmios, confirmar pagamentos e esclarecer qualquer dúvida sobre o funcionamento do app.`,
  },
]

function AnswerText({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {text.split('\n').map((line, i) =>
        line === '' ? <div key={i} style={{ height: 4 }} /> :
        line.startsWith('─') ? (
          <p key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: '#A09890' }}>{line}</p>
        ) : line.startsWith('•') ? (
          <p key={i} style={{ fontSize: 13, color: '#3D3530', lineHeight: 1.55, paddingLeft: 8 }}>{line}</p>
        ) : line.startsWith('📊') ? (
          <p key={i} style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginTop: 4 }}>{line}</p>
        ) : (
          <p key={i} style={{ fontSize: 13, color: '#3D3530', lineHeight: 1.55 }}>{line}</p>
        )
      )}
    </div>
  )
}

export default function DuvidasPage() {
  const [selected, setSelected] = useState<typeof faqs[number] | null>(null)

  return (
    <div className="min-h-screen" style={{ background: '#E8E4DE' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50 overflow-hidden"
        style={{ background: '#1D3A28', borderBottom: '2px solid #B8962E' }}
      >
        <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', border: '0.5px solid rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'absolute', right: 60, top: 8, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.025)' }} />
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between" style={{ paddingTop: 16, paddingBottom: 13, position: 'relative' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1 }}>{APP_NAME}</h1>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Regras & Dúvidas</p>
          </div>
          <Link
            href="/bolao"
            style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
            title="Voltar ao bolão"
          >
            <Home size={20} strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto" style={{ padding: '14px 12px 32px' }}>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
          {faqs.length} perguntas frequentes
        </div>

        {/* Grid responsivo de cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 6,
        }}>
          {faqs.map((faq, i) => {
            const Icon = faq.icon
            return (
              <button
                key={i}
                onClick={() => setSelected(faq)}
                style={{
                  background: '#fff',
                  border: '0.5px solid rgba(0,0,0,0.07)',
                  borderRadius: 0,
                  padding: '18px 10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'center',
                  aspectRatio: '1',
                  transition: 'background 0.1s',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8F7F5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <Icon size={26} strokeWidth={1.5} color="#3D3530" />
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#3D3530',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {faq.q}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 10, background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#2D6A4F', fontWeight: 600 }}>
            🇧🇷 Bora torcer e acertar o placar! Boa sorte a todos da Família {FAMILY_NAME}! 🏆
          </p>
        </div>

      </div>

      {/* Dialog da pergunta selecionada */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        {selected && (
          <DialogContent className="max-w-sm mx-4 max-h-[80vh] overflow-y-auto" style={{ borderRadius: 0, border: '0.5px solid rgba(0,0,0,0.1)' }}>
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <selected.icon size={18} strokeWidth={1.5} color="#1D3A28" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>{selected.q}</p>
              </div>
              <div style={{ borderTop: '1px solid #F0EDE8', paddingTop: 14 }}>
                <AnswerText text={selected.a} />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
