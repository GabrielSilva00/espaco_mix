import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, Check, X, ShieldCheck, Clock, Ticket } from 'lucide-react';
import { getAccessTokenSafe } from '../../lib/supabase';

interface CpfTicket {
  id: string;
  name: string;
  ownerName?: string;
  status: string;
  checkedIn: boolean;
  checkedInAt?: string;
  eventId: number;
  eventTitle: string;
  eventDate: string;
}

interface CpfSearchResult {
  found: boolean;
  message?: string;
  customer?: { name: string; email: string };
  tickets?: CpfTicket[];
}

interface Props {
  eventId?: number;
  onCheckIn: (ticketId: string) => Promise<void>;
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function CpfSearch({ eventId, onCheckIn }: Props) {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CpfSearchResult | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return;
    setLoading(true);
    setResult(null);
    try {
      const token = await getAccessTokenSafe();
      const staffToken = (() => { try { return localStorage.getItem('eventix-staff-token'); } catch { return null; } })();
      const bearer = token || staffToken;
      const resp = await fetch('/api/checkin/search-cpf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ cpf: digits, eventId }),
      });
      const data = await resp.json();
      setResult(data);
    } catch {
      setResult({ found: false, message: 'Erro de conexão ao buscar CPF.' });
    } finally {
      setLoading(false);
    }
  }, [cpf, eventId]);

  const handleTicketCheckIn = async (ticketId: string) => {
    setCheckingIn(ticketId);
    try {
      await onCheckIn(ticketId);
      setResult(prev => {
        if (!prev?.tickets) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map(t =>
            t.id === ticketId ? { ...t, checkedIn: true, checkedInAt: new Date().toISOString() } : t
          ),
        };
      });
    } finally {
      setCheckingIn(null);
    }
  };

  const handleClear = () => {
    setCpf('');
    setResult(null);
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-white/5">
        <h3 className="text-xs font-serif text-[#d4af37] uppercase tracking-widest leading-none mb-3">Buscar por CPF</h3>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-[#d4af37] outline-none transition-colors text-white tracking-wider font-mono"
          />
          <button
            onClick={handleSearch}
            disabled={cpf.replace(/\D/g, '').length !== 11 || loading}
            className="px-5 bg-[#d4af37] text-black font-black text-[10px] uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="cpf-result"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {!result.found ? (
              /* Not found */
              <div className="p-5 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-sm text-white/60">{result.message || 'CPF não encontrado.'}</p>
                <button onClick={handleClear} className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold">
                  Nova busca
                </button>
              </div>
            ) : (
              <div>
                {/* Customer info */}
                <div className="p-4 bg-[#d4af37]/5 border-b border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#d4af37]/15 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-[#d4af37]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{result.customer?.name}</p>
                    <p className="text-[11px] text-white/40 truncate">{result.customer?.email}</p>
                  </div>
                  <button onClick={handleClear} className="ml-auto text-white/30 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tickets */}
                {(!result.tickets || result.tickets.length === 0) ? (
                  <div className="p-5 text-center">
                    <p className="text-sm text-white/40">{result.message || 'Nenhum ingresso encontrado.'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {result.tickets.map((ticket) => (
                      <div key={ticket.id} className="p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          ticket.checkedIn ? 'bg-green-500/15' :
                          ticket.status === 'cancelled' ? 'bg-red-500/15' : 'bg-white/5'
                        }`}>
                          {ticket.checkedIn ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : ticket.status === 'cancelled' ? (
                            <X className="w-4 h-4 text-red-400" />
                          ) : (
                            <Ticket className="w-4 h-4 text-white/40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-white truncate">{ticket.name}</p>
                          <p className="text-[10px] text-white/30 truncate">{ticket.eventTitle}</p>
                          {ticket.checkedIn && ticket.checkedInAt && (
                            <p className="text-[10px] text-green-400/70 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              Check-in: {new Date(ticket.checkedInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        {!ticket.checkedIn && ticket.status !== 'cancelled' && (
                          <button
                            onClick={() => handleTicketCheckIn(ticket.id)}
                            disabled={checkingIn === ticket.id}
                            className="px-4 py-2.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-500/25 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                          >
                            {checkingIn === ticket.id ? (
                              <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            Liberar
                          </button>
                        )}
                        {ticket.checkedIn && (
                          <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-[9px] font-bold uppercase tracking-widest shrink-0">
                            Entrou
                          </span>
                        )}
                        {ticket.status === 'cancelled' && (
                          <span className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-bold uppercase tracking-widest shrink-0">
                            Cancelado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
