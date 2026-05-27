import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Cookie, BarChart3, Megaphone, Lock, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ConsentData } from '../../types';

const CONSENT_VERSION = '2026-05-26';

const CATEGORIES = [
  {
    key: 'essential' as const,
    icon: Lock,
    title: 'Essenciais',
    color: 'text-green-400',
    borderColor: 'border-green-500/20',
    bgColor: 'bg-green-500/5',
    locked: true,
    description: 'Necessários para login, compra de ingressos e autenticação segura.',
    examples: 'CPF (antifraude), e-mail (autenticação), token de sessão, registro de consentimento.',
  },
  {
    key: 'functional' as const,
    icon: Cookie,
    title: 'Funcionais',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/5',
    locked: false,
    description: 'Melhoram sua experiência salvando preferências e o carrinho de compras.',
    examples: 'Itens no carrinho, método de pagamento escolhido, preferências de exibição.',
  },
  {
    key: 'analytics' as const,
    icon: BarChart3,
    title: 'Analytics',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/20',
    bgColor: 'bg-purple-500/5',
    locked: false,
    description: 'Nos ajudam a entender como a plataforma é usada para melhorias futuras.',
    examples: 'Páginas visitadas, erros técnicos, tempo de sessão. Dados anonimizados.',
  },
  {
    key: 'marketing' as const,
    icon: Megaphone,
    title: 'Marketing',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/5',
    locked: false,
    description: 'Permitem envio de novidades, ofertas e comunicações sobre eventos.',
    examples: 'Notificações de novos eventos, promoções por e-mail, comunicados da plataforma.',
  },
] as const;

export function ConsentBanner() {
  const { consentData, saveConsent, setCurrentView } = useApp();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({ functional: true, analytics: false, marketing: false });

  if (consentData !== null) return null;

  const buildConsent = (overrides: Partial<typeof prefs>): ConsentData => ({
    essential: true,
    functional: overrides.functional ?? prefs.functional,
    analytics: overrides.analytics ?? prefs.analytics,
    marketing: overrides.marketing ?? prefs.marketing,
    grantedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  });

  const handleAcceptAll = () => saveConsent(buildConsent({ functional: true, analytics: true, marketing: true }));
  const handleEssentialOnly = () => saveConsent(buildConsent({ functional: false, analytics: false, marketing: false }));
  const handleSavePrefs = () => saveConsent(buildConsent(prefs));

  const toggle = (key: 'functional' | 'analytics' | 'marketing') =>
    setPrefs(p => ({ ...p, [key]: !p[key] }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full sm:max-w-lg bg-[#0f0f0f] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-[0_0_80px_rgba(212,175,55,0.08)] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Sua Privacidade Importa</h2>
                <p className="text-[10px] uppercase tracking-widest text-white/40">LGPD — Lei 13.709/2018</p>
              </div>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed mt-3">
              Usamos dados pessoais para possibilitar a compra de ingressos, prevenir fraudes e melhorar a plataforma.
              Escolha quais categorias aceita ou{' '}
              <button
                onClick={() => setCurrentView('privacy')}
                className="text-[#d4af37] underline hover:brightness-110 transition"
              >
                leia nossa política completa
              </button>.
            </p>
          </div>

          {/* Categories — modo configurar */}
          <AnimatePresence>
            {isConfiguring && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isOn = cat.locked || prefs[cat.key as 'functional' | 'analytics' | 'marketing'];
                    const isExpanded = expandedKey === cat.key;
                    return (
                      <div key={cat.key} className={`rounded-xl border ${cat.borderColor} ${cat.bgColor} overflow-hidden`}>
                        <div className="flex items-center gap-3 p-3">
                          <Icon className={`w-4 h-4 ${cat.color} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{cat.title}</p>
                            <p className="text-[10px] text-white/40 leading-tight truncate">{cat.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : cat.key)}
                              className="text-white/30 hover:text-white/70 transition"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => !cat.locked && toggle(cat.key as 'functional' | 'analytics' | 'marketing')}
                              disabled={cat.locked}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                isOn ? 'bg-[#d4af37]' : 'bg-white/10'
                              } ${cat.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <motion.span
                                animate={{ x: isOn ? 20 : 2 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm block"
                              />
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0">
                            <p className="text-[10px] text-white/50 leading-relaxed border-t border-white/5 pt-2">
                              <span className="font-bold text-white/60">Dados incluídos: </span>{cat.examples}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resumo rápido — modo não configurar */}
          {!isConfiguring && (
            <div className="px-6 py-4 grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cat.borderColor} ${cat.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <span className="text-[10px] text-white/60 uppercase tracking-wide">{cat.title}</span>
                    {cat.locked && <Lock className="w-2.5 h-2.5 text-white/20 ml-auto" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ações */}
          <div className="px-6 pb-6 pt-2 space-y-2">
            {isConfiguring ? (
              <button
                onClick={handleSavePrefs}
                className="w-full py-3 bg-[#d4af37] text-black rounded-full text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Salvar Preferências
              </button>
            ) : (
              <button
                onClick={handleAcceptAll}
                className="w-full py-3 bg-[#d4af37] text-black rounded-full text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Aceitar Todos
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleEssentialOnly}
                className="flex-1 py-2.5 border border-white/10 text-white/50 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition"
              >
                Só Essenciais
              </button>
              <button
                onClick={() => setIsConfiguring(v => !v)}
                className="flex-1 py-2.5 border border-[#d4af37]/30 text-[#d4af37]/70 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#d4af37]/5 transition"
              >
                {isConfiguring ? 'Ocultar' : 'Configurar'}
              </button>
            </div>

            <p className="text-[9px] text-white/20 text-center leading-relaxed pt-1">
              Ao prosseguir, você concorda com nossos{' '}
              <button onClick={() => setCurrentView('terms')} className="underline hover:text-white/40 transition">Termos de Uso</button>
              {' '}e{' '}
              <button onClick={() => setCurrentView('privacy')} className="underline hover:text-white/40 transition">Política de Privacidade</button>.
              Você pode alterar suas preferências a qualquer momento em{' '}
              <strong className="text-white/30">Perfil → Privacidade</strong>.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
