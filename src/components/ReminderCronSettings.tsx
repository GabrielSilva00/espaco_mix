import { useEffect, useState } from 'react';
import { Clock, Send, Loader2, Check } from 'lucide-react';
import { getSystemConfig, updateSystemConfig, getAccessTokenSafe } from '../lib/supabase';

/**
 * Lembretes automáticos (Vercel Cron). O cron roda de hora em hora (vercel.json:
 * "0 * * * *") e o servidor só dispara os e-mails na hora escolhida aqui. Logo,
 * alterar a hora pelo site passa a valer automaticamente — sem editar código.
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

  // Mostra a hora local equivalente à hora UTC escolhida, para evitar confusão.
  const localLabel = (() => {
    const d = new Date(); d.setUTCHours(hour, 0, 0, 0);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  })();

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

      <div className="max-w-xl space-y-5">
        <div>
          <label className="block text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em]">Horário do disparo diário (UTC)</label>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Clock className="w-4 h-4 text-[#d4af37]/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={hour}
                onChange={e => setHour(Number(e.target.value))}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm font-medium text-white focus:outline-none focus:border-[#d4af37]/50 hover:bg-white/[0.07] cursor-pointer transition min-w-[140px]"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h} className="bg-[#0d0d0d] text-white">{String(h).padStart(2, '0')}:00 UTC</option>
                ))}
              </select>
              <svg className="w-4 h-4 text-white/30 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </div>
            <button onClick={saveHour} disabled={saving} className={`px-4 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition ${saved ? 'bg-green-500/20 text-green-400' : 'bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/20'}`}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null} {saved ? 'Salvo' : 'Salvar hora'}
            </button>
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            Equivale a <span className="text-[#d4af37]/80 font-medium">{localLabel}</span> no seu horário local.
            O sistema verifica os lembretes de hora em hora e envia somente nesta hora escolhida — alterar aqui já passa a valer no próximo ciclo.
          </p>
        </div>

        <div className="pt-2 border-t border-white/5">
          <button onClick={triggerNow} disabled={trigStatus === 'sending'} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 disabled:opacity-50">
            {trigStatus === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Disparar agora (teste)
          </button>
          {trigMsg && <p className={`text-[11px] mt-2 ${trigStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{trigMsg}</p>}
        </div>
      </div>
    </section>
  );
}
