import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X, RefreshCw, ShieldAlert, CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';

/**
 * Modal de exclusão de conta (LGPD Art. 18) com as regras inspiradas em
 * plataformas de venda de ingressos:
 *  - Contas de organizador/administrador NÃO podem se autoexcluir por aqui
 *    (evita órfãos de eventos/repasses) → orienta a contatar o suporte.
 *  - Se houver ingressos para eventos FUTUROS, avisa e lista os eventos,
 *    exigindo uma confirmação extra (checkbox) — mas permite excluir.
 *  - Confirmação de segurança: digitar o e-mail da própria conta.
 * A exclusão em si roda no servidor (DELETE /api/users/me), que anonimiza as
 * reservas (mantém histórico financeiro) e apaga o usuário do Supabase Auth.
 */
export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sessionUser, userRole, reservations, events, handleLogout, showToast } = useApp();

  const [confirmEmail, setConfirmEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Organizador/admin/developer não se autoexcluem por aqui.
  const isOrganizer =
    userRole === 'admin' || userRole === 'developer' || !!sessionUser?.isApprovedEventCreator;

  // Ingressos válidos (pagos) para eventos que ainda não aconteceram.
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    const byId = new Map<number, { title: string; date?: string; time?: string }>();
    for (const r of reservations) {
      if (r.paymentStatus !== 'approved' || r.eventId == null) continue;
      const ev = events.find(e => e.id === r.eventId);
      if (!ev?.date) continue;
      const ends = new Date(`${ev.date}T${ev.time ?? '23:59'}:00`).getTime();
      if (ends < now) continue; // já passou
      if (!byId.has(ev.id)) byId.set(ev.id, { title: ev.title, date: ev.date, time: ev.time });
    }
    return Array.from(byId.values());
  }, [reservations, events]);

  const formatEventDate = (date?: string, time?: string) => {
    if (!date) return '';
    const d = new Date(`${date}T${time ?? '00:00'}:00`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      + (time ? ` às ${time}` : '');
  };

  const close = () => {
    if (deleting) return;
    setConfirmEmail('');
    setAcknowledged(false);
    onClose();
  };

  const emailMatches = confirmEmail.trim().toLowerCase() === (sessionUser?.email || '').toLowerCase();
  const canDelete = emailMatches && (upcomingEvents.length === 0 || acknowledged);

  const handleDelete = async () => {
    if (isOrganizer) return;
    if (!emailMatches) { showToast('O e-mail informado não corresponde à sua conta.', 'error'); return; }
    if (upcomingEvents.length > 0 && !acknowledged) {
      showToast('Confirme que entende que perderá o acesso aos ingressos.', 'error');
      return;
    }
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao excluir conta.');
      }
      // Limpa dados locais antes de deslogar
      ['lgpd-consent-v2', 'lgpd-consent', 'eventix-session', 'eventix_developer_config']
        .forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
      showToast('Conta excluída com sucesso. Até logo!', 'info');
      await handleLogout();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir conta. Contate o suporte.', 'error');
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#0f0f0f] border border-red-500/30 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {isOrganizer ? 'Exclusão indisponível' : 'Confirmar exclusão'}
                </h3>
              </div>
              <button onClick={close} disabled={deleting} className="text-white/30 hover:text-white/70 transition disabled:opacity-30">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isOrganizer ? (
              // ── Bloqueio para organizador/admin ──────────────────────────────
              <div>
                <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/25 rounded-2xl p-4 mb-5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Sua conta é de <strong className="text-amber-300">organizador/administrador</strong> e não pode ser
                    excluída por aqui — isso evita deixar eventos, ingressos vendidos e repasses sem responsável.
                    Para encerrar sua conta, entre em contato com o suporte para que seus eventos sejam encerrados ou
                    transferidos com segurança.
                  </p>
                </div>
                <button
                  onClick={close}
                  className="w-full py-3 border border-white/10 text-white/60 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition"
                >
                  Entendi
                </button>
              </div>
            ) : (
              // ── Fluxo normal de exclusão ──────────────────────────────────────
              <div>
                <p className="text-[11px] text-white/60 leading-relaxed mb-4">
                  Esta ação é <strong className="text-red-400">irreversível</strong>. Sua conta e seus dados de perfil
                  serão apagados. O histórico de compras é anonimizado (mantido apenas o necessário por obrigação legal/fiscal).
                </p>

                {upcomingEvents.length > 0 && (
                  <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarClock className="w-4 h-4 text-amber-400" />
                      <p className="text-[11px] font-bold text-amber-300">Você tem ingressos para eventos futuros</p>
                    </div>
                    <ul className="space-y-1 mb-3">
                      {upcomingEvents.map((ev, i) => (
                        <li key={i} className="text-[11px] text-white/70 flex items-start gap-2">
                          <span className="text-amber-400/60">•</span>
                          <span><strong className="text-white/85">{ev.title}</strong> — {formatEventDate(ev.date, ev.time)}</span>
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={e => setAcknowledged(e.target.checked)}
                        className="mt-0.5 accent-red-500"
                      />
                      <span className="text-[10px] text-white/60 leading-relaxed">
                        Entendo que ao excluir a conta perderei o acesso a esses ingressos e não poderei usá-los na entrada.
                      </span>
                    </label>
                  </div>
                )}

                <p className="text-[11px] text-white/60 leading-relaxed mb-2">
                  Para confirmar, digite o e-mail da sua conta:{' '}
                  <strong className="text-white/80">{sessionUser?.email}</strong>
                </p>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  placeholder="Seu e-mail de acesso"
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition mb-4"
                />

                <div className="flex gap-3">
                  <button
                    onClick={close}
                    disabled={deleting}
                    className="flex-1 py-3 border border-white/10 text-white/40 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition disabled:opacity-30"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || !canDelete}
                    className="flex-1 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deleting ? 'Excluindo...' : 'Excluir conta'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
