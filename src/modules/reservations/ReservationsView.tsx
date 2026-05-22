import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  MapPin,
  Clock,
  Copy,
  CalendarDays,
  LifeBuoy,
  User,
  AlertTriangle,
  Expand,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadTicketPDF } from '../../shared/utils/pdf';
import type { TicketItem } from '../../types';

function useCountdown(expiresAt: number | undefined): string {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!expiresAt) { setRemaining(''); return; }
    const update = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(diff === 0 ? 'Expirado' : `${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function SingleTicketRow({ tkt, singleCount, setQrFullscreen, setActionTicket }: {
  tkt: TicketItem;
  singleCount: number;
  setQrFullscreen: (v: { id: string; name: string } | null) => void;
  setActionTicket: (v: any) => void;
}) {
  const needsData = !tkt.ownerName;
  const countdown = useCountdown(tkt.transferExpiresAt);
  return (
    <div className={`p-4 rounded-xl border ${tkt.status === 'cancelled' ? 'border-red-500/20 bg-red-500/5' : needsData && tkt.status === 'active' ? 'bg-amber-500/5 border-amber-500/30' : 'border-white/10 bg-white/5'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
      <div className="flex gap-4 items-center w-full md:w-auto">
        <div className="relative group cursor-pointer" onClick={(e) => { e.stopPropagation(); setQrFullscreen({ id: tkt.id, name: tkt.name }); }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${tkt.id}`} alt="QR" className={`w-16 h-16 bg-white p-1 rounded-lg transition ${tkt.status !== 'active' ? 'opacity-20 grayscale' : 'group-hover:opacity-80'}`} />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition backdrop-blur-[2px]">
            <Expand className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#d4af37]">{tkt.name}</p>
          <div className="flex items-center gap-2 mt-1 mb-2">
            <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded-full ${tkt.status === 'active' ? 'bg-green-500/10 text-green-400' : tkt.status === 'transferred' ? 'bg-blue-500/10 text-blue-400' : tkt.status === 'pending_transfer' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-500'}`}>
              {tkt.status === 'active' ? 'Ativo' : tkt.status === 'transferred' ? 'Transferido' : tkt.status === 'pending_transfer' ? 'Ag. Transferência' : 'Cancelado'}
            </span>
            <span className="text-[10px] opacity-40 font-mono tracking-widest">{tkt.id}</span>
          </div>
          {tkt.status === 'pending_transfer' && (
            <p className="text-[9px] text-yellow-400 mt-1 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" /> {countdown} — Aguardando {tkt.pendingTransferEmail}
            </p>
          )}
          <div className="text-[10px] uppercase opacity-80 min-h-[16px]">
            {tkt.ownerName ? (
              <p className="flex items-center gap-1.5"><User className="w-3 h-3 opacity-50" /> <span className="font-bold text-white max-w-[120px] sm:max-w-[180px] truncate">{tkt.ownerName}</span></p>
            ) : (
              <p className="text-amber-500 font-bold flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Pendente</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
        {tkt.status === 'active' && (
          <>
            {singleCount > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'edit', data: { name: tkt.ownerName, cpf: tkt.ownerCpf, email: tkt.ownerEmail } }); }}
                className={`px-3 py-2 rounded-lg text-[9px] uppercase tracking-[0.1em] font-bold transition flex-1 md:flex-none text-center h-[34px] ${needsData ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              >
                {tkt.ownerName ? 'Editar Dados' : 'Preencher Dados'}
              </button>
            )}
            <div className="flex gap-2 flex-1 md:flex-none w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'transfer' }); }}
                className="h-[34px] flex-1 md:flex-none px-3 bg-white/5 hover:bg-white/10 rounded-lg text-white transition text-[9px] uppercase tracking-widest font-bold"
              >Transferir</button>
              <button
                onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'cancel' }); }}
                className="h-[34px] flex-1 md:flex-none px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition text-[9px] uppercase tracking-widest font-bold"
              >Cancelar</button>
            </div>
          </>
        )}
        {tkt.status === 'active' && (
          <div className="flex gap-2 flex-1 md:flex-none w-full md:w-auto mt-2 md:mt-0">
            <button onClick={(e) => { e.stopPropagation(); downloadTicketPDF({ id: tkt.id, name: tkt.name, ownerName: tkt.ownerName }); }} className="h-[34px] flex-1 md:flex-none px-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition flex justify-center items-center" title="Baixar PDF">
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReservationsView() {
  const {
    setCurrentView,
    reservations, setReservations,
    reservationsTab, setReservationsTab,
    expandedRes, setExpandedRes,
    copiedCod, setCopiedCod,
    qrFullscreen, setQrFullscreen,
    events,
    actionTicket, setActionTicket,
  } = useApp();

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 mt-12">
        <div className="flex justify-between items-start md:items-center mb-8 flex-col md:flex-row gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg md:text-xl font-serif text-[#d4af37]">Minhas Reservas</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Gerencie seus ingressos e mesas</p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('booking')}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] border border-white/10 rounded-lg md:rounded-full text-[10px] uppercase tracking-widest hover:bg-white/5 transition w-full md:w-auto"
          >
            <ArrowLeft className="w-3 h-3" /> Voltar ao Início
          </button>
        </div>

        <div className="flex gap-6 mb-8 border-b border-white/10 select-none">
           <button
             onClick={() => setReservationsTab('upcoming')}
             className={`pb-4 text-[10px] md:text-[11px] uppercase tracking-widest font-bold transition-all relative ${reservationsTab === 'upcoming' ? 'text-[#d4af37]' : 'text-white/40 hover:text-white/80'}`}
           >
             Próximos Eventos
             {reservationsTab === 'upcoming' && <motion.div layoutId="tabMarker" className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.5)]"></motion.div>}
           </button>
           <button
             onClick={() => setReservationsTab('past')}
             className={`pb-4 text-[10px] md:text-[11px] uppercase tracking-widest font-bold transition-all relative ${reservationsTab === 'past' ? 'text-[#d4af37]' : 'text-white/40 hover:text-white/80'}`}
           >
             Histórico
             {reservationsTab === 'past' && <motion.div layoutId="tabMarker" className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.5)]"></motion.div>}
           </button>
        </div>

        {reservations.length === 0 || reservationsTab === 'past' ? (
          <div className="border border-white/10 bg-[#0d0d0d] rounded-2xl p-12 md:p-16 flex flex-col items-center justify-center text-center shadow-xl">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl grayscale opacity-50">🎫</span>
            </div>
            <h3 className="text-xl font-serif text-white mb-2">{reservationsTab === 'upcoming' ? 'Nenhuma reserva encontrada' : 'Nenhum histórico'}</h3>
            <p className="text-sm opacity-50 max-w-sm mb-8">
              {reservationsTab === 'upcoming'
                ? 'Você ainda não possui eventos agendados. Explore nosso calendário e garanta seu lugar!'
                : 'Você não participou de nenhum evento anterior ainda.'}
            </p>
            {reservationsTab === 'upcoming' && (
              <button
                onClick={() => setCurrentView('booking')}
                className="px-8 min-h-[48px] inline-flex items-center justify-center bg-[#d4af37] text-black text-[10px] uppercase font-bold tracking-widest rounded-xl hover:brightness-110 transition-all w-full sm:w-auto shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
              >
                Ver Eventos
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {reservations.map(res => {
              const isExpanded = expandedRes === res.id;

              return (
                <div
                  key={res.id}
                  className={`border border-[#d4af37]/20 bg-[#0d0d0d] rounded-2xl overflow-hidden relative transition-all duration-300 ${isExpanded ? 'p-6 ring-1 ring-[#d4af37]/40 shadow-[0_0_30px_rgba(212,175,55,0.05)]' : 'hover:bg-white/5 cursor-pointer p-4 md:p-5'}`}
                  onClick={() => !isExpanded && setExpandedRes(res.id)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-[100px] rounded-full"></div>

                  {/* View Colapsada */}
                  {!isExpanded && (
                    <div className="flex justify-between items-center relative z-10 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 flex-shrink-0 bg-[#111] overflow-hidden rounded-xl border border-white/10 group-hover:border-[#d4af37]/30 transition">
                          <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80" alt="Cover" className="w-full h-full object-cover" />
                        </div>
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 text-[8px] uppercase tracking-widest rounded-full flex items-center gap-1">
                              <Check className="w-2 h-2" /> Confirmado
                            </span>
                          </div>
                          <h3 className="text-sm md:text-base font-serif text-[#d4af37]">Midnight Soirée</h3>
                          <p className="text-[10px] md:text-xs opacity-50 uppercase tracking-widest">{res.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="hidden sm:flex flex-col items-end mr-4">
                           <span className="text-[9px] uppercase opacity-40 tracking-widest">Total</span>
                           <span className="text-sm font-serif text-white">R$ {res.total.toFixed(2)}</span>
                         </div>
                         <ChevronDown className="w-4 h-4 opacity-30" />
                      </div>
                    </div>
                  )}

                  {/* View Expandida */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="relative z-10"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-6">
                        <div className="flex gap-4">
                           <div className="hidden md:block w-20 h-20 md:w-24 md:h-24 flex-shrink-0 bg-[#111] overflow-hidden rounded-xl border border-white/10">
                             <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80" alt="Cover" className="w-full h-full object-cover" />
                           </div>
                           <div>
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
                                <Check className="w-3 h-3" /> Confirmado
                              </span>
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] opacity-70 uppercase tracking-widest bg-white/5 py-1 px-3 rounded-md font-mono border border-white/10">Cod: {res.id}</span>
                                 <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(res.id);
                                      setCopiedCod(res.id);
                                      setTimeout(() => setCopiedCod(null), 2000);
                                    }}
                                    className="p-1.5 hover:bg-[#d4af37]/10 text-white/40 hover:text-[#d4af37] rounded-md transition"
                                    title="Copiar Código"
                                  >
                                    {copiedCod === res.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                 </button>
                              </div>
                            </div>
                            <h3 className="text-xl md:text-2xl font-serif text-[#d4af37] mb-1">Midnight Soirée</h3>
                            <p className="text-[11px] opacity-60 flex items-center gap-2 mb-3"><MapPin className="w-3 h-3"/> Villa d'Este, S.P. • {res.date}</p>

                            <div className="flex gap-2">
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  const evt = events.find(ev => ev.id === res.eventId);
                                  const title = encodeURIComponent(evt?.title || 'Midnight Soirée');
                                  const location = encodeURIComponent(evt?.location || 'Villa d\'Este, S.P.');
                                  const details = encodeURIComponent('Ingresso: ' + res.id);
                                  const dateStr = evt?.date?.replace(/-/g, '') || '20261115';
                                  const timeStr = (evt?.time || '22:00').replace(':', '') + '00';
                                  const endHour = String(Math.min(parseInt((evt?.time || '22:00').split(':')[0]) + 4, 23)).padStart(2,'0');
                                  const endStr = dateStr + 'T' + endHour + '0000';
                                  const startStr = dateStr + 'T' + timeStr;
                                  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
                                  window.open(calUrl, '_blank');
                                }} className="flex items-center gap-1.5 px-3 py-2 min-w-[80px] bg-white/5 border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-wider hover:bg-white/10 hover:border-[#d4af37]/30 transition-all text-white/50 hover:text-white">
                                   <CalendarDays className="w-3.5 h-3.5 shrink-0" /> <span>Agenda</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setCurrentView('contact'); }} className="text-[9px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 md:rounded-full rounded-lg transition text-white/50 hover:text-white">
                                   <LifeBuoy className="w-3 h-3" /> Suporte
                                </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRes(null);
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition absolute top-0 right-0 md:relative"
                          >
                            <ChevronUp className="w-4 h-4 opacity-70" />
                          </button>

                          <div className="mt-4 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl flex items-center gap-3 w-full md:w-auto">
                             <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-[#d4af37]" />
                             </div>
                             <div className="text-left">
                                <p className="text-[8px] uppercase tracking-[0.2em] opacity-50 mb-0.5">Começa em</p>
                                <p className="text-sm font-mono font-bold text-[#d4af37] tracking-widest">
                                  {(() => {
                                    const tDate = new Date('2026-11-15T22:00:00');
                                    const now = new Date('2026-05-01T14:24:00Z');
                                    return Math.max(0, Math.ceil((tDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                                  })()} DIAS
                                </p>
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 items-center border-t border-white/10 pt-6 mt-2">
                        <div className="md:col-span-12">
                          <h4 className="text-xs uppercase tracking-widest opacity-50 mb-4">Ingressos</h4>
                          {(() => {
                            const tableTickets = res.ticketsObj?.filter(t => t.isTable) || [];
                            const singleTicketsArr = res.ticketsObj?.filter(t => !t.isTable) || [];
                            const tablesMap = new Map<number, typeof tableTickets>();
                            tableTickets.forEach(t => {
                              if (t.tableNumber) {
                                if (!tablesMap.has(t.tableNumber)) tablesMap.set(t.tableNumber, []);
                                tablesMap.get(t.tableNumber)!.push(t);
                              }
                            });

                            return (
                              <div className="space-y-6">
                                {Array.from(tablesMap.entries()).map(([tableNumber, tickets]) => {
                                  const allCancelled = tickets.every(t => t.status === 'cancelled');
                                  return (
                                    <div key={`table-${tableNumber}`} className={`p-4 rounded-xl border ${allCancelled ? 'border-red-500/20 bg-red-500/5' : 'border-white/10 bg-white/5'}`}>
                                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-white/10">
                                        <div>
                                          <h5 className="text-sm font-bold text-[#d4af37]">Reserva: Mesa {tableNumber}</h5>
                                          {allCancelled && <span className="text-[10px] text-red-500 uppercase font-bold tracking-widest mt-1 block">Mesa Cancelada</span>}
                                        </div>
                                        {!allCancelled && (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tableNumber, type: 'transfer_table', reservationId: res.id }); }}
                                              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] uppercase tracking-widest transition"
                                            >Transferir Mesa</button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tableNumber, type: 'cancel_table', reservationId: res.id }); }}
                                              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[9px] uppercase tracking-widest transition"
                                            >Cancelar Mesa</button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-4">
                                          {tickets.map(tkt => {
                                            const needsData = !tkt.ownerName;
                                            return (
                                            <div key={tkt.id} className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 rounded-xl border ${needsData && tkt.status === 'active' && !allCancelled ? 'bg-amber-500/5 border-amber-500/30' : 'bg-black/20 border-white/5'}`}>
                                              <div className="flex gap-4 items-center w-full md:w-auto">
                                                <div className="relative group cursor-pointer" onClick={(e) => { e.stopPropagation(); setQrFullscreen({ id: tkt.id, name: tkt.name }); }}>
                                                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${tkt.id}`} alt="QR" className={`w-14 h-14 bg-white p-1 rounded-lg transition ${tkt.status !== 'active' ? 'opacity-20 grayscale' : 'group-hover:opacity-80'}`} />
                                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition backdrop-blur-[2px]">
                                                      <Expand className="w-4 h-4 text-white" />
                                                   </div>
                                                </div>
                                                <div className="flex-1">
                                                  <p className="text-xs font-bold text-white">{tkt.name}</p>
                                                  <div className="flex items-center gap-2 mt-1 mb-2">
                                                    <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded-full ${tkt.status === 'active' ? 'bg-green-500/10 text-green-400' : tkt.status === 'transferred' ? 'bg-blue-500/10 text-blue-400' : tkt.status === 'pending_transfer' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-500'}`}>
                                                      {tkt.status === 'active' ? 'Ativo' : tkt.status === 'transferred' ? 'Transferido' : tkt.status === 'pending_transfer' ? 'Ag. Transferência' : 'Cancelado'}
                                                    </span>
                                                    <span className="text-[9px] opacity-40 font-mono tracking-widest">{tkt.id}</span>
                                                  </div>
                                                  <div className="text-[10px] uppercase opacity-80 min-h-[16px]">
                                                    {tkt.ownerName ? (
                                                      <p className="flex items-center gap-1.5"><User className="w-3 h-3 opacity-50" /> <span className="font-bold text-white max-w-[120px] sm:max-w-[180px] truncate">{tkt.ownerName}</span></p>
                                                    ) : (
                                                      <p className="text-amber-500 font-bold flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Pendente</p>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                {tkt.status === 'active' && !allCancelled && (
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'edit', data: { name: tkt.ownerName, cpf: tkt.ownerCpf, email: tkt.ownerEmail } }); }}
                                                    className={`px-3 py-2 rounded-lg text-[9px] uppercase tracking-[0.1em] font-bold transition flex-1 md:flex-none text-center h-[34px] ${needsData ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                                                  >
                                                    {tkt.ownerName ? 'Editar Dados' : 'Preencher Dados'}
                                                  </button>
                                                )}
                                                {tkt.status === 'active' && !allCancelled && (
                                                  <div className="flex gap-2 flex-1 md:flex-none">
                                                    <button onClick={(e) => { e.stopPropagation(); downloadTicketPDF({ id: tkt.id, name: tkt.name, ownerName: tkt.ownerName }); }} className="h-[34px] flex-1 md:flex-none px-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition flex justify-center items-center" title="Baixar PDF">
                                                      <Download className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  );
                                })}

                                <div className="space-y-4">
                                  {singleTicketsArr.map(tkt => (
                                    <SingleTicketRow
                                      key={tkt.id}
                                      tkt={tkt}
                                      singleCount={singleTicketsArr.length}
                                      setQrFullscreen={setQrFullscreen}
                                      setActionTicket={setActionTicket}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Fullscreen Modal */}
      <AnimatePresence>
        {qrFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setQrFullscreen(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 md:p-8 rounded-3xl flex flex-col items-center max-w-sm w-full outline outline-4 outline-[#d4af37]/30 shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setQrFullscreen(null)} className="absolute top-4 right-4 p-2 text-black/50 hover:text-black rounded-full hover:bg-black/5 transition">
                 <X className="w-5 h-5" />
              </button>
              <div className="text-center w-full mb-6 border-b border-black/10 pb-4 mt-2">
                 <h3 className="text-black font-serif text-xl md:text-2xl">{qrFullscreen.name}</h3>
                 <p className="text-black/50 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Midnight Soirée</p>
              </div>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrFullscreen.id}`} alt="QR Code Enlarged" className="w-56 h-56 md:w-64 md:h-64 border border-black/5 rounded-xl shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] p-2 mb-2" />
              <p className="text-black/40 text-xs font-mono tracking-widest text-center mt-4 bg-black/5 px-4 py-1.5 rounded-full">{qrFullscreen.id}</p>
              <div className="mt-8 flex gap-3 w-full">
                <button
                  onClick={() => downloadTicketPDF({ id: qrFullscreen.id, name: qrFullscreen.name })}
                  className="flex-1 bg-black/5 text-black/70 text-[9px] font-bold tracking-widest uppercase py-3 rounded-xl hover:bg-black/10 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
