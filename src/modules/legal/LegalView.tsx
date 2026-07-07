import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Cookie, FileText, ChevronUp, ArrowLeft, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getSystemConfig, SystemConfig } from '../../lib/supabase';

const PLACEHOLDER = '[A PREENCHER]';
// Canal de privacidade padrão (usado quando o dono ainda não cadastrou um DPO no painel).
const PRIVACY_EMAIL = 'contato@espacomix.com.br';

interface LegalData {
  companyName: string;
  cnpj: string;
  dpoName: string;
  dpoEmail: string;
  legalCity: string;
}

// Campos legais vazios caem para string vazia (ocultados na renderização) em vez de
// "[A PREENCHER]"; o dono preenche depois em Configurações → Dados da empresa.
function buildLegalData(c: Partial<SystemConfig>): LegalData {
  return {
    companyName: c.company_name || 'Espaço Mix',
    cnpj:        c.document     || '',
    dpoName:     c.dpo_name     || '',
    dpoEmail:    c.dpo_email    || PRIVACY_EMAIL,
    legalCity:   c.legal_city   || '',
  };
}

type TabId = 'privacy' | 'cookies' | 'terms';

export interface LegalViewProps {
  initialTab?: TabId;
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────
function T({ children }: { children: React.ReactNode }) {
  return <strong className="text-white/90 font-semibold">{children}</strong>;
}

function GlossaryItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-white/[0.05] last:border-b-0">
      <span className="shrink-0 text-[#d4af37] font-bold text-[13px] min-w-[160px]">{term}:</span>
      <span className="text-white/60 text-[14px] leading-relaxed">{children}</span>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#d4af37]/[0.04] border border-[#d4af37]/20 rounded-xl p-4 text-[13px] text-white/60 leading-relaxed my-4">
      {children}
    </div>
  );
}

function SectionBlock({ id, number, title, children }: {
  id: string; number: number; title: string; children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-section="true"
      className="scroll-mt-28 py-8 border-t border-white/[0.06] first:border-t-0"
    >
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-[#d4af37]/30 font-mono text-[13px] font-bold shrink-0">
          {String(number).padStart(2, '0')}
        </span>
        <h2 className="text-[15px] font-bold text-[#d4af37] uppercase tracking-wider leading-tight">
          {title}
        </h2>
      </div>
      <div className="space-y-3.5 text-[15px] text-white/60 leading-[1.85]">
        {children}
      </div>
    </section>
  );
}

// ─── Dados de navegação lateral ───────────────────────────────────────────────
const SIDEBAR: Record<TabId, { id: string; title: string }[]> = {
  privacy: [
    { id: 'pp-01', title: 'Introdução' },
    { id: 'pp-02', title: 'Glossário' },
    { id: 'pp-03', title: 'Autorização e obtenção de dados' },
    { id: 'pp-04', title: 'Utilização das informações' },
    { id: 'pp-05', title: 'Compartilhamento de dados' },
    { id: 'pp-06', title: 'Armazenamento e proteção' },
    { id: 'pp-07', title: 'Transferência internacional' },
    { id: 'pp-08', title: 'Cookies e tecnologias' },
    { id: 'pp-09', title: 'Utilização por menores' },
    { id: 'pp-10', title: 'Direitos dos usuários' },
    { id: 'pp-11', title: 'Disposições gerais' },
    { id: 'pp-12', title: 'Alterações da política' },
    { id: 'pp-13', title: 'Legislação e foro' },
    { id: 'pp-14', title: 'Contato' },
  ],
  cookies: [
    { id: 'ck-01', title: 'Introdução' },
    { id: 'ck-02', title: 'Glossário' },
    { id: 'ck-03', title: 'Considerações sobre cookies' },
    { id: 'ck-04', title: 'Utilização e finalidades' },
    { id: 'ck-05', title: 'Cookies de terceiros' },
    { id: 'ck-06', title: 'Tecnologias de rastreamento' },
    { id: 'ck-07', title: 'Alterações da política' },
    { id: 'ck-08', title: 'Disposições gerais' },
    { id: 'ck-09', title: 'Legislação e foro' },
    { id: 'ck-10', title: 'Contato' },
  ],
  terms: [
    { id: 'tu-01', title: 'Introdução' },
    { id: 'tu-02', title: 'Glossário' },
    { id: 'tu-03', title: 'Informações gerais' },
    { id: 'tu-04', title: 'Cadastro de usuários' },
    { id: 'tu-05', title: 'Acesso à plataforma' },
    { id: 'tu-06', title: 'Responsabilidades dos consumidores' },
    { id: 'tu-07', title: 'Entrega e uso de ingressos' },
    { id: 'tu-08', title: 'Vendas de ingressos' },
    { id: 'tu-09', title: 'Cancelamento e reembolso' },
    { id: 'tu-10', title: 'Transferência de titularidade' },
    { id: 'tu-11', title: 'Contestações e estornos' },
    { id: 'tu-12', title: 'Taxas aplicáveis' },
    { id: 'tu-13', title: 'Propriedade intelectual' },
    { id: 'tu-14', title: 'Segurança da plataforma' },
    { id: 'tu-15', title: 'Privacidade dos usuários' },
    { id: 'tu-16', title: 'Proteção de registros' },
    { id: 'tu-17', title: 'Limitação de responsabilidade' },
    { id: 'tu-18', title: 'Disposições finais' },
    { id: 'tu-19', title: 'Foro aplicável' },
  ],
};

// ─── Conteúdo: POLÍTICA DE PRIVACIDADE ───────────────────────────────────────
function PrivacySections({ onTab, ld }: { onTab: (t: TabId) => void; ld: LegalData }) {
  return (
    <>
      <SectionBlock id="pp-01" number={1} title="Introdução">
        <p>
          A <T>{ld.companyName}</T>{ld.cnpj && <>, inscrita no CNPJ sob o nº <T>{ld.cnpj}</T></>} opera
          a plataforma <T>Espaço Mix</T> e está comprometida
          com a proteção dos dados pessoais de seus usuários, em conformidade com a{' '}
          <T>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</T> e demais
          legislações aplicáveis.
        </p>
        <p>
          Esta Política de Privacidade descreve como coletamos, utilizamos, compartilhamos
          e protegemos as informações pessoais fornecidas ao acessar ou utilizar a Plataforma.
        </p>
        <p>
          Ao criar uma conta ou utilizar nossos serviços, você declara ter lido, compreendido
          e concordado com esta Política. Caso não concorde com qualquer disposição aqui
          contida, recomendamos que não utilize a Plataforma.
        </p>
        <InfoBox>
          Caso deseje exercer seus direitos de acesso, retificação ou exclusão de dados,
          entre em contato com nosso canal de privacidade através do e-mail:{' '}
          <a href={`mailto:${ld.dpoEmail}`} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            {ld.dpoEmail}
          </a>.
        </InfoBox>
      </SectionBlock>

      <SectionBlock id="pp-02" number={2} title="Glossário">
        <p className="mb-3">Para efeitos desta Política, os termos abaixo possuem os seguintes significados:</p>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <GlossaryItem term="Dado pessoal">Informação relacionada a pessoa natural identificada ou identificável.</GlossaryItem>
          <GlossaryItem term="Dado não pessoal">Informação que não permite, por si só, a identificação de uma pessoa natural.</GlossaryItem>
          <GlossaryItem term="Plataforma">Sistema digital Espaço Mix, acessível via navegador web ou aplicativo móvel.</GlossaryItem>
          <GlossaryItem term="Conta">Cadastro individual criado pelo usuário para acesso à Plataforma.</GlossaryItem>
          <GlossaryItem term="Consumidor">Pessoa natural que adquire ingressos para eventos disponíveis na Plataforma.</GlossaryItem>
          <GlossaryItem term="Organizador">Pessoa física ou jurídica responsável pela criação, gestão e realização de eventos.</GlossaryItem>
          <GlossaryItem term="Participante">Titular de ingresso para evento específico, podendo ou não ser o Consumidor.</GlossaryItem>
          <GlossaryItem term="Usuário">Toda pessoa que acessa ou utiliza a Plataforma, independentemente de ter efetuado compras.</GlossaryItem>
          <GlossaryItem term="Titularidade">Qualidade de titular de um ingresso, conferindo direito de acesso ao evento correspondente.</GlossaryItem>
          <GlossaryItem term="Controlador">A {ld.companyName}, que determina as finalidades e meios do tratamento dos dados pessoais.</GlossaryItem>
          <GlossaryItem term="Operador">Pessoa natural ou jurídica que realiza o tratamento de dados em nome do Controlador.</GlossaryItem>
          <GlossaryItem term="Encarregado (DPO)">Responsável pela comunicação entre Controlador, titulares de dados e a ANPD{ld.dpoName ? `: ${ld.dpoName}` : ''}.</GlossaryItem>
          <GlossaryItem term="Tratamento">Toda operação realizada com dados pessoais, como coleta, armazenamento, uso e exclusão.</GlossaryItem>
          <GlossaryItem term="Consentimento">Manifestação livre, informada e inequívoca do titular concordando com o tratamento de seus dados.</GlossaryItem>
          <GlossaryItem term="Anonimização">Processo que impossibilita a associação dos dados a um titular específico, de forma irreversível.</GlossaryItem>
          <GlossaryItem term="Violação">Acesso não autorizado, destruição, perda ou alteração acidental de dados pessoais.</GlossaryItem>
          <GlossaryItem term="Cookies">Pequenos arquivos de texto armazenados no dispositivo do usuário para fins de funcionamento e análise da Plataforma.</GlossaryItem>
        </div>
      </SectionBlock>

      <SectionBlock id="pp-03" number={3} title="Autorização e Obtenção de Dados">
        <p>Coletamos dados pessoais nas seguintes situações:</p>
        <ul className="list-none space-y-2 mt-2">
          {[
            ['Cadastro', 'Nome completo, e-mail, CPF, telefone e data de nascimento.'],
            ['Compra de ingressos', 'Dados de pagamento, endereço de cobrança e informações de participantes.'],
            ['Navegação', 'Endereço IP, navegador, dispositivo, páginas acessadas e duração de sessão (via cookies).'],
            ['Suporte', 'Conteúdo das mensagens enviadas ao atendimento.'],
            ['Login social', 'Dados básicos do perfil da rede social utilizada, quando autorizado pelo usuário.'],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="text-[#d4af37]/50 font-bold shrink-0 min-w-[140px] text-[13px]">{t}:</span>
              <span className="text-white/60 text-[14px]">{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          O fornecimento de dados é <T>voluntário</T>, ressalvados aqueles imprescindíveis
          para a prestação dos serviços contratados. A recusa em fornecer dados obrigatórios
          pode impossibilitar o acesso a determinadas funcionalidades.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-04" number={4} title="Utilização das Informações Coletadas">
        <p>Os dados pessoais coletados são utilizados para:</p>
        <ul className="mt-3 space-y-2">
          {[
            'Criação e gerenciamento de conta na Plataforma;',
            'Processamento de compras e emissão de ingressos eletrônicos (e-tickets);',
            'Comunicações sobre eventos adquiridos, atualizações e avisos importantes;',
            'Cumprimento de obrigações legais, regulatórias e contratuais;',
            'Melhoria contínua dos serviços e personalização da experiência do usuário;',
            'Prevenção a fraudes, atividades ilícitas e garantia da segurança da Plataforma;',
            'Envio de comunicações promocionais e novidades (somente com consentimento expresso);',
            'Análise de desempenho e comportamento de uso para fins estatísticos agregados.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="pp-05" number={5} title="Compartilhamento de Dados Pessoais">
        <p>
          A {ld.companyName} <T>não vende dados pessoais</T> a terceiros. O compartilhamento
          poderá ocorrer nas seguintes hipóteses:
        </p>
        <ul className="mt-3 space-y-2">
          {[
            ['Organizadores de eventos', 'Dados necessários para controle de acesso e gestão de participantes do evento adquirido.'],
            ['Processadores de pagamento', 'Dados de transação para finalização segura da compra.'],
            ['Prestadores de serviços de TI', 'Hospedagem, infraestrutura e suporte técnico, sempre sob obrigação de confidencialidade.'],
            ['Autoridades competentes', 'Quando exigido por ordem judicial, administrativa ou legal.'],
            ['Parceiros analíticos', 'Exclusivamente dados anonimizados ou agregados, sem possibilidade de identificação individual.'],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3 py-1.5 border-b border-white/[0.04] last:border-b-0">
              <span className="text-[#d4af37]/60 font-bold shrink-0 text-[13px] min-w-[200px]">{t}:</span>
              <span className="text-[14px]">{d}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="pp-06" number={6} title="Armazenamento, Tempo e Proteção">
        <p>
          Os dados são armazenados em servidores seguros, localizados no Brasil e/ou no
          exterior, conforme necessário para a prestação dos serviços. Mantemos os dados
          pelo tempo necessário ao cumprimento das finalidades descritas nesta Política e ao
          atendimento de obrigações legais.
        </p>
        <p>
          Adotamos medidas técnicas e administrativas para proteger os dados pessoais, incluindo:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Criptografia de dados em trânsito (TLS/SSL) e em repouso;',
            'Controle de acesso baseado em perfis de permissão;',
            'Monitoramento contínuo de sistemas e auditoria de acessos;',
            'Políticas internas de segurança da informação;',
            'Treinamento periódico de equipes.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Em caso de <T>violação de dados</T>, notificaremos a ANPD e os titulares afetados
          nos prazos estabelecidos pela LGPD.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-07" number={7} title="Transferência Internacional de Dados">
        <p>
          Quando houver necessidade de transferir dados pessoais a países estrangeiros,
          a {ld.companyName} assegurará que as transferências observem os requisitos da LGPD,
          mediante adoção de:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Cláusulas contratuais específicas de proteção de dados;',
            'Padrões globais reconhecidos de conformidade (ex.: GDPR da União Europeia);',
            'Verificação prévia de adequação do país receptor, conforme regulamentação da ANPD.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="pp-08" number={8} title="Cookies e Outras Tecnologias">
        <p>
          Utilizamos cookies e tecnologias similares para garantir o funcionamento adequado
          da Plataforma, melhorar a experiência do usuário e realizar análises de desempenho.
        </p>
        <p>
          Para informações detalhadas sobre os tipos de cookies utilizados, suas finalidades
          e como gerenciá-los, consulte nossa{' '}
          <button
            onClick={() => onTab('cookies')}
            className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors font-medium"
          >
            Política de Cookies
          </button>.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-09" number={9} title="Utilização por Menores">
        <p>
          Em conformidade com o <T>Art. 14 da LGPD</T>, o tratamento de dados pessoais
          de <T>crianças</T> (até 12 anos) e <T>adolescentes</T> (de 12 a 18 anos) somente
          ocorrerá com o <T>consentimento específico e em destaque</T> de pelo menos um dos
          pais ou do responsável legal.
        </p>
        <p>
          A Plataforma não é direcionada a menores de 16 anos. Caso identifiquemos o
          cadastro de menor sem a devida autorização, procederemos à exclusão imediata dos
          dados, salvo obrigação legal de retenção.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-10" number={10} title="Direitos dos Usuários">
        <p>
          Nos termos do <T>Art. 18 da LGPD</T>, o titular dos dados pessoais tem direito a
          solicitar, a qualquer tempo, mediante requisição ao DPO:
        </p>
        <div className="mt-4 space-y-3">
          {[
            ['Informação', 'Confirmar a existência de tratamento de seus dados pessoais.'],
            ['Acesso', 'Acessar os dados que possuímos sobre você.'],
            ['Correção', 'Solicitar a atualização de dados incompletos, inexatos ou desatualizados.'],
            ['Anonimização', 'Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.'],
            ['Portabilidade', 'Receber seus dados em formato estruturado e interoperável.'],
            ['Exclusão', 'Solicitar a eliminação de dados tratados com base em consentimento.'],
            ['Revogação', 'Revogar o consentimento a qualquer tempo, sem prejuízo da licitude do tratamento anterior.'],
            ['Petição à ANPD', 'Apresentar reclamação perante a Autoridade Nacional de Proteção de Dados.'],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <span className="text-[#d4af37] font-bold text-[13px] shrink-0 min-w-[140px]">{t}</span>
              <span className="text-white/55 text-[14px]">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-4">
          Para exercer seus direitos, entre em contato com nosso DPO pelo e-mail{' '}
          <a href={ld.dpoEmail !== PLACEHOLDER ? `mailto:${ld.dpoEmail}` : undefined} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            {ld.dpoEmail}
          </a>.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-11" number={11} title="Disposições Gerais">
        <p>
          Esta Política se aplica a todos os usuários da Plataforma Espaço Mix. A {ld.companyName}
          pode compartilhar, ceder ou transferir direitos e obrigações decorrentes desta
          Política a terceiros, desde que assegurada a continuidade da proteção dos dados
          pessoais nos mesmos termos aqui estabelecidos.
        </p>
        <p>
          A invalidade ou inaplicabilidade de qualquer disposição desta Política não afetará
          as demais disposições, que permanecerão válidas e eficazes.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-12" number={12} title="Alterações da Política">
        <p>
          Esta Política poderá ser atualizada periodicamente para refletir mudanças em nossas
          práticas ou na legislação aplicável. Alterações relevantes serão comunicadas por
          meio de aviso na Plataforma ou por e-mail com antecedência razoável.
        </p>
        <p>
          A continuidade do uso da Plataforma após a data de vigência das alterações
          constituirá aceitação das novas condições. Recomendamos a revisão periódica desta
          Política. A data da última atualização consta sempre no topo do documento.
        </p>
      </SectionBlock>

      <SectionBlock id="pp-13" number={13} title="Legislação e Foro">
        <p>
          Esta Política de Privacidade é regida e interpretada de acordo com as leis da
          República Federativa do Brasil, em especial pela{' '}
          <T>Lei nº 13.709/2018 (LGPD)</T>, pelo{' '}
          <T>Código de Defesa do Consumidor (Lei nº 8.078/1990)</T> e pelo{' '}
          <T>Marco Civil da Internet (Lei nº 12.965/2014)</T>.
        </p>
        <p>
          {ld.legalCity
            ? <>Fica eleito o <T>Foro da Comarca de {ld.legalCity}</T> como competente para
                dirimir quaisquer controvérsias oriundas desta Política, com renúncia expressa a
                qualquer outro, por mais privilegiado que seja.</>
            : <>Fica eleito o foro do domicílio do consumidor como competente para dirimir
                quaisquer controvérsias oriundas desta Política.</>}
        </p>
      </SectionBlock>

      <SectionBlock id="pp-14" number={14} title="Contato">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-2.5 text-[14px]">
          {ld.companyName && <p><T>Razão Social:</T> {ld.companyName}</p>}
          {ld.cnpj && <p><T>CNPJ:</T> {ld.cnpj}</p>}
          <p>
            <T>E-mail:</T>{' '}
            <a href={`mailto:${ld.dpoEmail}`} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
              {ld.dpoEmail}
            </a>
          </p>
        </div>
      </SectionBlock>
    </>
  );
}

// ─── Conteúdo: POLÍTICA DE COOKIES ───────────────────────────────────────────
function CookiesSections({ onTab, ld }: { onTab: (t: TabId) => void; ld: LegalData }) {
  return (
    <>
      <SectionBlock id="ck-01" number={1} title="Introdução">
        <p>
          A <T>{ld.companyName}</T> utiliza cookies e
          tecnologias similares na Plataforma <T>Espaço Mix</T> para garantir o
          funcionamento adequado dos serviços, melhorar a experiência do usuário e
          analisar o desempenho da Plataforma.
        </p>
        <p>
          Esta Política de Cookies complementa nossa{' '}
          <button onClick={() => onTab('privacy')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors font-medium">
            Política de Privacidade
          </button>{' '}
          e explica o que são cookies, como os utilizamos e como você pode gerenciá-los.
        </p>
        <p>
          Ao continuar navegando na Plataforma, você concorda com o uso de cookies
          conforme descrito nesta Política. Você pode gerenciar suas preferências
          de cookies a qualquer momento.
        </p>
      </SectionBlock>

      <SectionBlock id="ck-02" number={2} title="Glossário">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <GlossaryItem term="Cookies">
            Pequenos arquivos de texto armazenados no seu dispositivo pelo servidor web
            ao visitar uma página. Permitem que a Plataforma reconheça seu dispositivo
            e salve informações sobre sua visita.
          </GlossaryItem>
          <GlossaryItem term="Armazenamento local">
            Mecanismo do navegador (localStorage/sessionStorage) que permite armazenar
            dados no dispositivo do usuário sem prazo de expiração definido pelo servidor.
          </GlossaryItem>
          <GlossaryItem term="Identificador de dispositivo">
            Código único atribuído ao dispositivo do usuário para fins de identificação
            e segurança, sem revelar dados pessoais diretamente.
          </GlossaryItem>
          <GlossaryItem term="Pixel tag">
            Imagem transparente de 1×1 pixel inserida em páginas ou e-mails para rastrear
            visualizações, acessos e interações dos usuários.
          </GlossaryItem>
        </div>
      </SectionBlock>

      <SectionBlock id="ck-03" number={3} title="Considerações sobre Cookies">
        <p>Os cookies podem ser classificados quanto à <T>duração</T>:</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[#d4af37] font-bold text-[13px] uppercase tracking-wider mb-2">Cookies de Sessão</p>
            <p className="text-[13px] text-white/55 leading-relaxed">
              Temporários, são excluídos automaticamente quando o navegador é fechado.
              Utilizados para manter a sessão ativa durante a navegação.
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[#d4af37] font-bold text-[13px] uppercase tracking-wider mb-2">Cookies Persistentes</p>
            <p className="text-[13px] text-white/55 leading-relaxed">
              Permanecem no dispositivo após o fechamento do navegador, por período
              pré-determinado. Utilizados para lembrar preferências e autenticação.
            </p>
          </div>
        </div>
        <p className="mt-4">
          Você pode configurar seu navegador para recusar todos os cookies ou indicar
          quando um cookie está sendo enviado. Contudo, algumas funcionalidades da
          Plataforma podem não funcionar corretamente sem cookies essenciais.
        </p>
      </SectionBlock>

      <SectionBlock id="ck-04" number={4} title="Utilização e Finalidades">
        <p>Utilizamos cookies para as seguintes finalidades:</p>
        <div className="mt-4 space-y-3">
          {[
            ['Segurança', 'Autenticação, prevenção a fraudes e proteção da conta do usuário.', true],
            ['Desempenho', 'Análise de tempo de carregamento, erros e performance geral da Plataforma.', true],
            ['Funcionalidade', 'Armazenamento de preferências como idioma, tema e sessão ativa.', true],
            ['Autenticação', 'Manter o usuário logado entre sessões, evitando autenticações repetidas.', true],
            ['Análise', 'Compreender como os usuários navegam pela Plataforma para melhorias de UX.', false],
            ['Publicidade', 'Exibir anúncios relevantes com base no perfil e comportamento do usuário.', false],
          ].map(([t, d, essential]) => (
            <div key={String(t)} className="flex gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="shrink-0 pt-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${essential ? 'text-green-400/80 border-green-500/20 bg-green-500/5' : 'text-white/30 border-white/10'}`}>
                  {essential ? 'Essencial' : 'Opcional'}
                </span>
              </div>
              <div>
                <p className="text-[#d4af37]/80 font-semibold text-[13px]">{String(t)}</p>
                <p className="text-white/55 text-[13px] mt-0.5">{String(d)}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock id="ck-05" number={5} title="Cookies de Terceiros">
        <p>
          A Plataforma pode utilizar cookies de terceiros para fins analíticos e
          publicitários. Esses cookies são controlados pelos respectivos terceiros e
          estão sujeitos às suas próprias políticas de privacidade.
        </p>
        <p>
          Para cookies de publicidade, você pode gerenciar suas preferências por meio
          do programa <T>YourAdChoices</T>, disponível em{' '}
          <a
            href="https://youradchoices.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors inline-flex items-center gap-1"
          >
            youradchoices.com <ExternalLink className="w-3 h-3" />
          </a>, que permite o <T>opt-out</T> de publicidade comportamental de múltiplos
          parceiros simultaneamente.
        </p>
        <InfoBox>
          O opt-out de cookies de terceiros não impede que você veja anúncios, mas
          fará com que eles não sejam personalizados com base no seu comportamento.
        </InfoBox>
      </SectionBlock>

      <SectionBlock id="ck-06" number={6} title="Tecnologias de Rastreamento">
        <p>Além de cookies, utilizamos outras tecnologias de rastreamento:</p>
        <div className="mt-3 space-y-3">
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-[#d4af37]/80 font-bold text-[13px] mb-1.5">Web Beacons (Pixel Tags)</p>
            <p className="text-[13px] text-white/55 leading-relaxed">
              Imagens de 1×1 pixel inseridas em e-mails e páginas para confirmar visualizações,
              verificar a entrega de comunicações e medir a eficácia de campanhas.
            </p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-[#d4af37]/80 font-bold text-[13px] mb-1.5">URLs de Click-Through</p>
            <p className="text-[13px] text-white/55 leading-relaxed">
              Links especiais em e-mails e comunicações que nos permitem identificar
              qual conteúdo gerou interesse, para medir o engajamento das campanhas enviadas.
            </p>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="ck-07" number={7} title="Alterações da Política">
        <p>
          Esta Política de Cookies pode ser atualizada para refletir mudanças em nossas
          práticas ou na legislação. Alterações significativas serão comunicadas por meio
          de aviso na Plataforma.
        </p>
        <p>
          A data da última atualização é exibida no topo desta página.
          Recomendamos a revisão periódica deste documento.
        </p>
      </SectionBlock>

      <SectionBlock id="ck-08" number={8} title="Disposições Gerais">
        <p>
          Esta Política de Cookies integra os documentos jurídicos da Plataforma Espaço Mix,
          em conjunto com a{' '}
          <button onClick={() => onTab('privacy')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            Política de Privacidade
          </button>{' '}e os{' '}
          <button onClick={() => onTab('terms')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            Termos de Uso
          </button>.
        </p>
        <p>
          Em caso de conflito entre esta Política e a Política de Privacidade,
          prevalecerá a Política de Privacidade.
        </p>
      </SectionBlock>

      <SectionBlock id="ck-09" number={9} title="Legislação e Foro">
        <p>
          Esta Política é regida pelas leis brasileiras, especialmente pela{' '}
          <T>LGPD (Lei nº 13.709/2018)</T> e pelo{' '}
          <T>Marco Civil da Internet (Lei nº 12.965/2014)</T>.
        </p>
        <p>
          {ld.legalCity
            ? <>Fica eleito o <T>Foro da Comarca de {ld.legalCity}</T> para dirimir
                quaisquer controvérsias oriundas desta Política.</>
            : <>Fica eleito o foro do domicílio do consumidor para dirimir
                quaisquer controvérsias oriundas desta Política.</>}
        </p>
      </SectionBlock>

      <SectionBlock id="ck-10" number={10} title="Contato">
        <p>
          Para dúvidas ou solicitações relacionadas a cookies, entre em contato com
          nosso canal de privacidade:
        </p>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-2 text-[14px] mt-3">
          <p>
            <T>E-mail:</T>{' '}
            <a href={`mailto:${ld.dpoEmail}`} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
              {ld.dpoEmail}
            </a>
          </p>
        </div>
      </SectionBlock>
    </>
  );
}

// ─── Conteúdo: TERMOS DE USO ─────────────────────────────────────────────────
function TermsSections({ onTab, ld }: { onTab: (t: TabId) => void; ld: LegalData }) {
  return (
    <>
      <SectionBlock id="tu-01" number={1} title="Introdução">
        <p>
          Os presentes <T>Termos de Uso</T> regulam a utilização da plataforma{' '}
          <T>Espaço Mix</T>, operada pela <T>{ld.companyName}</T>{ld.cnpj ? <>, CNPJ nº {ld.cnpj}</> : null},
          e estabelecem os direitos e obrigações dos usuários
          e da empresa no contexto da comercialização de ingressos para eventos.
        </p>
        <p>
          Ao criar uma conta ou adquirir ingressos na Plataforma, o usuário declara ter
          lido, compreendido e concordado integralmente com estes Termos. A utilização
          dos serviços sem concordância expressa é vedada.
        </p>
        <InfoBox>
          Estes Termos integram os documentos jurídicos da Plataforma, ao lado da{' '}
          <button onClick={() => onTab('privacy')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            Política de Privacidade
          </button>{' '}e da{' '}
          <button onClick={() => onTab('cookies')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors">
            Política de Cookies
          </button>.
        </InfoBox>
      </SectionBlock>

      <SectionBlock id="tu-02" number={2} title="Glossário">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <GlossaryItem term="Plataforma">O sistema digital Espaço Mix, acessível via navegador ou aplicativo móvel.</GlossaryItem>
          <GlossaryItem term="Conta">Cadastro individual do usuário que permite acesso às funcionalidades da Plataforma.</GlossaryItem>
          <GlossaryItem term="Consumidor">Pessoa natural que adquire ingressos para eventos disponíveis na Plataforma.</GlossaryItem>
          <GlossaryItem term="Organizador">Pessoa física ou jurídica responsável pela criação, divulgação e realização de eventos.</GlossaryItem>
          <GlossaryItem term="Participante">Titular do ingresso para um evento específico, que pode ou não ser o Consumidor.</GlossaryItem>
          <GlossaryItem term="Usuário">Toda pessoa que acessa ou utiliza a Plataforma, independentemente de ter efetuado compras.</GlossaryItem>
          <GlossaryItem term="E-ticket">Ingresso eletrônico emitido pela Plataforma, contendo QR Code único para acesso ao evento.</GlossaryItem>
          <GlossaryItem term="Anti-spam">Conjunto de práticas que proíbem o envio não solicitado de mensagens em massa.</GlossaryItem>
          <GlossaryItem term="Chargeback">Contestação de cobrança pelo titular do cartão junto à operadora, com solicitação de estorno.</GlossaryItem>
          <GlossaryItem term="Estorno">Devolução de valores pagos ao consumidor, conforme condições previstas nestes Termos.</GlossaryItem>
          <GlossaryItem term="Link">Referência eletrônica que direciona o usuário a outra página ou recurso da Internet.</GlossaryItem>
        </div>
      </SectionBlock>

      <SectionBlock id="tu-03" number={3} title="Informações Gerais">
        <p>
          A Plataforma Espaço Mix é um sistema de <T>comercialização de ingressos</T> para
          eventos culturais, festivos e de entretenimento. A {ld.companyName} atua como
          intermediária entre Organizadores e Consumidores, não sendo responsável pelo
          conteúdo, qualidade ou realização dos eventos.
        </p>
        <p>
          Os serviços disponíveis na Plataforma incluem: compra e emissão de ingressos,
          gestão de reservas, transferência de titularidade e comunicações sobre eventos.
        </p>
        <p>
          A {ld.companyName} se reserva o direito de alterar, suspender ou encerrar qualquer
          funcionalidade da Plataforma a qualquer tempo, sem obrigação de aviso prévio,
          salvo quando exigido por lei.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-04" number={4} title="Cadastro de Usuários">
        <p>
          Para adquirir ingressos na Plataforma, o usuário deve criar uma{' '}
          <T>conta pessoal e intransferível</T>, fornecendo informações verídicas,
          completas e atualizadas.
        </p>
        <p>São requisitos para o cadastro:</p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Ser maior de 18 anos ou emancipado legalmente;',
            'Possuir CPF válido, que poderá ser exigido para confirmação de identidade;',
            'Fornecer e-mail ativo para comunicações sobre compras e eventos;',
            'Criar senha segura e mantê-la em sigilo, sendo responsável por qualquer uso da conta;',
            'Não criar múltiplas contas para burlar limites de compra por CPF.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          A {ld.companyName} pode, a seu exclusivo critério, recusar, suspender ou cancelar
          contas que violem estes Termos ou que apresentem suspeita de fraude.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-05" number={5} title="Acesso à Plataforma">
        <p>
          O acesso à Plataforma requer conexão com a internet e dispositivo compatível.
          A {ld.companyName} não garante disponibilidade ininterrupta dos serviços, podendo
          ocorrer interrupções para manutenção, atualizações ou por força maior.
        </p>
        <p>
          É vedado ao usuário qualquer tentativa de acesso não autorizado, engenharia
          reversa, scraping ou qualquer ação que comprometa a segurança ou integridade
          da Plataforma.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-06" number={6} title="Responsabilidades dos Consumidores">
        <p>O consumidor é responsável por:</p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Verificar as informações do evento (data, local, horário, classificação etária) antes da compra;',
            'Apresentar o e-ticket válido (QR Code) no acesso ao evento;',
            'Não reproduzir, falsificar ou compartilhar indevidamente o e-ticket;',
            'Manter seus dados cadastrais atualizados;',
            'Respeitar os limites de compra por CPF estabelecidos para cada evento;',
            'Não realizar revenda de ingressos em desacordo com as condições do evento.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="tu-07" number={7} title="Entrega e Utilização de Ingressos (E-tickets)">
        <p>
          Os ingressos são emitidos exclusivamente no formato <T>e-ticket eletrônico</T>,
          contendo QR Code único e intransferível. Após a confirmação do pagamento, o
          e-ticket é disponibilizado na conta do usuário e enviado ao e-mail cadastrado.
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Cada QR Code é válido para uma única utilização no evento;',
            'O compartilhamento do QR Code pode resultar no impedimento de acesso;',
            'Em caso de perda ou não recebimento, o ingresso pode ser reacessado na área do usuário;',
            'Ingressos adquiridos são vinculados ao CPF do comprador para fins de autenticidade.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="tu-08" number={8} title="Vendas de Ingressos">
        <p>
          As vendas são processadas pela Plataforma em nome dos Organizadores.
          Os preços exibidos incluem as taxas de serviço aplicáveis, que serão
          discriminadas antes da confirmação da compra.
        </p>
        <p>
          O pagamento pode ser realizado pelos métodos disponíveis na Plataforma
          (PIX, cartão de crédito, débito e outros). A confirmação da compra está
          sujeita à aprovação do meio de pagamento utilizado.
        </p>
        <p>
          A {ld.companyName} não se responsabiliza por falhas nos sistemas de pagamento
          de terceiros (operadoras de cartão, bancos) que impeçam a conclusão da compra.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-09" number={9} title="Cancelamento e Reembolso">
        <p>
          O consumidor tem direito ao <T>cancelamento imotivado</T> da compra no prazo
          de até <T>7 (sete) dias corridos</T> a partir da data da transação, conforme
          o Art. 49 do Código de Defesa do Consumidor, desde que o evento ainda não
          tenha ocorrido.
        </p>
        <p>
          Após o prazo de arrependimento, cancelamentos somente serão aceitos mediante
          solicitação <T>até 48 horas antes</T> do horário do evento, sujeito às
          condições específicas definidas pelo Organizador.
        </p>
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-[#d4af37]/80 font-bold text-[13px] mb-1.5">Prazo de Reembolso</p>
            <p className="text-[13px] text-white/55">O estorno será processado em até 10 dias úteis, conforme o meio de pagamento utilizado. Para PIX e débito, o prazo pode ser inferior.</p>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-[#d4af37]/80 font-bold text-[13px] mb-1.5">Taxa de Cancelamento</p>
            <p className="text-[13px] text-white/55">Poderá ser aplicada taxa de cancelamento conforme definido nas condições de cada evento. O valor será informado antes da confirmação do cancelamento.</p>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="tu-10" number={10} title="Transferência de Titularidade">
        <p>
          A transferência de ingresso para terceiros é permitida pela Plataforma,
          observadas as seguintes condições:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'A transferência deve ser realizada por meio dos recursos da própria Plataforma;',
            'O beneficiário da transferência deve possuir cadastro ativo na Plataforma;',
            'A transferência deve ser concluída antes do prazo definido pelo Organizador;',
            `A ${ld.companyName} não se responsabiliza por transferências realizadas fora da Plataforma.`,
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="tu-11" number={11} title="Contestações e Estornos">
        <p>
          O <T>chargeback</T> (contestação junto à operadora do cartão) deve ser
          precedido de comunicação à {ld.companyName}, que tomará as medidas necessárias
          para solucionar a questão diretamente com o consumidor.
        </p>
        <p>
          Chargebacks indevidos ou fraudulentos poderão resultar no cancelamento da
          conta, bloqueio de compras futuras e adoção de medidas legais cabíveis.
          Registros de acesso e compras são mantidos como evidência nos termos da lei.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-12" number={12} title="Taxas Aplicáveis">
        <p>
          A {ld.companyName} pode cobrar <T>taxa de serviço</T> sobre as transações realizadas
          na Plataforma. O valor da taxa, quando aplicável, será exibido de forma clara
          e discriminada durante o processo de compra, antes da confirmação.
        </p>
        <p>
          O Organizador pode optar por absorver as taxas (não repassando ao consumidor)
          ou por repassá-las, situação em que serão devidamente informadas na página
          do evento e no checkout.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-13" number={13} title="Propriedade Intelectual">
        <p>
          Todo o conteúdo da Plataforma — incluindo marca, logotipos, layout, textos,
          imagens, software e demais elementos — é de propriedade exclusiva da
          {ld.companyName} ou licenciado a ela, sendo protegido pela legislação de
          propriedade intelectual.
        </p>
        <p>
          É vedada a reprodução, distribuição, modificação ou uso comercial de qualquer
          elemento da Plataforma sem autorização prévia e expressa da {ld.companyName}.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-14" number={14} title="Segurança da Plataforma">
        <p>
          A {ld.companyName} adota medidas técnicas e organizacionais para proteger a
          integridade e disponibilidade da Plataforma. É vedado ao usuário qualquer
          tentativa de:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Acesso não autorizado a sistemas, servidores ou bancos de dados;',
            'Inserção de vírus, malware ou qualquer código malicioso;',
            'Ataques de negação de serviço (DDoS) ou similares;',
            'Captura automatizada de dados (scraping, bots) sem autorização;',
            'Interferência no funcionamento normal da Plataforma.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock id="tu-15" number={15} title="Privacidade dos Usuários">
        <p>
          O tratamento de dados pessoais na Plataforma é regido pela nossa{' '}
          <button onClick={() => onTab('privacy')} className="text-[#d4af37]/80 hover:text-[#d4af37] underline transition-colors font-medium">
            Política de Privacidade
          </button>, que integra estes Termos.
          Recomendamos sua leitura completa para compreender como seus dados são
          coletados, utilizados e protegidos.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-16" number={16} title="Proteção de Registros">
        <p>
          Em conformidade com o <T>Art. 15 do Marco Civil da Internet (Lei nº 12.965/2014)</T>,
          a {ld.companyName} mantém registros de acesso à aplicação pelo prazo de{' '}
          <T>6 (seis) meses</T>, podendo ser estendido mediante ordem judicial ou
          requerimento de autoridade competente.
        </p>
        <p>
          Registros de transações comerciais são mantidos pelo prazo exigido pela
          legislação fiscal e consumerista aplicável.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-17" number={17} title="Limitação de Responsabilidade">
        <p>
          A {ld.companyName} não se responsabiliza por:
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            'Cancelamento, alteração ou não realização de eventos pelos Organizadores;',
            'Qualidade, segurança ou adequação dos eventos anunciados na Plataforma;',
            'Danos decorrentes de uso indevido da conta pelo próprio usuário;',
            'Falhas em redes de telecomunicação ou sistemas de terceiros;',
            'Interrupções de serviço por caso fortuito ou força maior.',
          ].map(item => (
            <li key={item} className="flex gap-2 text-[14px]">
              <span className="text-[#d4af37]/40 shrink-0 mt-1.5">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Em qualquer hipótese, a responsabilidade da {ld.companyName} limita-se ao valor
          pago pelo usuário na transação que originou o dano.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-18" number={18} title="Disposições Finais">
        <p>
          A tolerância da {ld.companyName} quanto ao descumprimento de qualquer disposição
          destes Termos não constituirá renúncia ou novação. Se qualquer disposição
          for considerada inválida ou inaplicável, as demais permanecerão vigentes.
        </p>
        <p>
          A {ld.companyName} poderá atualizar estes Termos a qualquer tempo, mediante aviso
          prévio aos usuários. A continuidade do uso da Plataforma após as alterações
          constitui aceitação das novas condições.
        </p>
      </SectionBlock>

      <SectionBlock id="tu-19" number={19} title="Foro Aplicável">
        <p>
          Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil,
          em especial pelo <T>Código de Defesa do Consumidor (Lei nº 8.078/1990)</T>,
          pelo <T>Marco Civil da Internet (Lei nº 12.965/2014)</T> e pela{' '}
          <T>LGPD (Lei nº 13.709/2018)</T>.
        </p>
        <p>
          {ld.legalCity
            ? <>Fica eleito o <T>Foro da Comarca de {ld.legalCity}</T>, com exclusão de
                qualquer outro, por mais privilegiado que seja, para dirimir quaisquer
                controvérsias oriundas destes Termos ou da utilização da Plataforma.</>
            : <>Fica eleito o foro do domicílio do consumidor para dirimir quaisquer
                controvérsias oriundas destes Termos ou da utilização da Plataforma.</>}
        </p>
      </SectionBlock>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const TAB_META: Record<TabId, { label: string; icon: React.ReactNode; updated: string }> = {
  privacy: {
    label: 'Política de Privacidade',
    icon: <Shield className="w-4 h-4" />,
    updated: '28 de maio de 2026',
  },
  cookies: {
    label: 'Política de Cookies',
    icon: <Cookie className="w-4 h-4" />,
    updated: '28 de maio de 2026',
  },
  terms: {
    label: 'Termos de Uso',
    icon: <FileText className="w-4 h-4" />,
    updated: '28 de maio de 2026',
  },
};

export function LegalView({ initialTab = 'privacy' }: LegalViewProps) {
  const { setCurrentView } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [activeSection, setActiveSection] = useState<string>('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [legalData, setLegalData] = useState<LegalData>(buildLegalData({}));

  useEffect(() => {
    getSystemConfig().then(c => setLegalData(buildLegalData(c))).catch(() => {});
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
    setActiveSection('');
    window.scrollTo({ top: 0 });
  }, [initialTab]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveSection('');
  }, [activeTab]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    );
    const els = document.querySelectorAll('[data-section]');
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTab]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const meta = TAB_META[activeTab];
  const sidebarItems = SIDEBAR[activeTab];

  return (
    <div className="min-h-screen bg-[#111111] text-white">

      {/* ── Cabeçalho fixo ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-md border-b border-white/[0.06]">

        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center gap-2 text-[11px] text-white/30">
          <button
            onClick={() => setCurrentView('home')}
            className="hover:text-white/60 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" /> Início
          </button>
          <span className="text-white/15">›</span>
          <span className="text-white/50 uppercase tracking-wider">Termos e Políticas</span>
          <span className="text-white/15">›</span>
          <span className="text-[#d4af37]/60 uppercase tracking-wider">{meta.label}</span>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-0">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {(Object.entries(TAB_META) as [TabId, typeof meta][]).map(([id, m]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all duration-200 ${
                  activeTab === id
                    ? 'border-[#d4af37] text-[#d4af37]'
                    : 'border-transparent text-white/35 hover:text-white/60 hover:border-white/20'
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Layout principal ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="flex gap-10">

          {/* Sidebar — oculto em mobile */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-32">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-bold mb-4">
                Índice
              </p>
              <nav className="space-y-0.5">
                {sidebarItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left text-[11px] px-3 py-2 rounded-lg transition-all duration-150 leading-snug ${
                      activeSection === item.id
                        ? 'bg-[#d4af37]/10 text-[#d4af37] font-semibold'
                        : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Conteúdo principal */}
          <main className="flex-1 min-w-0">

            {/* Título da política + data */}
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center text-[#d4af37] shrink-0">
                  {meta.icon}
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{meta.label}</h1>
              </div>
              <span className="text-[10px] text-white/25 uppercase tracking-wider whitespace-nowrap mt-1">
                Última atualização: {meta.updated}
              </span>
            </div>

            {/* Índice mobile */}
            <details className="lg:hidden mb-8 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <summary className="px-4 py-3 text-[11px] uppercase tracking-wider text-white/40 cursor-pointer select-none font-bold">
                Índice de seções
              </summary>
              <div className="px-4 pb-4 grid grid-cols-2 gap-1">
                {sidebarItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-left text-[11px] text-white/40 hover:text-[#d4af37] transition-colors py-1 px-2"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </details>

            {/* Conteúdo das seções */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'privacy' && <PrivacySections onTab={setActiveTab} ld={legalData} />}
                {activeTab === 'cookies' && <CookiesSections onTab={setActiveTab} ld={legalData} />}
                {activeTab === 'terms' && <TermsSections onTab={setActiveTab} ld={legalData} />}
              </motion.div>
            </AnimatePresence>

            {/* Rodapé interno */}
            <div className="mt-14 pt-8 border-t border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 mb-4 font-bold">
                Documentos relacionados
              </p>
              <div className="flex flex-wrap gap-3">
                {(Object.entries(TAB_META) as [TabId, typeof meta][])
                  .filter(([id]) => id !== activeTab)
                  .map(([id, m]) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-full text-[11px] text-white/40 hover:text-[#d4af37] hover:border-[#d4af37]/30 transition-all duration-200 uppercase tracking-wider"
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
              </div>
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-white/25">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-[#d4af37]/40" />
                  <span>LGPD — Lei nº 13.709/2018</span>
                </div>
                <a
                  href={legalData.dpoEmail !== PLACEHOLDER ? `mailto:${legalData.dpoEmail}` : undefined}
                  className="text-[#d4af37]/50 hover:text-[#d4af37] transition-colors"
                >
                  {legalData.dpoEmail}
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── Botão Voltar ao topo ───────────────────────────────────────── */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-10 h-10 bg-[#d4af37] text-[#111111] rounded-full flex items-center justify-center shadow-lg hover:bg-[#d4af37]/90 transition-colors"
            aria-label="Voltar ao topo"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
