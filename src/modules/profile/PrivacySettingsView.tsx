import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Shield, Cookie, BarChart3, Megaphone, Lock,
  Trash2, Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DeleteAccountModal } from './DeleteAccountModal';
import type { ConsentData } from '../../types';

const CONSENT_VERSION = '2026-05-26';

const CATEGORIES = [
  {
    key: 'essential' as const,
    icon: Lock,
    title: 'Essenciais',
    description: 'Login, autenticação e compra de ingressos.',
    locked: true,
    color: 'text-green-400',
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
  },
  {
    key: 'functional' as const,
    icon: Cookie,
    title: 'Funcionais',
    description: 'Carrinho de compras e preferências de sessão.',
    locked: false,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
  {
    key: 'analytics' as const,
    icon: BarChart3,
    title: 'Analytics',
    description: 'Dados de uso anonimizados para melhorias.',
    locked: false,
    color: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
  },
  {
    key: 'marketing' as const,
    icon: Megaphone,
    title: 'Marketing',
    description: 'Comunicações e notificações de eventos.',
    locked: false,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
] as const;

export function PrivacySettingsView() {
  const {
    consentData, saveConsent,
    sessionUser,
    setCurrentView,
    showToast,
  } = useApp();

  const [editingConsent, setEditingConsent] = useState(false);
  const [localPrefs, setLocalPrefs] = useState({
    functional: consentData?.functional ?? false,
    analytics: consentData?.analytics ?? false,
    marketing: consentData?.marketing ?? false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSaveConsent = () => {
    saveConsent({
      essential: true,
      ...localPrefs,
      grantedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    });
    setEditingConsent(false);
    showToast('Preferências de privacidade atualizadas.', 'success');
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

        {/* Header */}
        <button
          onClick={() => setCurrentView('profile')}
          className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80 transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Perfil
        </button>

        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#d4af37]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-white">Privacidade & Dados</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/30">Gerenciar consentimentos e dados pessoais</p>
          </div>
        </div>

        {/* Seção: Consentimentos */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#d4af37]">Consentimentos</h2>
            {!editingConsent ? (
              <button
                onClick={() => {
                  setLocalPrefs({
                    functional: consentData?.functional ?? false,
                    analytics: consentData?.analytics ?? false,
                    marketing: consentData?.marketing ?? false,
                  });
                  setEditingConsent(true);
                }}
                className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition border border-white/10 rounded-full px-3 py-1"
              >
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingConsent(false)}
                  className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition border border-white/10 rounded-full px-3 py-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConsent}
                  className="text-[10px] uppercase tracking-widest text-black bg-[#d4af37] hover:brightness-110 transition rounded-full px-3 py-1 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Salvar
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isOn = cat.locked || (editingConsent
                ? localPrefs[cat.key as 'functional' | 'analytics' | 'marketing']
                : consentData?.[cat.key as 'functional' | 'analytics' | 'marketing']);

              return (
                <div key={cat.key} className={`flex items-center gap-3 p-4 rounded-xl border ${cat.border} ${cat.bg}`}>
                  <Icon className={`w-4 h-4 ${cat.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white/80">{cat.title}</p>
                    <p className="text-[10px] text-white/40">{cat.description}</p>
                  </div>
                  {editingConsent && !cat.locked ? (
                    <button
                      onClick={() => setLocalPrefs(p => ({ ...p, [cat.key]: !p[cat.key as 'functional' | 'analytics' | 'marketing'] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        localPrefs[cat.key as 'functional' | 'analytics' | 'marketing'] ? 'bg-[#d4af37]' : 'bg-white/10'
                      }`}
                    >
                      <motion.span
                        animate={{ x: localPrefs[cat.key as 'functional' | 'analytics' | 'marketing'] ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm block"
                      />
                    </button>
                  ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isOn ? 'text-green-400' : 'text-white/20'}`}>
                      {cat.locked ? 'Obrigatório' : isOn ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {consentData && (
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-white/25">
              <span>Consentimento concedido em: <strong className="text-white/40">{formatDate(consentData.grantedAt)}</strong></span>
              <span>Versão da política: <strong className="text-white/40">{consentData.version}</strong></span>
            </div>
          )}
        </section>

        {/* Seção: Excluir Conta */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-red-400/70 mb-4">Zona de Risco</h2>

          <div className="bg-red-500/[0.03] border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Trash2 className="w-4 h-4 text-red-400/60 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-white/70 mb-1">Excluir Minha Conta</p>
                <p className="text-[10px] text-white/40 leading-relaxed mb-4">
                  Esta ação é <strong className="text-red-400/70">irreversível</strong>. Sua conta, dados de perfil e histórico de compras serão removidos. Dados obrigatórios por lei (ex: registros fiscais) são mantidos pelo prazo exigido.
                </p>
                {sessionUser ? (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-red-500/30 text-red-400/70 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir Conta
                  </button>
                ) : (
                  <p className="text-[10px] text-white/30">Faça login para excluir sua conta.</p>
                )}
              </div>
            </div>
          </div>
        </section>

      </motion.div>

      <DeleteAccountModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  );
}
