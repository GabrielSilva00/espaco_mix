import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Shield, Database, Clock, Users, Lock, Mail,
  FileText, Eye, Trash2, Download, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const LAST_UPDATED = '26 de maio de 2026';
const POLICY_VERSION = '2.0';
const DPO_EMAIL = 'privacidade@espacomix.com.br';

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

export function PrivacyView() {
  const { setCurrentView } = useApp();
  const [openSection, setOpenSection] = useState<string | null>('coleta');

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const sections: Section[] = [
    {
      id: 'coleta',
      icon: Database,
      title: '1. Dados que Coletamos',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/60 leading-relaxed">
            Coletamos apenas os dados estritamente necessários para cada finalidade declarada.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-white/40 uppercase tracking-widest font-bold">Dado</th>
                  <th className="text-left py-2 pr-4 text-white/40 uppercase tracking-widest font-bold">Finalidade</th>
                  <th className="text-left py-2 text-white/40 uppercase tracking-widest font-bold">Base Legal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ['Nome completo', 'Identificação na plataforma e nos ingressos', 'Execução de contrato (Art. 7º, V)'],
                  ['E-mail', 'Autenticação, envio de ingressos e comunicações', 'Execução de contrato (Art. 7º, V)'],
                  ['CPF', 'Prevenção de fraudes, limite por CPF, conformidade', 'Legítimo interesse / Obrigação legal (Art. 7º, IX)'],
                  ['Telefone', 'Verificação de identidade no cadastro', 'Consentimento (Art. 7º, I)'],
                  ['Data de nascimento', 'Verificação de faixa etária em eventos restritos', 'Execução de contrato (Art. 7º, V)'],
                  ['Dados bancários / PIX', 'Repasse financeiro a produtores aprovados', 'Execução de contrato (Art. 7º, V)'],
                  ['Documentos (KYC)', 'Verificação de identidade de produtores de eventos', 'Obrigação legal / Execução de contrato'],
                  ['Endereço (KYC)', 'Verificação de produtores e emissão de notas', 'Obrigação legal'],
                  ['IP e User-Agent', 'Segurança, prevenção de fraudes, logs de auditoria', 'Legítimo interesse (Art. 7º, IX)'],
                  ['Histórico de compras', 'Exibição de reservas e suporte ao usuário', 'Execução de contrato (Art. 7º, V)'],
                ].map(([dado, finalidade, base], i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition">
                    <td className="py-2.5 pr-4 font-bold text-white/80">{dado}</td>
                    <td className="py-2.5 pr-4 text-white/50">{finalidade}</td>
                    <td className="py-2.5 text-white/40">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'armazenamento',
      icon: Lock,
      title: '2. Como Armazenamos e Protegemos',
      content: (
        <div className="space-y-3 text-sm text-white/60 leading-relaxed">
          <p>Seus dados são armazenados na infraestrutura do <strong className="text-white/80">Supabase</strong>, hospedado em servidores certificados ISO 27001 com criptografia em repouso (AES-256) e em trânsito (TLS 1.3).</p>
          <ul className="space-y-2 ml-4">
            {[
              'Senhas: armazenadas exclusivamente como hash bcrypt — nunca em texto puro.',
              'CPF: transmitido via HTTPS e validado no servidor; não exibido em logs.',
              'Tokens de sessão: gerenciados pelo Supabase Auth com expiração automática.',
              'Dados bancários: trafegam apenas entre frontend e backend via HTTPS.',
              'Documentos KYC: armazenados em bucket privado no Supabase Storage, sem acesso público.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#d4af37] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mt-4">
            <p className="text-[11px] text-amber-400/80">
              <strong>Importante:</strong> QR Codes de ingressos são gerados via serviço externo (qrserver.com). O ID do ingresso é enviado para esse serviço para criação da imagem. Não enviamos dados pessoais (nome, CPF, e-mail) a esse serviço.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'retencao',
      icon: Clock,
      title: '3. Por Quanto Tempo Guardamos',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-white/60 leading-relaxed">Os dados são mantidos apenas pelo período necessário à finalidade que motivou sua coleta.</p>
          <div className="space-y-2">
            {[
              { tipo: 'Dados de conta (nome, e-mail)', prazo: 'Enquanto a conta estiver ativa + 5 anos', motivo: 'Obrigações legais e fiscais' },
              { tipo: 'CPF e dados de compra', prazo: '5 anos após a compra', motivo: 'Código Tributário Nacional (CTN, Art. 173)' },
              { tipo: 'Logs de auditoria (IP, ações)', prazo: '2 anos', motivo: 'Segurança e prevenção de fraudes' },
              { tipo: 'Dados bancários do produtor', prazo: 'Até exclusão da conta + 5 anos', motivo: 'Obrigações de prestação de contas' },
              { tipo: 'Documentos KYC', prazo: '5 anos após aprovação/reprovação', motivo: 'Compliance regulatório' },
              { tipo: 'Carrinho de compras (localStorage)', prazo: 'Até fechar o navegador ou completar a compra', motivo: 'Funcional / sessão do usuário' },
            ].map((row, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <p className="text-[11px] font-bold text-white/80 mb-1">{row.tipo}</p>
                <p className="text-[10px] text-[#d4af37]/80 mb-0.5">⏱ {row.prazo}</p>
                <p className="text-[10px] text-white/40">{row.motivo}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'compartilhamento',
      icon: Users,
      title: '4. Compartilhamento de Dados',
      content: (
        <div className="space-y-3 text-sm text-white/60 leading-relaxed">
          <p>Não vendemos dados pessoais. O compartilhamento é restrito aos seguintes casos:</p>
          <div className="space-y-2">
            {[
              { empresa: 'Supabase Inc.', tipo: 'Processador de dados', dados: 'Todos os dados do banco de dados', motivo: 'Infraestrutura de armazenamento e autenticação' },
              { empresa: 'Mercado Pago / Stripe', tipo: 'Processador de pagamento', dados: 'Nome, CPF, e-mail (para processamento)', motivo: 'Autorização de pagamentos' },
              { empresa: 'qrserver.com', tipo: 'Serviço externo', dados: 'ID único do ingresso (sem dados pessoais)', motivo: 'Geração de imagem QR Code' },
              { empresa: 'Autoridades públicas', tipo: 'Obrigação legal', dados: 'Dados solicitados por ordem judicial', motivo: 'Cumprimento de obrigações legais' },
            ].map((row, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold text-white/80">{row.empresa}</p>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 border border-white/10 px-2 py-0.5 rounded-full">{row.tipo}</span>
                </div>
                <p className="text-[10px] text-white/50 mb-0.5"><span className="text-white/30">Dados: </span>{row.dados}</p>
                <p className="text-[10px] text-white/40"><span className="text-white/30">Motivo: </span>{row.motivo}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'direitos',
      icon: Shield,
      title: '5. Seus Direitos (LGPD, Art. 18)',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-white/60 leading-relaxed">Como titular de dados, você possui os seguintes direitos garantidos pela LGPD:</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: Eye, title: 'Acesso', desc: 'Solicitar confirmação e acesso aos dados que temos sobre você.', action: 'Exportar Dados em Perfil → Privacidade' },
              { icon: RefreshCw, title: 'Correção', desc: 'Corrigir dados incompletos, inexatos ou desatualizados.', action: 'Editar Perfil na sua conta' },
              { icon: Trash2, title: 'Eliminação', desc: 'Solicitar exclusão de dados desnecessários ou tratados em desacordo com a lei.', action: 'Excluir Conta em Perfil → Privacidade' },
              { icon: Download, title: 'Portabilidade', desc: 'Receber seus dados em formato estruturado (JSON).', action: 'Exportar Dados em Perfil → Privacidade' },
              { icon: FileText, title: 'Informação', desc: 'Ser informado sobre com quem compartilhamos seus dados.', action: 'Consulte a seção 4 desta política' },
              { icon: Lock, title: 'Revogação', desc: 'Retirar consentimento a qualquer momento.', action: 'Gerenciar consentimentos em Perfil → Privacidade' },
            ].map((right, i) => {
              const Icon = right.icon;
              return (
                <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#d4af37]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/80 mb-0.5">{right.title}</p>
                    <p className="text-[10px] text-white/50 leading-relaxed mb-1">{right.desc}</p>
                    <p className="text-[10px] text-[#d4af37]/60">→ {right.action}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed mt-2">
            Algumas solicitações podem ser limitadas quando houver obrigação legal de manutenção dos dados. O prazo de resposta é de até <strong className="text-white/60">15 dias úteis</strong>.
          </p>
        </div>
      ),
    },
    {
      id: 'cookies',
      icon: Database,
      title: '6. Cookies e Armazenamento Local',
      content: (
        <div className="space-y-3 text-sm text-white/60 leading-relaxed">
          <p>Utilizamos <code className="text-[#d4af37]/80 bg-white/5 px-1 rounded text-xs">localStorage</code> do navegador — não cookies de rastreamento tradicionais.</p>
          <div className="space-y-2">
            {[
              { chave: 'lgpd-consent-v2', conteudo: 'Suas preferências de consentimento (categorias aceitas + data)', duracao: 'Permanente (até revogação)' },
              { chave: 'eventix-session', conteudo: 'Itens no carrinho, método de pagamento, etapa do checkout', duracao: 'Sessão de compra (até concluir ou cancelar)' },
              { chave: 'eventix_developer_config', conteudo: 'Configurações do painel developer (somente para usuários developer)', duracao: 'Permanente (somente usuários internos)' },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <p className="text-[11px] font-mono text-[#d4af37]/80 mb-1">{item.chave}</p>
                <p className="text-[10px] text-white/50 mb-0.5">{item.conteudo}</p>
                <p className="text-[10px] text-white/30">⏱ {item.duracao}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'contato',
      icon: Mail,
      title: '7. Contato e DPO',
      content: (
        <div className="space-y-3 text-sm text-white/60 leading-relaxed">
          <p>Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato com nosso Encarregado de Proteção de Dados (DPO):</p>
          <div className="bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-xl p-4 space-y-2">
            <p className="text-[11px]"><span className="text-white/40">Empresa:</span> <strong className="text-white/80">Espaço Mix Eventos</strong></p>
            <p className="text-[11px]"><span className="text-white/40">DPO:</span> <strong className="text-white/80">Encarregado de Proteção de Dados</strong></p>
            <p className="text-[11px]"><span className="text-white/40">E-mail:</span>{' '}
              <a href={`mailto:${DPO_EMAIL}`} className="text-[#d4af37] hover:brightness-110 transition">{DPO_EMAIL}</a>
            </p>
            <p className="text-[11px]"><span className="text-white/40">Prazo de resposta:</span> <strong className="text-white/80">Até 15 dias úteis</strong></p>
          </div>
          <p className="text-[10px] text-white/30">
            Você também pode registrar reclamação perante a Autoridade Nacional de Proteção de Dados (ANPD) em{' '}
            <span className="text-[#d4af37]/60">gov.br/anpd</span>.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

        {/* Voltar */}
        <button
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80 transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-white">Política de Privacidade</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Espaço Mix Eventos</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-3 py-1">
              Versão {POLICY_VERSION}
            </span>
            <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-3 py-1">
              Atualizado em {LAST_UPDATED}
            </span>
            <span className="text-[10px] text-[#d4af37]/60 border border-[#d4af37]/20 rounded-full px-3 py-1">
              LGPD — Lei 13.709/2018
            </span>
          </div>
        </div>

        {/* Seções acordeão */}
        <div className="space-y-2">
          {sections.map(section => {
            const Icon = section.icon;
            const isOpen = openSection === section.id;
            return (
              <div
                key={section.id}
                className={`border rounded-2xl overflow-hidden transition-colors ${
                  isOpen ? 'border-[#d4af37]/30 bg-[#d4af37]/[0.02]' : 'border-white/10 bg-white/[0.01]'
                }`}
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-[#d4af37]' : 'text-white/30'}`} />
                  <span className={`text-sm font-bold flex-1 transition-colors ${isOpen ? 'text-white' : 'text-white/60'}`}>
                    {section.title}
                  </span>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-[#d4af37]/60 shrink-0" />
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
                        {section.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-white/20">
            Esta política pode ser atualizada. Notificaremos usuários ativos sobre mudanças relevantes.
          </p>
          <button
            onClick={() => setCurrentView('profile-privacy')}
            className="text-[10px] text-[#d4af37]/60 hover:text-[#d4af37] transition uppercase tracking-widest border border-[#d4af37]/20 rounded-full px-4 py-2"
          >
            Gerenciar Meus Dados
          </button>
        </div>

      </motion.div>
    </div>
  );
}
