import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ShoppingCart, Clock, Trash2, QrCode, X, Copy, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAccessTokenSafe } from '../../lib/supabase';

type ResumeData = { reservationId: string; qrCode: string; copyPaste: string };

// Janela que um item pendente fica no carrinho (espelha o backend):
// sem pagamento iniciado = 10 min; com PIX/cartão iniciado = 30 min.
const PENDING_CART_EXPIRY_MS = 10 * 60 * 1000;
const PENDING_PAYMENT_EXPIRY_MS = 30 * 60 * 1000;

export function CartView() {
  const {
    reservations, events, setCurrentView, showToast,
    reloadReservations, setFormEvent, cartOriginEventId,
  } = useApp();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick de 1s para a contagem regressiva de expiração dos itens.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresAtOf = (r: { createdAt?: string; paymentId?: string }) => {
    if (!r.createdAt) return null;
    const created = new Date(r.createdAt).getTime();
    if (!Number.isFinite(created)) return null;
    return created + (r.paymentId ? PENDING_PAYMENT_EXPIRY_MS : PENDING_CART_EXPIRY_MS);
  };

  const pending = reservations.filter(r => r.paymentStatus === 'pending' && !removingIds.has(r.id));

  const eventOf = (eventId?: number) => events.find(e => e.id === eventId);

  // Polling do pagamento enquanto o modal de PIX retomado está aberto.
  useEffect(() => {
    if (!resume) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    let stopped = false;
    const check = async () => {
      try {
        const token = await getAccessTokenSafe();
        const resp = await fetch(`/api/payment/status/${resume.reservationId}?refresh=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await resp.json().catch(() => ({}));
        if (!stopped && data.paymentStatus === 'approved') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setResume(null);
          reloadReservations();
          showToast('Pagamento confirmado! Seus ingressos foram liberados.', 'success');
          setCurrentView('reservations');
        }
      } catch { /* tenta novamente no próximo tick */ }
    };
    pollRef.current = setInterval(check, 3000);
    return () => { stopped = true; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [resume, reloadReservations, showToast, setCurrentView]);

  const handleResume = async (reservationId: string) => {
    if (busyId) return;
    setBusyId(reservationId);
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch('/api/payment/pix/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reservationId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error ?? 'Erro ao retomar pagamento');
      setResume({ reservationId, qrCode: data.qrCodeUrl, copyPaste: data.qrCode });
    } catch (err: any) {
      showToast(err.message ?? 'Não foi possível retomar o pagamento.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (reservationId: string) => {
    // Optimistic: remove imediatamente da lista; reverte em caso de erro.
    setRemovingIds(prev => new Set(prev).add(reservationId));
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch(`/api/reservation/${reservationId}/cancel-pending`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erro ao remover do carrinho');
      }
      reloadReservations();
      showToast('Item removido do carrinho.', 'info');
    } catch (err: any) {
      setRemovingIds(prev => { const s = new Set(prev); s.delete(reservationId); return s; });
      showToast(err.message ?? 'Não foi possível remover o item.', 'error');
    }
  };

  // Remove automaticamente os itens cuja janela de carrinho expirou (libera a
  // mesa no backend via cancel-pending). Roda a cada tick de `now`.
  useEffect(() => {
    pending.forEach(res => {
      const expiresAt = expiresAtOf(res);
      if (expiresAt !== null && now >= expiresAt && !removingIds.has(res.id)) {
        handleRemove(res.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const handleContinue = (eventId?: number) => {
    const ev = eventOf(eventId);
    if (ev) { setFormEvent({ ...ev }); setCurrentView('booking'); }
    else setCurrentView('booking');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-10 mt-12">
      <div className="flex justify-between items-center mb-8 flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-serif text-[#d4af37] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Meu Carrinho
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Ingressos aguardando finalização ou pagamento</p>
        </div>
        {cartOriginEventId && (
          <button
            onClick={() => {
              const ev = events.find(e => e.id === cartOriginEventId);
              if (ev) { setFormEvent({ ...ev }); }
              setCurrentView('booking');
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] border border-white/10 rounded-lg md:rounded-full text-[10px] uppercase tracking-widest hover:bg-white/5 transition w-full md:w-auto"
          >
            <ArrowLeft className="w-3 h-3" /> Continuar Comprando
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="border border-white/10 bg-[#0d0d0d] rounded-2xl p-12 md:p-16 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="w-8 h-8 opacity-40" />
          </div>
          <h3 className="text-xl font-serif text-white mb-2">Seu carrinho está vazio</h3>
          <p className="text-sm opacity-50 max-w-sm mb-8">Quando você selecionar ingressos e não finalizar a compra, eles aparecerão aqui.</p>
          <button
            onClick={() => setCurrentView('home')}
            className="px-8 min-h-[48px] inline-flex items-center justify-center bg-[#d4af37] text-black text-[10px] uppercase font-bold tracking-widest rounded-xl hover:brightness-110 transition-all"
          >
            Ver Eventos
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {pending.map(res => {
            const ev = eventOf(res.eventId);
            const awaitingPayment = !!res.paymentId;
            const count = res.ticketsObj?.length ?? 0;
            const expiresAt = expiresAtOf(res);
            const msLeft = expiresAt !== null ? Math.max(0, expiresAt - now) : null;
            const countdown = msLeft !== null
              ? `${Math.floor(msLeft / 60000).toString().padStart(2, '0')}:${Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0')}`
              : null;
            const urgent = msLeft !== null && msLeft < 120000;
            return (
              <div key={res.id} className="border border-[#d4af37]/20 bg-[#0d0d0d] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-14 h-14 flex-shrink-0 bg-[#111] overflow-hidden rounded-xl border border-white/10">
                  <img src={ev?.img || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80'} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${awaitingPayment ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      <Clock className="w-2 h-2" /> {awaitingPayment ? 'Aguardando pagamento' : 'Aguardando finalizar'}
                    </span>
                    {countdown && (
                      <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${urgent ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/60'}`}>
                        <Clock className="w-2 h-2" /> Expira em {countdown}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm md:text-base font-serif text-[#d4af37]">{ev?.title ?? 'Evento'}</h3>
                  <p className="text-[10px] opacity-50 tracking-widest">{count} ingresso(s) • R$ {res.total.toFixed(2)}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {awaitingPayment ? (
                    <button
                      onClick={() => handleResume(res.id)}
                      disabled={busyId === res.id}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <QrCode className="w-3 h-3" /> {busyId === res.id ? '...' : 'Pagar agora'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleContinue(res.eventId)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition"
                    >
                      Continuar
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(res.id)}
                    disabled={busyId === res.id}
                    className="px-3 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition disabled:opacity-50 flex items-center justify-center"
                    title="Remover do carrinho"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de PIX retomado */}
      <AnimatePresence>
        {resume && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setResume(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-sm w-full text-center relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setResume(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
              {resume.qrCode && (
                <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-xl">
                  <img src={resume.qrCode} alt="PIX QR Code" className="w-44 h-44 mx-auto" />
                </div>
              )}
              <h3 className="text-lg font-serif text-[#d4af37] mb-1">Escaneie o QR Code</h3>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mb-4">Aguardando confirmação do pagamento…</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-left mb-4">
                <p className="text-[9px] uppercase tracking-widest opacity-40 mb-2">Pix Copia e Cola</p>
                <div className="flex gap-2">
                  <input readOnly value={resume.copyPaste} className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-[#d4af37] outline-none" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(resume.copyPaste); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="bg-[#d4af37] text-black px-3 rounded-lg font-bold text-[10px] hover:brightness-110 flex items-center"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-ping"></div>
                <p className="text-[10px] uppercase font-bold text-[#d4af37]">Verificando pagamento automaticamente…</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
