import React, { useEffect, useMemo, useState } from 'react';
import { Search, Clock, ShieldCheck, XCircle, X } from 'lucide-react';
import {
  getPendingApplications,
  approveProducer,
  rejectProducer,
  supabase,
} from '../lib/supabase';

interface ApprovalQueueProps {
  onToast?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

interface PendingApproval {
  id: string;
  userId: string;
  name: string;
  email: string;
  type: 'PF' | 'PJ';
  submittedAt: string;
  cnpj?: string;
  phone?: string;
  city?: string;
  instagram?: string;
  experience?: string;
  eventTypes?: string[];
}

const toDisplayDate = (raw?: string) => {
  if (!raw) return 'Recente';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Recente';
  return d.toLocaleString('pt-BR');
};

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ onToast }) => {
  const [allApprovals, setAllApprovals] = useState<PendingApproval[]>([]);
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [profileOpen, setProfileOpen] = useState<PendingApproval | null>(null);

  const loadApprovals = async () => {
    try {
      const apps = await getPendingApplications();
      const mapped: PendingApproval[] = (apps as any[]).map((app) => ({
        id: app.id,
        userId: app.user_id,
        name: app.profiles?.name || app.company_name || 'Produtor sem nome',
        email: app.profiles?.email || '',
        type: String(app.cnpj || '').replace(/\D/g, '').length > 0 ? 'PJ' : 'PF',
        submittedAt: app.created_at,
        cnpj: app.cnpj,
        phone: app.phone,
        city: app.city,
        instagram: app.social_instagram,
        experience: app.experience,
        eventTypes: app.event_types,
      }));
      setAllApprovals(mapped);
    } catch (err) {
      console.error('[ApprovalQueue] Erro ao carregar candidaturas:', err);
    }
  };

  useEffect(() => {
    loadApprovals();

    const channel = supabase
      .channel('approval-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producer_applications' }, () => {
        loadApprovals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredApprovals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allApprovals;
    return allApprovals.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
    );
  }, [allApprovals, search]);

  const approve = async (item: PendingApproval) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const reviewerId = user?.id ?? 'admin';
      await approveProducer(item.id, item.userId, reviewerId);
      setAllApprovals((prev) => prev.filter((entry) => entry.id !== item.id));
      onToast?.(`Produtor ${item.name} aprovado com sucesso.`, 'success');
    } catch (err) {
      console.error(err);
      onToast?.('Erro ao aprovar produtor.', 'error');
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (rejectionReason.trim().length < 20) {
      onToast?.('Informe um motivo com no minimo 20 caracteres.', 'warning');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const reviewerId = user?.id ?? 'admin';
      await rejectProducer(rejecting.id, reviewerId, rejectionReason.trim());

      try {
        await fetch('/api/producer/rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: rejecting.userId,
            email: rejecting.email,
            name: rejecting.name,
            reason: rejectionReason.trim(),
          }),
        });
      } catch {
        // Endpoint optional in local environments.
      }

      setAllApprovals((prev) => prev.filter((entry) => entry.id !== rejecting.id));
      onToast?.(`Produtor ${rejecting.name} rejeitado.`, 'info');
      setRejecting(null);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      onToast?.('Erro ao rejeitar produtor.', 'error');
    }
  };

  return (
    <div className="p-8 space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-serif text-[#d4af37]">Fila de Ativacao KYC</h1>
          <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1">
            {filteredApprovals.length} produtores aguardando analise
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produtor..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-[#d4af37] outline-none"
          />
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="p-4 text-[10px] uppercase tracking-widest text-white/40">Produtor</th>
              <th className="p-4 text-[10px] uppercase tracking-widest text-white/40">Tipo</th>
              <th className="p-4 text-[10px] uppercase tracking-widest text-white/40">Envio</th>
              <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.map((item) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-4">
                  <p className="text-sm font-bold text-white mb-0.5">{item.name}</p>
                  <p className="text-xs text-white/50">{item.email || item.id}</p>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${item.type === 'PJ' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {item.type}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 text-xs font-bold text-white/60">
                    <Clock className="w-3 h-3" /> {toDisplayDate(item.submittedAt)}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setProfileOpen(item)}
                      className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-white/15 hover:border-white/30"
                    >
                      Ver Perfil
                    </button>
                    <button
                      onClick={() => approve(item)}
                      className="bg-green-500/20 border border-green-500/40 text-green-300 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-green-500/30 transition flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Aprovar
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(item);
                        setRejectionReason('');
                      }}
                      className="bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rejeitar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0d0d0d] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-serif text-[#d4af37] mb-3">Rejeitar produtor</h3>
            <p className="text-sm text-white/70 mb-4">
              Informe o motivo da rejeicao para <strong>{rejecting.name}</strong>.
            </p>
            <textarea
              rows={6}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
              placeholder="Descreva claramente os ajustes necessarios (minimo 20 caracteres)."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejecting(null)} className="px-4 py-2 border border-white/15 rounded-lg text-xs uppercase tracking-widest font-bold">
                Cancelar
              </button>
              <button onClick={reject} className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs uppercase tracking-widest font-black">
                Confirmar rejeicao
              </button>
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-[65] bg-black/50" onClick={() => setProfileOpen(null)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0d0d0d] border-l border-white/10 p-6 overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-serif text-[#d4af37]">Perfil do Produtor</h3>
              <button onClick={() => setProfileOpen(null)} className="p-2 border border-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <Field label="Nome" value={profileOpen.name} />
              <Field label="Email" value={profileOpen.email} />
              <Field label="CPF/CNPJ" value={profileOpen.cnpj || '-'} />
              <Field label="Telefone" value={profileOpen.phone || '-'} />
              <Field label="Cidade" value={profileOpen.city || '-'} />
              <Field label="Instagram" value={profileOpen.instagram || '-'} />
              <Field label="Tipo de Evento" value={(profileOpen.eventTypes || []).join(', ') || '-'} />
              <Field label="Historico" value={profileOpen.experience || '-'} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 rounded-xl p-3 bg-white/[0.02]">
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{label}</p>
      <p className="text-sm text-white">{value || '-'}</p>
    </div>
  );
}
