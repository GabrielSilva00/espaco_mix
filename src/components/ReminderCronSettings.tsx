import { useEffect, useState } from 'react';
import { Clock, Copy, Send, Loader2, Check } from 'lucide-react';
import { getSystemConfig, updateSystemConfig, getAccessTokenSafe } from '../lib/supabase';

/**
 * Lembretes automáticos (Vercel Cron). O agendamento real fica no vercel.json
 * (aplicado no deploy). Aqui o admin escolhe a hora, copia o snippet a usar e
 * pode disparar os lembretes na hora para testar.
 */
export function ReminderCronSettings() {
  const [hour, setHour] = useState(12);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [trigStatus, setTrigStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [trigMsg, setTrigMsg] = useState('');

  useEffect(() => {
    getSystemConfig().then(c => { if (typeof c.reminder_cron_hour === 'number') setHour(c.reminder_cron_hour); }).catch(() => {});
  }, []);

  const snippet = `{
  "crons": [
    { "path": "/api/email/send-reminders", "schedule": "0 ${hour} * * *" }
  ]
}`;

  const saveHour = async () => {
    setSaving(true);
    try { await updateSystemConfig({ reminder_cron_hour: hour } as any); setSaved(true); setTimeout(() => setSaved(false), 2500); } catch { /* ignore */ }
    setSaving(false);
  };

  const triggerNow = async () => {
    setTrigStatus('sending'); setTrigMsg('');
    try {
      const token = await getAccessTokenSafe();
      const res = await fetch('/api/admin/trigger-reminders', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setTrigStatus('ok'); setTrigMsg(`Lembretes: ${data.sent ?? 0} enviado(s), ${data.errors ?? 0} erro(s).`); }
      else { setTrigStatus('err'); setTrigMsg(data.error || 'Falha ao disparar.'); }
    } catch { setTrigStatus('err'); setTrigMsg('Erro de conexão.'); }
    setTimeout(() => setTrigStatus('idle'), 6000);
  };

  return (
    <section className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8">
      <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] mb-6 flex items-center gap-3">
        <span className="p-2 bg-[#d4af37]/10 rounded-lg"><Clock className="w-4 h-4" /></span>
        Lembretes Automáticos (Vercel Cron)
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Horário do disparo diário (UTC)</label>
            <div className="flex gap-2 items-center">
              <select value={hour} onChange={e => setHour(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]/50">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
              <button onClick={saveHour} disabled={saving} className={`px-4 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 ${saved ? 'bg-green-500/20 text-green-400' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'}`}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null} {saved ? 'Salvo' : 'Salvar hora'}
              </button>
            </div>
            <p className="text-[11px] text-white/30 mt-2">O agendamento real vive no <code className="bg-black/40 px-1 rounded">vercel.json</code> (aplicado no deploy). Para mudar a hora em produção, atualize o snippet ao lado e faça um novo deploy.</p>
          </div>

          <div>
            <button onClick={triggerNow} disabled={trigStatus === 'sending'} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-[10px] uppercase tracking-widest font-bold hover:bg-[#d4af37]/20 disabled:opacity-50">
              {trigStatus === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Disparar agora (teste)
            </button>
            {trigMsg && <p className={`text-[11px] mt-2 ${trigStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{trigMsg}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Snippet para o vercel.json</label>
          <div className="relative">
            <pre className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4 text-[11px] font-mono text-white/70 overflow-x-auto">{snippet}</pre>
            <button onClick={() => navigator.clipboard.writeText(snippet)} className="absolute top-2 right-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white" title="Copiar"><Copy className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
