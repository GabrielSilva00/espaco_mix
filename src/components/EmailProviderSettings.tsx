import { useEffect, useState } from 'react';
import { Mail, Save, Check, Send, Loader2, Key } from 'lucide-react';
import { getAccessTokenSafe } from '../lib/supabase';

async function authed(path: string, body?: any, method = 'POST') {
  const token = await getAccessTokenSafe();
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function EmailProviderSettings() {
  const [notifyWebhook, setNotifyWebhook] = useState('');
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    authed('/api/admin/email-status', undefined, 'GET').then(r => {
      if (!r.ok) return;
      setConfigured(!!r.data.configured);
      setNotifyWebhook(r.data.notifyWebhookUrl || '');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const r = await authed('/api/admin/email-config', {
      provider: 'resend',
      notifyWebhookUrl: notifyWebhook.trim() || undefined,
    });
    setSaving(false);
    if (r.ok) { setConfigured(true); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    return r.ok;
  };

  const test = async () => {
    setTestStatus('sending'); setTestMsg('');
    const ok = await save();
    if (!ok) { setTestStatus('err'); setTestMsg('Erro ao salvar.'); return; }
    const r = await authed('/api/admin/test-email', {});
    if (r.ok) { setTestStatus('ok'); setTestMsg(r.data.message || 'E-mail de teste enviado!'); }
    else {
      const msg = r.data.error || 'Falha no teste.';
      // Traduz erros comuns do Resend
      if (/only send.*testing.*emails.*your own/i.test(msg) || /verify a domain/i.test(msg)) {
        setTestMsg('Para enviar e-mails, verifique seu domínio em resend.com/domains e altere o remetente para um e-mail do domínio verificado.');
      } else if (/api key/i.test(msg)) {
        setTestMsg('Chave da API do Resend inválida ou ausente. Verifique a variável RESEND_API_KEY no Vercel.');
      } else {
        setTestMsg(msg);
      }
      setTestStatus('err');
    }
    setTimeout(() => setTestStatus('idle'), 10000);
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20';

  return (
    <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
      <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
        <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Mail className="w-4 h-4" /></span>
        Provedor de E-mail
      </h3>

      <div className="space-y-4 max-w-2xl">
        <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
          <Key className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-white/80 mb-1">Resend API Key</p>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Configure a chave nas variáveis de ambiente do Vercel (<code className="bg-black/40 px-1 rounded">RESEND_API_KEY</code>).
            </p>
            {configured && <p className="text-[11px] text-green-400 mt-2">✓ E-mail configurado e funcionando.</p>}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Webhook de notificações (Slack/Discord — opcional)</label>
          <input value={notifyWebhook} onChange={e => setNotifyWebhook(e.target.value)} placeholder="https://…" className={inputCls} />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className={`px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 ${saved ? 'bg-green-500/20 text-green-400' : 'bg-[#d4af37] text-black hover:brightness-110 disabled:opacity-50'}`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} {saved ? 'Salvo' : 'Salvar'}
          </button>
          <button onClick={test} disabled={testStatus === 'sending'} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/70 hover:bg-white/10 flex items-center gap-2 disabled:opacity-50">
            {testStatus === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Testar envio
          </button>
          {testMsg && <span className={`text-[11px] ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMsg}</span>}
        </div>
      </div>
    </section>
  );
}
