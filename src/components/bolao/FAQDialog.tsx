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
      a: `Os palpites do próximo jogo do Brasil ficam abertos assim que o jogo anterior for encerrado — e permanecem abertos até o início da partida.\n\nO card do próximo jogo exibirá o badge "🟢 Palpites abertos!" quando estiver disponível. Os jogos seguintes mostrarão "📅 Em breve" até chegarem sua vez.\n\nDepois do início da partida, os palpites são encerrados automaticamente.`,
    },
    {
      q: '✏️ Posso alterar meu palpite?',
      a: `Sim! Enquanto o jogo não começou, você pode editar o placar dos seus palpites a qualquer hora — mesmo depois do pagamento confirmado.\n\nBasta clicar no card do jogo: os palpites confirmados (✅) aparecem com campos de placar editáveis. Altere o que quiser e clique em "Salvar alterações". O pagamento já realizado não é afetado — apenas o palpite é atualizado.\n\nPalpites pendentes (ainda não pagos) também podem ser editados, ou até cancelados (opção "Desistir dos palpites pendentes").\n\nDepois que o jogo começar, os palpites são encerrados e não podem mais ser alterados.`,
    },
    {
      q: '👨‍👩‍👧‍👦 Posso registrar palpites para outras pessoas?',
      a: `Sim! Você pode registrar palpites para quantas pessoas quiser em um único envio — mesmo que elas não tenham conta no app.\n\nAo clicar no card do próximo jogo, você verá o formulário com:\n• Nome da pessoa + placar dela\n• Botão "+ Adicionar outra pessoa" para incluir mais\n\nO valor total é cobrado em um único PIX. Ao pagar, todos os palpites do lote são ativados de uma vez.\n\nCada pessoa aparecerá com seu próprio nome na lista de apostadores e poderá ganhar o prêmio individualmente.`,
    },
    {
      q: '💸 Como funciona o pagamento via PIX?',
      a: `Após registrar seu palpite, um QR Code PIX é gerado automaticamente pelo Mercado Pago. Você pode escanear o QR Code ou copiar o código "copia e cola" para pagar pelo app do seu banco.\n\nAssim que o pagamento for confirmado pelo Mercado Pago, seu palpite é ativado automaticamente — sem precisar de aprovação manual!\n\n🔑 Chave PIX para recebimento de prêmios\nCadastre sua chave PIX no seu perfil (clique na sua foto/nome no topo da tela). Sem a chave cadastrada, o administrador não consegue identificar para onde enviar o prêmio caso você ganhe. Você pode cadastrar CPF, e-mail, telefone ou chave aleatória.`,
    },
    {
      q: '⏳ O que acontece se eu não pagar?',
      a: `Palpites não pagos ficam com status "⏳ Pendente". Eles aparecem no sistema, mas NÃO são válidos para concorrer ao prêmio.\n\nVocê pode pagar a qualquer momento antes do início do jogo. Se o jogo começar sem o pagamento confirmado, o palpite perde a validade — mesmo que o PIX seja realizado depois do início da partida. Nesse caso, você receberá o seu dinheiro de volta.\n\nRegra de ouro: registrou, pague logo! 💡`,
    },
    {
      q: '🗑️ Posso desistir de um palpite?',
      a: `Você pode cancelar apenas palpites ainda não pagos (⏳ Pendentes), desde que o jogo não tenha começado. Abra o card do jogo e use a opção "Desistir dos palpites pendentes".\n\nPalpites já pagos (✅ Confirmados) não podem ser cancelados — mas o placar pode ser editado livremente até o início da partida (veja "Posso alterar meu palpite?").`,
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
      a: `O prêmio é calculado automaticamente pelo app assim que o resultado for lançado. O administrador vê no painel o valor exato a ser pago para cada ganhador.\n\nO pagamento do prêmio é combinado diretamente entre os ganhadores e o administrador — o app não realiza transferências automáticas de prêmios.\n\n🔑 Chave PIX obrigatória para receber\nPara facilitar o repasse, cadastre sua chave PIX no perfil (clique na sua foto/nome no topo da tela) antes do resultado ser divulgado. O administrador visualiza as chaves dos ganhadores diretamente no painel e realiza o pagamento por lá. Sem a chave cadastrada, o recebimento dependerá de contato direto com o administrador.`,
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
        className="w-full bg-white hover:bg-gray-50 text-green-900 font-bold text-sm rounded-lg px-4 py-3 text-center shadow-sm border border-gray-200 transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-base">📋</span>
        Regras e como usar o aplicativo
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white rounded-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-gray-900">
              Regras & Como Usar
            </DialogTitle>
            <p className="text-xs text-gray-500">{APP_NAME} — Copa do Mundo 2026</p>
          </DialogHeader>

          <div className="space-y-1.5 mt-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-md overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="font-semibold text-gray-800 text-xs leading-snug pr-2">{faq.q}</span>
                  {expanded === i
                    ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                </button>

                {expanded === i && (
                  <div className="px-3 py-2.5 bg-white border-t border-gray-100">
                    {faq.a.split('\n').map((line, j) =>
                      line === '' ? <div key={j} className="h-1.5" /> :
                      line.startsWith('─') ? (
                        <p key={j} className="font-mono text-xs text-gray-400">{line}</p>
                      ) : line.startsWith('•') ? (
                        <p key={j} className="text-xs text-gray-700 leading-relaxed pl-2">{line}</p>
                      ) : line.startsWith('📊') ? (
                        <p key={j} className="text-xs font-bold text-gray-800 mt-1">{line}</p>
                      ) : (
                        <p key={j} className="text-xs text-gray-700 leading-relaxed">{line}</p>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 bg-green-50 border border-green-200 rounded-md px-3 py-2.5 text-center">
            <p className="text-green-700 text-xs font-semibold">
              🇧🇷 Bora torcer e acertar o placar! Boa sorte a todos da Família {FAMILY_NAME}! 🏆
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
