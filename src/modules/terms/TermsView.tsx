import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const LAST_UPDATED = '26 de maio de 2026';
const VERSION = '1.0';

const SECTIONS = [
  {
    id: 'aceitacao',
    title: '1. Aceitação dos Termos',
    content: `Ao acessar e usar a plataforma Espaço Mix Eventos, você ("Usuário") confirma que leu, compreendeu e concorda com estes Termos de Uso e com nossa Política de Privacidade. Se você não concorda com qualquer disposição destes termos, não utilize a plataforma.

A Espaço Mix Eventos se reserva o direito de modificar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas com antecedência mínima de 10 dias por e-mail ou aviso na plataforma. O uso continuado após a publicação das alterações constitui aceitação das novas condições.`,
  },
  {
    id: 'cadastro',
    title: '2. Cadastro e Responsabilidades do Usuário',
    content: `Para adquirir ingressos ou cadastrar eventos, é necessário criar uma conta. Ao fazê-lo, você declara que:

• As informações fornecidas são verdadeiras, completas e atualizadas;
• Você é maior de 18 anos ou possui autorização de responsável legal;
• Não compartilhará sua senha ou acesso a terceiros;
• É responsável por toda atividade realizada em sua conta.

Você é responsável por manter a confidencialidade das suas credenciais de acesso. Em caso de uso não autorizado, notifique imediatamente nosso suporte.

É proibido criar contas com identidade falsa, utilizar bots para compra de ingressos, ou qualquer prática que vise burlar nossos sistemas antifraude.`,
  },
  {
    id: 'ingressos',
    title: '3. Compra de Ingressos e Pagamentos',
    content: `3.1 COMPRA E CONFIRMAÇÃO
A compra de ingressos é concluída apenas após a confirmação do pagamento pela processadora (Mercado Pago, Stripe ou outro gateway ativo). O ingresso válido é o que consta no sistema — QR Codes duplicados ou alterados serão recusados.

3.2 TAXA DE CONVENIÊNCIA
Sobre o valor do ingresso é acrescida uma taxa de conveniência (atualmente 10%) que cobre custos operacionais da plataforma, segurança de transações e suporte. Essa taxa é informada antes da confirmação da compra.

3.3 FORMAS DE PAGAMENTO
Aceitamos PIX, Cartão de Crédito e Cartão de Débito. Transações podem ser recusadas pela operadora financeira por motivos alheios à nossa vontade.

3.4 DADOS PESSOAIS NO PAGAMENTO
CPF e e-mail informados no checkout são utilizados exclusivamente para processar o pagamento e emitir o ingresso. Dados de cartão de crédito são processados diretamente pela processadora de pagamentos e não são armazenados em nossos servidores.`,
  },
  {
    id: 'cancelamento',
    title: '4. Cancelamento, Transferência e Reembolso',
    content: `4.1 CANCELAMENTO PELO USUÁRIO
O cancelamento de ingressos está sujeito à política específica de cada evento, configurada pelo produtor. Quando permitido, reembolsos são processados em até 10 dias úteis pelo mesmo método de pagamento utilizado.

4.2 CANCELAMENTO DO EVENTO
Em caso de cancelamento pelo organizador, todos os detentores de ingressos serão notificados por e-mail e reembolsados integralmente, incluindo a taxa de conveniência.

4.3 TRANSFERÊNCIA DE INGRESSOS
A plataforma oferece funcionalidade de transferência de ingressos entre usuários cadastrados, quando habilitada pelo produtor do evento. A transferência é registrada em log auditável e deve ser concluída pelo destinatário dentro do prazo estabelecido.

4.4 REEMBOLSO DA TAXA DE CONVENIÊNCIA
A taxa de conveniência somente é reembolsada em caso de cancelamento do evento pelo organizador ou por falha imputável à plataforma.`,
  },
  {
    id: 'produtores',
    title: '5. Produtores de Eventos',
    content: `5.1 APROVAÇÃO E KYC
Para criar e vender ingressos, o usuário deve solicitar acesso como produtor e passar pelo processo de verificação de identidade (KYC). A aprovação é discricionária e pode ser revogada a qualquer momento em caso de violação destes termos.

5.2 RESPONSABILIDADES DO PRODUTOR
O produtor é inteiramente responsável pela realização do evento conforme divulgado, pela veracidade das informações cadastradas, pelo cumprimento das leis de segurança e capacidade do local, e pelo atendimento ao público.

5.3 REPASSES FINANCEIROS
Os valores arrecadados, descontadas taxas da plataforma e do gateway de pagamento, são repassados ao produtor conforme cronograma configurado. A Espaço Mix atua como intermediária — não garante a realização do evento.

5.4 CONFORMIDADE FISCAL
O produtor é responsável pelo recolhimento dos tributos incidentes sobre as receitas de bilheteria.`,
  },
  {
    id: 'proibicoes',
    title: '6. Usos Proibidos',
    content: `É expressamente proibido:

• Revender ingressos com sobrepreço ("cambismo") fora dos canais oficiais da plataforma;
• Usar meios automatizados (bots, scripts) para adquirir ingressos;
• Tentar acessar áreas restritas da plataforma sem autorização;
• Fornecer dados falsos, utilizar identidade de terceiros ou documentos fraudulentos;
• Realizar qualquer ação que interfira no funcionamento normal da plataforma;
• Publicar eventos que incentivem violência, discriminação, atividades ilegais ou conteúdo sexualmente explícito;
• Usar a plataforma para lavagem de dinheiro ou qualquer atividade financeira ilícita.

A violação destas regras pode resultar em suspensão imediata da conta, cancelamento dos ingressos e, quando aplicável, comunicação às autoridades competentes.`,
  },
  {
    id: 'propriedade',
    title: '7. Propriedade Intelectual',
    content: `Todo o conteúdo da plataforma — incluindo código-fonte, design, logotipos, textos, imagens institucionais e funcionalidades — é propriedade da Espaço Mix Eventos ou de seus licenciantes, protegidos pela Lei 9.610/98.

Produtores concedem à plataforma licença não exclusiva para exibir informações, imagens e descrições dos eventos cadastrados enquanto estes estiverem publicados.

É proibida qualquer reprodução, distribuição ou modificação do conteúdo da plataforma sem autorização prévia e escrita.`,
  },
  {
    id: 'responsabilidade',
    title: '8. Limitação de Responsabilidade',
    content: `A Espaço Mix Eventos atua como plataforma intermediária de venda de ingressos. Não somos organizadores dos eventos listados e não nos responsabilizamos por:

• Cancelamento, alteração ou descumprimento do evento pelo produtor;
• Danos ou lesões sofridos no local do evento;
• Conteúdo divulgado pelo produtor sobre o evento;
• Interrupções temporárias do serviço por manutenção ou falhas técnicas.

Nossa responsabilidade, quando aplicável, limita-se ao valor efetivamente pago pelo usuário pelo(s) ingresso(s) objeto da reclamação.

A plataforma emprega medidas de segurança padrão do mercado, mas não garante a ausência absoluta de falhas. Em caso de incidente de segurança, os usuários afetados serão notificados conforme exige a LGPD.`,
  },
  {
    id: 'vigencia',
    title: '9. Vigência e Rescisão',
    content: `Estes Termos entram em vigor no momento do cadastro na plataforma e permanecem válidos enquanto a conta estiver ativa.

O usuário pode encerrar sua conta a qualquer momento através de Perfil → Privacidade → Excluir Conta. Após a exclusão, dados que precisam ser mantidos por obrigação legal serão conservados pelo prazo previsto na Política de Privacidade.

A Espaço Mix Eventos pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso prévio, a critério da plataforma.`,
  },
  {
    id: 'legislacao',
    title: '10. Lei Aplicável e Foro',
    content: `Estes Termos são regidos pelas leis da República Federativa do Brasil, incluindo o Código de Defesa do Consumidor (Lei 8.078/90), a LGPD (Lei 13.709/18), o Marco Civil da Internet (Lei 12.965/14) e demais normas aplicáveis.

Fica eleito o foro da Comarca de São Paulo – SP para dirimir quaisquer controvérsias oriundas destes Termos, ressalvado o direito do consumidor de optar pelo foro de seu domicílio.

Para suporte e resolução amigável de conflitos: suporte@espacomix.com.br`,
  },
] as const;

export function TermsView() {
  const { setCurrentView } = useApp();
  const [openSection, setOpenSection] = useState<string | null>('aceitacao');

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

        <button
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80 transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-white">Termos de Uso</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Espaço Mix Eventos</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-3 py-1">
              Versão {VERSION}
            </span>
            <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-3 py-1">
              Atualizado em {LAST_UPDATED}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {SECTIONS.map(section => {
            const isOpen = openSection === section.id;
            return (
              <div
                key={section.id}
                className={`border rounded-2xl overflow-hidden transition-colors ${
                  isOpen ? 'border-white/20 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01]'
                }`}
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <span className={`text-sm font-bold flex-1 transition-colors ${isOpen ? 'text-white' : 'text-white/60'}`}>
                    {section.title}
                  </span>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-white/20 shrink-0" />
                  }
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0 border-t border-white/5">
                        <p className="text-sm text-white/55 leading-relaxed whitespace-pre-line mt-4">
                          {section.content}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-white/20">
            Ao usar a plataforma, você confirma ter lido e concordado com estes termos.
          </p>
          <button
            onClick={() => setCurrentView('privacy')}
            className="text-[10px] text-[#d4af37]/60 hover:text-[#d4af37] transition uppercase tracking-widest border border-[#d4af37]/20 rounded-full px-4 py-2"
          >
            Ver Política de Privacidade
          </button>
        </div>

      </motion.div>
    </div>
  );
}
