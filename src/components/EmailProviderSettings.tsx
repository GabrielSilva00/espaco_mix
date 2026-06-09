import { useEffect, useState } from 'react';
import { Mail, Eye, EyeOff, Save, Check, Send, Loader2 } from 'lucide-react';
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

/** Provedor de e-mail (Resend ou SMTP) editável nas Configurações. Segredos vão
 *  criptografados no servidor; nunca voltam para a tela. */
export function EmailProviderSettings() {
  const [provider, setProvider] = useState<'resend' | 'smtp'>('resend');
  const [resendKey, setResendKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [notifyWebhook, setNotifyWebhook] = useState('');
  const [show, setShow] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    authed('/api/admin/email-status', undefined, 'GET').then(r => {
      if (!r.ok) return;
      setProvider(r.data.provider === 'smtp' ? 'smtp' : 'resend');
      setConfigured(!!r.data.configured);
      setSmtpHost(r.data.smtpHost || '');
      setSmtpPort(r.data.smtpPort ? String(r.data.smtpPort) : '587');
      setSmtpUser(r.data.smtpUser || '');
      setSmtpSecure(r.data.smtpSecure ?? true);
      setNotifyWebhook(r.data.notifyWebhookUrl || '');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const r = await authed('/api/admin/email-config', {
      provider,
      resendApiKey: provider === 'resend' ? (resendKey || undefined) : undefined,
      smtp: provider === 'smtp' ? { host: smtpHost, port: Number(smtpPort) || 587, user: smtpUser, password: smtpPassword || undefined, secure: smtpSecure } : undefined,
      notifyWebhookUrl: notifyWebhook.trim() || undefined,
    });
    setSaving(false);
    if (r.ok) { setResendKey(''); setSmtpPassword(''); setConfigured(true); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    return r.ok;
  };

  const test = async () => {
    setTestStatus('sending'); setTestMsg('');
    const ok = await save();
    if (!ok) { setTestStatus('err'); setTestMsg('Salve antes de testar.'); return; }
    const r = await authed('/api/admin/test-email', {});
    if (r.ok) { setTestStatus('ok'); setTestMsg(r.data.message || 'E-mail de teste enviado!'); }
    else { setTestStatus('err'); setTestMsg(r.data.error || 'Falha no teste.'); }
    setTimeout(() => setTestStatus('idle'), 6000);
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50 transition placeholder:text-white/20';

  return (
    <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
      <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
        <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Mail className="w-4 h-4" /></span>
        Provedor de E-mail
      </h3>

      <div className="space-y-4 max-w-2xl">
        <div className="flex gap-2">
          {(['resend', 'smtp'] as const).map(p => (
            <button key={p} type="button" onClick={() => setProvider(p)} className={`flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold border transition ${provider === p ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/40'}`}>{p === 'resend' ? 'Resend' : 'SMTP'}</button>
          ))}
        </div>
        {configured && <p className="text-[11px] text-green-400">✓ E-mail configurado. Preencha os segredos de novo só para trocar.</p>}

        {provider === 'resend' ? (
          <div>
            <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Resend API Key</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={resendKey} onChange={e => setResendKey(e.target.value)} placeholder="re_…" className={inputCls + ' pr-10'} />
              <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Host</label><input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputCls} /></div>
              <div><label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Porta</label><input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className={inputCls} /></div>
              <div><label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">TLS/SSL</label><button type="button" onClick={() => setSmtpSecure(v => !v)} className={`w-full py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold border ${smtpSecure ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/40'}`}>{smtpSecure ? 'Ativado' : 'Desativado'}</button></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Usuário</label><input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Senha</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} className={inputCls + ' pr-10'} />
                  <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Webhook de notificações (Slack/Discord — opcional)</label>
          <input value={notifyWebhook} onChange={e => setNotifyWebhook(e.target.value)} placeholder="https://…" className={inputCls} />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className={`px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 ${saved ? 'bg-green-500/20 text-green-400' : 'bg-[#d4af37] text-black hover:brightness-110 disabled:opacity-50'}`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} {saved ? 'Salvo' : 'Salvar e-mail'}
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
