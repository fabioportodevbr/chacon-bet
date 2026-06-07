'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { APP_NAME, FAMILY_NAME, ADMIN_NAME, ADMIN_WHATSAPP } from '@/lib/config'

export default function FAQDialog() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const faqs = [
    {
      q: `🔐 Como acesso o ${APP_NAME}?`,
      a: `O acesso é exclusivo para membros da Família ${FAMILY_NAME}. Você precisa de um código de convite enviado pelo administrador (${ADMIN_NAME}).\n\nNo primeiro acesso, clique em "PRIMEIRO ACESSO? CLIQUE AQUI", insira o código, escolha seu e-mail e senha. Nas próximas visitas, basta entrar com e-mail e senha normalmente.`,
    },
    {
      q: '⚽ Em quais jogos posso palpitar?',
      a: `Apenas nos jogos do Brasil na Copa do Mundo 2026! Os demais jogos aparecem na lista apenas para acompanhamento — o botão "Inserir Palpite" só fica disponível nas partidas do Brasil.`,
    },
    {
      q: '📅 Quando posso registrar meu palpite?',
      a: `Os palpites ficam disponíveis apenas no dia do jogo do Brasil, no horário de Brasília. Antes disso, o card do jogo mostrará "📅 Em breve".\n\nVocê pode registrar ou alterar seu palpite a qualquer momento do dia do jogo, desde que a partida ainda não tenha começado. Depois do início da partida, os palpites são encerrados automaticamente.`,
    },
    {
      q: '✏️ Posso alterar meu palpite?',
      a: `Sim! Enquanto o pagamento ainda não foi confirmado e o jogo não começou, você pode alterar seu palpite quantas vezes quiser — basta clicar no card do jogo e digitar um novo placar.\n\nApós a confirmação do pagamento, o palpite fica travado e não pode mais ser alterado.`,
    },
    {
      q: '💸 Como funciona o pagamento via PIX?',
      a: `Após registrar seu palpite, um QR Code PIX é gerado automaticamente pelo Mercado Pago. Você pode escanear o QR Code ou copiar o código "copia e cola" para pagar pelo app do seu banco.\n\nAssim que o pagamento for confirmado pelo Mercado Pago, seu palpite é ativado automaticamente — sem precisar de aprovação manual!`,
    },
    {
      q: '⏳ O que acontece se eu não pagar?',
      a: `Palpites não pagos ficam com status "⏳ Pendente". Eles aparecem no sistema, mas NÃO são válidos para concorrer ao prêmio.\n\nVocê pode pagar a qualquer momento antes do início do jogo. Se o jogo começar sem o pagamento confirmado, o palpite perde a validade — mesmo que o PIX seja realizado depois do início da partida. Nesse caso, você receberá o seu dinheiro de volta.\n\nRegra de ouro: registrou, pague logo! 💡`,
    },
    {
      q: '🗑️ Posso desistir de um palpite?',
      a: `Sim, mas apenas se o pagamento ainda não foi confirmado e o jogo ainda não começou. Abra o card do jogo, clique em "Inserir Palpite" e use a opção "Desistir deste palpite".\n\nApós o pagamento confirmado ou o início do jogo, não é mais possível cancelar.`,
    },
    {
      q: '👀 Posso ver os palpites dos outros?',
      a: `Sim! Em cada card de jogo do Brasil há um botão "Ver apostadores". Ao clicar, você vê a lista de todos que já chutaram e seus respectivos palpites — ótimo para escolher um placar exclusivo!\n\nO app também avisa em tempo real se alguém já chutou no mesmo placar que você está digitando.`,
    },
    {
      q: '🏆 Como funciona o prêmio?',
      a: `O prêmio é formado pela soma de todos os palpites pagos, descontada a taxa de processamento do Mercado Pago (1%). O percentual destinado ao prêmio é definido pelo administrador (padrão: 100% do arrecadado líquido).\n\nQuem acertar o placar exato do jogo divide o prêmio igualmente. Se ninguém acertar, o valor acumula.\n\n📊 Exemplo com 5 participantes:\n─────────────────────────\n• 5 palpites × R$ 10,00 = R$ 50,00 arrecadado\n• Taxa MP (1%) = − R$ 0,50\n• Prêmio líquido = R$ 49,50\n• 2 pessoas acertam o placar\n• Cada ganhador recebe R$ 24,75\n─────────────────────────\nSe apenas 1 pessoa acertar, leva os R$ 49,50 inteiros! 🥇`,
    },
    {
      q: '📊 Como acompanho os resultados?',
      a: `Os resultados são lançados pelo administrador após cada partida. Quando o placar é registrado:\n\n• O card do jogo mostra o resultado final\n• Ao expandir "Ver apostadores", os ganhadores aparecem em destaque com 🏆\n• Na aba "🏆 Ranking", você acompanha a classificação geral da família\n• No seu painel, os contadores de "Palpites" e "Acertos" são atualizados`,
    },
    {
      q: '💰 Quando recebo o prêmio?',
      a: `O prêmio é calculado automaticamente pelo app assim que o resultado for lançado. O administrador vê no painel o valor exato a ser pago para cada ganhador.\n\nO pagamento do prêmio é combinado diretamente entre os ganhadores e o administrador — o app não realiza transferências automáticas de prêmios.`,
    },
    {
      q: '📱 Posso instalar o app no celular?',
      a: `Sim! O ${APP_NAME} é um PWA (Progressive Web App) e pode ser instalado direto no seu celular, sem precisar de App Store ou Play Store.\n\nNo iPhone: abra no Safari → toque em "Compartilhar" → "Adicionar à Tela de Início".\nNo Android: abra no Chrome → toque nos 3 pontinhos → "Instalar aplicativo".`,
    },
    {
      q: '❓ Ainda tenho dúvidas. Com quem falo?',
      a: `Fale diretamente com o ${ADMIN_NAME} (WhatsApp ${ADMIN_WHATSAPP}), administrador do bolão. Ele pode criar convites, excluir palpites errados, realizar os repasses dos prêmios, confirmar pagamentos e esclarecer qualquer dúvida sobre o funcionamento do app.`,
    },
  ]

  return (
    <>
      {/* Banner de chamada */}
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black text-base rounded-2xl px-4 py-3 text-center shadow-sm transition-colors leading-snug"
      >
        📋 Leia aqui as regras da brincadeira e como usar o aplicativo!
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-lg mx-4 rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900">
              📋 Regras & Como Usar
            </DialogTitle>
            <p className="text-sm text-gray-500">{APP_NAME} — Copa do Mundo 2026</p>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="font-bold text-gray-800 text-base leading-snug pr-2">{faq.q}</span>
                  {expanded === i
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {expanded === i && (
                  <div className="px-4 py-3 bg-white border-t border-gray-100">
                    {faq.a.split('\n').map((line, j) =>
                      line === '' ? <div key={j} className="h-2" /> :
                      line.startsWith('─') ? (
                        <p key={j} className="font-mono text-sm text-gray-400">{line}</p>
                      ) : line.startsWith('•') ? (
                        <p key={j} className="text-base text-gray-700 leading-relaxed pl-2">{line}</p>
                      ) : line.startsWith('📊') ? (
                        <p key={j} className="text-base font-bold text-gray-800 mt-1">{line}</p>
                      ) : (
                        <p key={j} className="text-base text-gray-700 leading-relaxed">{line}</p>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 text-sm font-semibold">
              🇧🇷 Bora torcer e acertar o placar! Boa sorte a todos da Família {FAMILY_NAME}! 🏆
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
