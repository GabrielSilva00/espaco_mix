import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Shield, Cookie, BarChart3, Megaphone, Lock,
  Download, Trash2, Check, AlertTriangle, X, RefreshCw, Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
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
    sessionUser, loggedInUserId,
    reservations,
    handleLogout,
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
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);

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

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        platform: 'Espaço Mix Eventos',
        user: {
          id: sessionUser?.id,
          name: sessionUser?.name,
          email: sessionUser?.email,
          role: sessionUser?.role,
        },
        consent: consentData,
        reservations: reservations.map(r => ({
          id: r.id,
          date: r.date,
          total: r.total,
          paymentStatus: r.paymentStatus,
          paymentMethod: r.paymentMethod,
          eventId: r.eventId,
          tables: r.tables,
          singleTickets: r.singleTickets,
          tickets: r.ticketsObj?.map(t => ({
            id: t.id,
            name: t.name,
            ownerName: t.ownerName,
            ownerCpf: t.ownerCpf,
            status: t.status,
          })),
        })),
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-espacomix-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Seus dados foram exportados com sucesso.', 'success');
    } catch {
      showToast('Erro ao exportar dados. Tente novamente.', 'error');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail.trim().toLowerCase() !== sessionUser?.email?.toLowerCase()) {
      showToast('O e-mail informado não corresponde à sua conta.', 'error');
      return;
    }
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao excluir conta.');
      }

      // Limpar dados locais
      localStorage.removeItem('lgpd-consent-v2');
      localStorage.removeItem('lgpd-consent');
      localStorage.removeItem('eventix-session');
      localStorage.removeItem('eventix_developer_config');

      showToast('Conta excluída com sucesso. Até logo!', 'info');
      await handleLogout();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir conta. Contate o suporte.', 'error');
      setDeletingAccount(false);
    }
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

        {/* Seção: Meus Dados */}
        <section className="mb-8">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#d4af37] mb-4">Meus Dados</h2>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Eye className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-white/70 mb-0.5">Dados que armazenamos sobre você</p>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Nome, e-mail, CPF (quando informado), telefone, data de nascimento, histórico de reservas, preferências e logs de acesso.
                  Consulte nossa{' '}
                  <button onClick={() => setCurrentView('privacy')} className="text-[#d4af37]/70 underline">Política de Privacidade</button>
                  {' '}para detalhes completos.
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-white/70">Exportar Meus Dados</p>
                <p className="text-[10px] text-white/30">Baixar todos os seus dados em formato JSON (LGPD, Art. 18, V)</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exportingData}
                className="flex items-center gap-2 px-4 py-2 border border-[#d4af37]/30 text-[#d4af37]/70 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#d4af37]/5 transition disabled:opacity-40"
              >
                {exportingData ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Exportar
              </button>
            </div>
          </div>
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

      {/* Modal de confirmação de exclusão */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f0f] border border-red-500/30 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
                </div>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmEmail(''); }} className="text-white/30 hover:text-white/70 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-white/60 leading-relaxed mb-5">
                Para confirmar, digite o e-mail da sua conta:{' '}
                <strong className="text-white/80">{sessionUser?.email}</strong>
              </p>

              <input
                type="email"
                value={deleteConfirmEmail}
                onChange={e => setDeleteConfirmEmail(e.target.value)}
                placeholder="Seu e-mail de acesso"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmEmail(''); }}
                  className="flex-1 py-3 border border-white/10 text-white/40 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || !deleteConfirmEmail.trim()}
                  className="flex-1 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {deletingAccount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deletingAccount ? 'Excluindo...' : 'Excluir Conta'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
