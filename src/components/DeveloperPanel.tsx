import React, { useEffect, useState } from 'react';
import {
  Code2, ToggleLeft, ToggleRight, RotateCcw, Save, Check,
  ChevronDown, ChevronUp, Server, ShieldCheck, LayoutGrid, Info, Globe,
} from 'lucide-react';
import {
  loadDeveloperConfig,
  saveDeveloperConfig,
  resetDeveloperConfig,
} from '../services/developerConfig';
import type { DeveloperConfig, FeatureFlags, AdminModules } from '../types/developer';
import { useApp } from '../context/AppContext';
import { getSystemConfigAdmin, updateSystemConfig } from '../lib/supabase';

declare const __APP_VERSION__: string;

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#1a1a1a] hover:bg-[#222] transition"
      >
        <div className="flex items-center gap-3 text-[#d4af37]">
          {icon}
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="p-5 space-y-4 bg-[#111]">{children}</div>}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}

function ToggleRow({ label, description, value, onChange, danger }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className={`text-xs font-bold uppercase tracking-[0.15em] ${danger ? 'text-red-400' : 'text-white/80'}`}>{label}</span>
        <span className="text-[10px] text-white/30 mt-0.5 normal-case tracking-normal font-normal">{description}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`shrink-0 transition-colors ${value ? (danger ? 'text-red-400' : 'text-[#d4af37]') : 'text-white/20'}`}
        aria-label={`Toggle ${label}`}
      >
        {value ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
      </button>
    </div>
  );
}

export function DeveloperPanel() {
  const { setDeveloperConfig, setSiteConfig } = useApp();
  const [config, setConfig] = useState<DeveloperConfig>(loadDeveloperConfig);
  const [saved, setSaved] = useState(false);

  // Funcionalidades globais persistidas no banco (system_config) — valem para
  // TODOS os clientes, diferente das feature flags acima (localStorage local).
  const [allowTransfer, setAllowTransfer] = useState<boolean | null>(null);
  const [savingTransfer, setSavingTransfer] = useState(false);

  useEffect(() => {
    getSystemConfigAdmin()
      .then(cfg => setAllowTransfer(cfg.allow_transfer ?? false))
      .catch(() => setAllowTransfer(false));
  }, []);

  const handleToggleTransfer = async (value: boolean) => {
    setAllowTransfer(value);
    setSavingTransfer(true);
    try {
      await updateSystemConfig({ allow_transfer: value });
      setSiteConfig(prev => ({ ...prev, allowTransfer: value }));
    } catch {
      setAllowTransfer(!value); // reverte em caso de falha
      alert('Não foi possível salvar a configuração de transferência. Tente novamente.');
    } finally {
      setSavingTransfer(false);
    }
  };

  const update = <K extends keyof DeveloperConfig>(section: K, patch: Partial<DeveloperConfig[K]>) => {
    setConfig(prev => ({ ...prev, [section]: { ...prev[section], ...patch } } as DeveloperConfig));
    setSaved(false);
  };

  const handleSave = () => {
    saveDeveloperConfig(config);
    setDeveloperConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (!confirm('Resetar as configurações do desenvolvedor para o padrão?')) return;
    const reset = resetDeveloperConfig();
    setConfig(reset);
    setDeveloperConfig(reset);
    setSaved(false);
  };

  // Apenas flags que o DESENVOLVEDOR controla (não o admin comum).
  const featureLabels: Record<keyof FeatureFlags, { label: string; description: string; danger?: boolean }> = {
    enableReports: { label: 'Relatórios Financeiros', description: 'Libera a página de Relatórios para os organizadores' },
    enableProducerOnboarding: { label: 'Onboarding de Produtor', description: 'Permite o fluxo de cadastro de novos produtores' },
    enableBetaFeatures: { label: 'Features Beta', description: 'Funcionalidades em fase de teste' },
    enableV2Features: { label: 'Features v2', description: 'Próxima geração de funcionalidades' },
    maintenanceMode: { label: 'Modo Manutenção', description: 'Exibe um aviso de manutenção no topo do site para os visitantes', danger: true },
  };

  // Liberar/bloquear o acesso a páginas administrativas específicas.
  const moduleLabels: Record<keyof AdminModules, { label: string; description: string }> = {
    reports: { label: 'Página de Relatórios', description: 'Mostra o item "Relatórios" no menu do admin' },
    approvals_kyc: { label: 'Aprovações / KYC', description: 'Permite ao admin revisar e aprovar produtores' },
    integrations: { label: 'Integrações', description: 'Página de integrações externas' },
    notifications: { label: 'Notificações', description: 'Módulo de notificações e alertas' },
    support: { label: 'Suporte ao Produtor', description: 'Canal de suporte interno para produtores' },
  };

  const sysInfo = [
    { label: 'Ambiente (build)', value: import.meta.env.MODE || 'development' },
    { label: 'Supabase', value: import.meta.env.VITE_SUPABASE_URL ? 'Configurado' : 'Não configurado' },
    { label: 'Versão da App', value: (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—') },
    { label: 'Modo Manutenção', value: config.featureFlags.maintenanceMode ? 'ATIVO' : 'Inativo' },
  ];

  return (
    <div className="space-y-8 px-4 sm:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center">
            <Code2 className="w-6 h-6 text-[#d4af37]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#d4af37]">Painel do Desenvolvedor</h1>
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-40 mt-1">Controles técnicos e feature flags</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Resetar
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 text-[10px] uppercase tracking-widest font-bold rounded-xl transition ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-[#d4af37] text-black hover:brightness-110'
            }`}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* Aviso de escopo */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-400/90 leading-relaxed">
            Estes controles são exclusivos do desenvolvedor. Dados do site, tema e credenciais
            de pagamento são geridos pelo admin (Configurações) e pelas variáveis de ambiente
            da Vercel — por isso não aparecem aqui.
          </p>
        </div>

        {/* Feature Flags */}
        <Section title="Feature Flags" icon={<ToggleRight className="w-4 h-4" />}>
          {(Object.keys(featureLabels) as (keyof FeatureFlags)[]).map(key => (
            <ToggleRow
              key={key}
              label={featureLabels[key].label}
              description={featureLabels[key].description}
              value={config.featureFlags[key]}
              onChange={v => update('featureFlags', { [key]: v })}
              danger={featureLabels[key].danger}
            />
          ))}
        </Section>

        {/* Funcionalidades globais (banco) */}
        <Section title="Funcionalidades Globais" icon={<Globe className="w-4 h-4" />}>
          <p className="text-[10px] text-white/30 normal-case tracking-normal font-normal mb-2">
            Estes ajustes são salvos no banco e valem para TODOS os clientes imediatamente.
          </p>
          <ToggleRow
            label="Transferência de Ingressos"
            description="Exibe o botão 'Transferir' (ingresso e mesa) na página Meus Ingressos para os clientes."
            value={allowTransfer ?? false}
            onChange={v => { if (!savingTransfer && allowTransfer !== null) handleToggleTransfer(v); }}
          />
        </Section>

        {/* Acesso a páginas do admin */}
        <Section title="Acesso a Páginas do Admin" icon={<LayoutGrid className="w-4 h-4" />}>
          <p className="text-[10px] text-white/30 normal-case tracking-normal font-normal mb-2">
            Libere ou bloqueie o acesso do administrador a páginas específicas do painel.
          </p>
          {(Object.keys(moduleLabels) as (keyof AdminModules)[]).map(key => (
            <ToggleRow
              key={key}
              label={moduleLabels[key].label}
              description={moduleLabels[key].description}
              value={config.adminModules[key]}
              onChange={v => update('adminModules', { [key]: v })}
            />
          ))}
        </Section>

        {/* System Info */}
        <Section title="Informações do Sistema" icon={<Server className="w-4 h-4" />} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sysInfo.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 p-3 rounded-xl bg-[#1a1a1a] border border-white/5">
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">{label}</span>
                <span className="text-xs text-white/70 normal-case tracking-normal font-normal flex items-center gap-1.5">
                  {label === 'Modo Manutenção' && value === 'ATIVO' && <ShieldCheck className="w-3 h-3 text-red-400" />}
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
