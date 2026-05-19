import React, { useState, useEffect } from 'react';
import {
  Code2, ToggleLeft, ToggleRight, Settings, Palette,
  CreditCard, Globe, RotateCcw, Save, AlertTriangle, Check,
  ChevronDown, ChevronUp, Server, ShieldCheck
} from 'lucide-react';
import {
  loadDeveloperConfig,
  saveDeveloperConfig,
  resetDeveloperConfig,
} from '../services/developerConfig';
import type { DeveloperConfig, FeatureFlags, AdminModules } from '../types/developer';
import { useApp } from '../context/AppContext';

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

interface InputRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function InputRow({ label, value, onChange, type = 'text', placeholder }: InputRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs text-white normal-case tracking-normal font-normal focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20"
      />
    </div>
  );
}

export function DeveloperPanel() {
  const { setDeveloperConfig } = useApp();
  const [config, setConfig] = useState<DeveloperConfig>(loadDeveloperConfig);
  const [saved, setSaved] = useState(false);

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
    if (!confirm('Resetar todas as configurações para o padrão?')) return;
    const reset = resetDeveloperConfig();
    setConfig(reset);
    setDeveloperConfig(reset);
    setSaved(false);
  };

  const featureLabels: Record<keyof FeatureFlags, { label: string; description: string; danger?: boolean }> = {
    enableReports: { label: 'Relatórios Financeiros', description: 'Ativa a seção de relatórios no dashboard' },
    enableProducerOnboarding: { label: 'Onboarding de Produtor', description: 'Permite fluxo de cadastro de novos produtores' },
    enableBetaFeatures: { label: 'Features Beta', description: 'Funcionalidades em fase de teste' },
    enableV2Features: { label: 'Features v2', description: 'Próxima geração de funcionalidades' },
    maintenanceMode: { label: 'Modo Manutenção', description: 'Exibe aviso de manutenção para usuários', danger: true },
  };

  const moduleLabels: Record<keyof AdminModules, { label: string; description: string }> = {
    approvals_kyc: { label: 'Aprovações KYC', description: 'Permite ao admin visualizar e aprovar produtores' },
    reports: { label: 'Relatórios Financeiros', description: 'Seção de relatórios e exportações no menu lateral' },
    integrations: { label: 'Integrações', description: 'Configurações de integrações externas' },
    notifications: { label: 'Notificações', description: 'Módulo de notificações e alertas' },
    support: { label: 'Suporte ao Produtor', description: 'Canal de suporte interno para produtores' },
  };

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
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-40 mt-1">Configurações avançadas de sistema</p>
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

        {/* Admin Modules */}
        <Section title="Módulos do Admin" icon={<ShieldCheck className="w-4 h-4" />}>
          <p className="text-[10px] text-white/30 normal-case tracking-normal font-normal mb-2">
            Controla quais módulos ficam visíveis no menu lateral para administradores. Por padrão todos estão desabilitados.
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

        {/* Site Settings */}
        <Section title="Configurações do Site" icon={<Settings className="w-4 h-4" />}>
          <InputRow
            label="Nome da Plataforma"
            value={config.siteSettings.platformName}
            onChange={v => update('siteSettings', { platformName: v })}
            placeholder="Eventix"
          />
          <InputRow
            label="E-mail de Suporte"
            value={config.siteSettings.supportEmail}
            onChange={v => update('siteSettings', { supportEmail: v })}
            type="email"
            placeholder="suporte@eventix.com"
          />
          <InputRow
            label="WhatsApp (com DDI)"
            value={config.siteSettings.whatsappNumber}
            onChange={v => update('siteSettings', { whatsappNumber: v })}
            placeholder="5511999999999"
          />
        </Section>

        {/* Theme */}
        <Section title="Tema e Cores" icon={<Palette className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Cor Primária</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.theme.primaryColor}
                  onChange={e => update('theme', { primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-white/10 bg-[#1a1a1a] cursor-pointer"
                />
                <span className="text-xs text-white/60 normal-case font-normal tracking-normal">{config.theme.primaryColor}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Cor de Destaque</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.theme.accentColor}
                  onChange={e => update('theme', { accentColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-white/10 bg-[#1a1a1a] cursor-pointer"
                />
                <span className="text-xs text-white/60 normal-case font-normal tracking-normal">{config.theme.accentColor}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 p-3 rounded-xl bg-[#1a1a1a] border border-white/5">
            <span className="text-[10px] text-white/30 normal-case tracking-normal font-normal">
              Prévia das cores — as alterações são aplicadas localmente via localStorage e servem como referência de tema.
            </span>
          </div>
        </Section>

        {/* Payment */}
        <Section title="Pagamentos" icon={<CreditCard className="w-4 h-4" />}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Provedor</label>
            <select
              value={config.payment.provider}
              onChange={e => update('payment', { provider: e.target.value as 'mock' | 'stripe' | 'mercadopago' })}
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs text-white normal-case tracking-normal font-normal focus:outline-none focus:border-[#d4af37]/50 transition"
            >
              <option value="mock">Mock (Desenvolvimento)</option>
              <option value="stripe">Stripe</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </div>
          <ToggleRow
            label="Mock em Produção"
            description="Permite pagamentos simulados mesmo em ambiente de produção"
            value={config.payment.allowMockInProduction}
            onChange={v => update('payment', { allowMockInProduction: v })}
            danger
          />
          {config.payment.provider !== 'mock' && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300 normal-case tracking-normal font-normal leading-relaxed">
                Configure as chaves de API do provedor selecionado nas variáveis de ambiente do servidor (VITE_PAYMENT_KEY / PAYMENT_PROVIDER).
              </p>
            </div>
          )}
        </Section>

        {/* Env URLs */}
        <Section title="URLs de Ambiente" icon={<Globe className="w-4 h-4" />} defaultOpen={false}>
          <InputRow
            label="URL de Desenvolvimento"
            value={config.envUrls.devUrl}
            onChange={v => update('envUrls', { devUrl: v })}
            placeholder="http://localhost:5173"
          />
          <InputRow
            label="URL de Produção"
            value={config.envUrls.prodUrl}
            onChange={v => update('envUrls', { prodUrl: v })}
            placeholder="https://eventix.com"
          />
        </Section>

        {/* System Info */}
        <Section title="Informações do Sistema" icon={<Server className="w-4 h-4" />} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Ambiente', value: import.meta.env.MODE || 'development' },
              { label: 'Node Env', value: import.meta.env.VITE_NODE_ENV || 'development' },
              { label: 'Supabase Project', value: import.meta.env.VITE_SUPABASE_URL ? 'Configurado' : 'Não configurado' },
              { label: 'Versão da App', value: '1.0.0' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 p-3 rounded-xl bg-[#1a1a1a] border border-white/5">
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">{label}</span>
                <span className="text-xs text-white/70 normal-case tracking-normal font-normal">{value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
