import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getAccessTokenSafe } from '../lib/supabase';

/**
 * Verificação por código para contas criadas via Google (1º acesso).
 * Envia um código ao e-mail do usuário logado e pede a confirmação no site.
 * Não bloqueia: o usuário pode "Pular por agora" e o pedido reaparece no próximo
 * acesso até confirmar (o servidor grava `otp_verified_at`). Aparece só depois
 * de o perfil estar completo (não empilha com o CompleteProfileModal).
 */
export function EmailCodeModal() {
  const { needsCodeVerification, needsProfileCompletion, setNeedsCodeVerification, sessionUser, showToast } = useApp();

  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<{ ticket: string; exp: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const sentRef = useRef(false);

  const visible = needsCodeVerification && !needsProfileCompletion;

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('Sessão expirada.');
      const resp = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error((data as any).error ?? 'Erro ao enviar o código.');
      setTicket({ ticket: (data as any).ticket, exp: (data as any).exp });
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao enviar o código.');
    } finally {
      setSending(false);
    }
  };

  // Envia o código automaticamente na primeira vez que o modal aparece.
  useEffect(() => {
    if (visible && !sentRef.current) {
      sentRef.current = true;
      sendCode();
    }
    if (!visible) sentRef.current = false;
  }, [visible]);

  if (!visible) return null;

  const handleConfirm = async () => {
    if (code.replace(/\D/g, '').length !== 6) { setError('Informe o código de 6 dígitos.'); return; }
    if (!ticket) { setError('Solicite um novo código.'); return; }
    setVerifying(true);
    setError('');
    try {
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('Sessão expirada.');
      const resp = await fetch('/api/auth/confirm-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: code.replace(/\D/g, ''), ticket: ticket.ticket, exp: ticket.exp }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !(data as any).valid) throw new Error((data as any).error ?? 'Código incorreto.');
      setNeedsCodeVerification(false);
      showToast('Conta verificada com sucesso!', 'success');
    } catch (e: any) {
      setError(e?.message ?? 'Código incorreto.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-sm w-full my-auto text-center"
      >
        <h3 className="text-lg font-serif text-[#d4af37] mb-1">Confirme seu acesso</h3>
        <p className="text-sm text-white/60 mb-5">
          Enviamos um código de 6 dígitos para
          {sessionUser?.email ? <> <span className="text-white/80">{sessionUser.email}</span></> : ' o seu e-mail'}.
          Digite-o abaixo para verificar sua conta.
        </p>

        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[52px] text-center text-2xl tracking-[12px] font-mono focus:border-[#d4af37] outline-none transition mb-3"
        />

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={verifying || sending}
          className="w-full bg-[#d4af37] text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#e5c14e] transition disabled:opacity-50"
        >
          {verifying ? 'Verificando…' : 'Confirmar'}
        </button>

        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80 transition disabled:opacity-40"
          >
            {sending ? 'Enviando…' : 'Reenviar código'}
          </button>
          <button
            type="button"
            onClick={() => setNeedsCodeVerification(false)}
            className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition"
          >
            Pular por agora
          </button>
        </div>
      </motion.div>
    </div>
  );
}
