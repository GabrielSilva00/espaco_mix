import { motion, AnimatePresence } from 'motion/react';
import {
  Ticket,
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  Lock,
  Minus,
  Plus,
  Users,
  Armchair,
  X,
  Info,
  Coffee,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MAX_TICKETS_PER_ORDER } from '../../shared/constants/app';
import { generateDefaultLayout, getLayoutViewBox } from '../../shared/utils/defaultLayout';

type ActivePanel = 'tickets' | 'tables' | null;

export function BookingView() {
  const {
    activeEvent,
    isPreviewingEvent,
    previewSectors,
    expandedSectorId, setExpandedSectorId,
    singleTickets, setSingleTickets,
    maleTickets, setMaleTickets,
    femaleTickets, setFemaleTickets,
    totalTicketsSelected,
    selectedTables,
    derivedTables,
    getTableStatus,
    toggleTableSelection,
    subTotal,
    taxAmount,
    grandTotal,
    ticketsTotal,
    cartTimeLeft,
    handleCheckout,
    showToast,
  } = useApp();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const selectedTablesData = derivedTables.filter(t => selectedTables.includes(t.id));

  // Lookup array: index 0 = table id 1, used to resolve type/label in cart
  const interactiveLayoutEls = (() => {
    const saved = (activeEvent?.tableLayout ?? []).filter(
      el => el.type === 'round-table' || el.type === 'rect-table' || el.type === 'bistro-table'
    );
    if (saved.length > 0) return saved;
    return generateDefaultLayout(
      activeEvent?.tableConfig?.totalTables ?? 0,
      activeEvent?.tableConfig?.totalBistros ?? 0,
      activeEvent?.tableConfig?.seatsPerTable ?? 4,
    );
  })();

  const isEventActive = activeEvent?.status === 'Vendas liberadas'
    || activeEvent?.status === 'Ativo'
    || isPreviewingEvent;

  const hasTickets = (activeEvent?.batches?.length ?? 0) > 0;
  const hasTables = activeEvent?.hasTables ?? false;
  const hasBistro = (activeEvent?.tableLayout?.some(el => el.type === 'bistro-table') ?? false)
    || (activeEvent?.tableConfig?.totalBistros ?? 0) > 0;

  const ticketMinPrice = previewSectors.length > 0
    ? Math.min(...previewSectors.map(s =>
        activeEvent?.priceType === 'gender'
          ? Math.min(s.priceMale ?? Infinity, s.priceFemale ?? Infinity)
          : (s.price ?? Infinity)
      ))
    : 0;
  const ticketMaxPrice = previewSectors.length > 0
    ? Math.max(...previewSectors.map(s =>
        activeEvent?.priceType === 'gender'
          ? Math.max(s.priceMale ?? 0, s.priceFemale ?? 0)
          : (s.price ?? 0)
      ))
    : 0;

  const tableMinPrice = derivedTables.length > 0
    ? Math.min(...derivedTables.map(t => t.price))
    : 0;

  const togglePanel = (panel: ActivePanel) =>
    setActivePanel(p => p === panel ? null : panel);

  return (
    <>
      {/* Banner do Evento */}
      <section className="relative w-full h-[35vh] md:h-[50vh] bg-[#0d0d0d] overflow-hidden group">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          src={activeEvent?.img || "https://picsum.photos/seed/electronicparty/1920/1080?blur=2"}
          alt="Event Banner"
          className="w-full h-full object-cover brightness-110 contrast-110 group-hover:scale-105 transition-transform duration-[2s] ease-out will-change-transform"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(10,10,10,0.5)_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 max-w-7xl mx-auto pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h1
              className="text-3xl md:text-5xl font-serif text-[#d4af37] tracking-wide font-medium"
              style={{ textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' }}
            >
              {activeEvent?.title || 'Midnight Soirée'}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs tracking-widest uppercase opacity-70">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#d4af37]" />
                {activeEvent?.date
                  ? new Date(activeEvent.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Sáb, 15 Nov, 2026'}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#d4af37]" />
                {activeEvent?.time || '22:00'}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#d4af37]" />
                {activeEvent?.location || 'Villa dEste, S.P.'}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Selection & Booking Area */}
      <div className="max-w-7xl mx-auto px-4 lg:px-10 mt-6 md:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500 mb-24">
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12">

          {/* Left Column */}
          <div className="lg:col-span-8 flex flex-col gap-10 md:gap-16">

            {/* Em breve */}
            {activeEvent?.status === 'Em breve' && !isPreviewingEvent && (
              <section className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-lg font-serif text-blue-300 mb-2">Em breve</h3>
                <p className="text-sm text-white/50">As vendas ainda não foram abertas. Fique de olho para não perder os ingressos!</p>
              </section>
            )}

            {/* Selection Cards + Panels */}
            {isEventActive && (
              <section>
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                  <Ticket className="w-5 h-5 text-[#d4af37]" />
                  <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Selecionar</h2>
                </div>

                {/* Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

                  {/* Card Ingressos */}
                  {hasTickets && (
                    <button
                      onClick={() => togglePanel('tickets')}
                      className={`group relative text-left rounded-2xl border p-4 transition-all duration-300 flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50
                        ${activePanel === 'tickets'
                          ? 'border-[#d4af37]/60 bg-[#d4af37]/5 shadow-[0_0_24px_rgba(212,175,55,0.08)]'
                          : 'border-white/10 bg-[#111] hover:border-[#d4af37]/30 hover:bg-[#d4af37]/[0.02]'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${activePanel === 'tickets' ? 'bg-[#d4af37]/20' : 'bg-white/5 group-hover:bg-[#d4af37]/10'}`}>
                        <Ticket className={`w-5 h-5 transition-colors ${activePanel === 'tickets' ? 'text-[#d4af37]' : 'text-white/50 group-hover:text-[#d4af37]'}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-wide mb-1">Ingressos</h3>
                        <p className="text-xs text-white/40">
                          {previewSectors.length} {previewSectors.length === 1 ? 'categoria disponível' : 'categorias disponíveis'}
                        </p>
                      </div>
                      {ticketMinPrice > 0 && (
                        <div className="mt-auto">
                          <span className="text-[10px] uppercase tracking-widest text-white/30 block mb-0.5">A partir de</span>
                          <span className="text-lg font-serif text-[#d4af37]">
                            R$ {ticketMinPrice.toFixed(2)}
                            {ticketMaxPrice > ticketMinPrice && (
                              <span className="text-sm text-white/30"> – R$ {ticketMaxPrice.toFixed(2)}</span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold transition-colors ${activePanel === 'tickets' ? 'text-[#d4af37]' : 'text-white/30 group-hover:text-white/60'}`}>
                        {activePanel === 'tickets' ? 'Fechar' : 'Ver ingressos'}
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activePanel === 'tickets' ? 'rotate-90' : ''}`} />
                      </div>
                      {totalTicketsSelected > 0 && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d4af37] text-[#0a0a0a] text-[9px] font-black flex items-center justify-center">
                          {totalTicketsSelected}
                        </div>
                      )}
                    </button>
                  )}

                  {/* Card Mesas / Bistrô */}
                  {hasTables && (
                    <button
                      onClick={() => togglePanel('tables')}
                      className={`group relative text-left rounded-2xl border p-4 transition-all duration-300 flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50
                        ${activePanel === 'tables'
                          ? 'border-[#d4af37]/60 bg-[#d4af37]/5 shadow-[0_0_24px_rgba(212,175,55,0.08)]'
                          : 'border-white/10 bg-[#111] hover:border-[#d4af37]/30 hover:bg-[#d4af37]/[0.02]'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${activePanel === 'tables' ? 'bg-[#d4af37]/20' : 'bg-white/5 group-hover:bg-[#d4af37]/10'}`}>
                        {hasBistro ? (
                          <Coffee className={`w-5 h-5 transition-colors ${activePanel === 'tables' ? 'text-amber-400' : 'text-white/50 group-hover:text-amber-400'}`} />
                        ) : (
                          <Armchair className={`w-5 h-5 transition-colors ${activePanel === 'tables' ? 'text-[#d4af37]' : 'text-white/50 group-hover:text-[#d4af37]'}`} />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-wide mb-1">
                          Mesas{hasBistro ? ' / Bistrô' : ''}
                        </h3>
                        <p className="text-xs text-white/40">
                          {derivedTables.filter(t => t.status !== 'reserved').length} disponíveis de {derivedTables.length}
                        </p>
                      </div>
                      {tableMinPrice > 0 && (
                        <div className="mt-auto">
                          <span className="text-[10px] uppercase tracking-widest text-white/30 block mb-0.5">A partir de</span>
                          <span className="text-lg font-serif text-[#d4af37]">R$ {tableMinPrice.toFixed(2)}</span>
                        </div>
                      )}
                      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold transition-colors ${activePanel === 'tables' ? 'text-[#d4af37]' : 'text-white/30 group-hover:text-white/60'}`}>
                        {activePanel === 'tables' ? 'Fechar' : 'Ver mapa'}
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activePanel === 'tables' ? 'rotate-90' : ''}`} />
                      </div>
                      {selectedTables.length > 0 && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d4af37] text-[#0a0a0a] text-[9px] font-black flex items-center justify-center">
                          {selectedTables.length}
                        </div>
                      )}
                    </button>
                  )}
                </div>

                {/* Animated Panels */}
                <AnimatePresence mode="wait">

                  {/* Painel de Ingressos */}
                  {activePanel === 'tickets' && hasTickets && (
                    <motion.div
                      key="tickets-panel"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="bg-[#111] border border-white/5 rounded-3xl p-6">
                        {/* Lotes fechados */}
                        {activeEvent!.batches.filter(b => b.is_active === false).map((batch, bi) => (
                          <div key={batch.id ?? `closed-batch-${bi}`} className="mb-3 flex items-center gap-3 bg-[#0d0d0d] p-4 rounded-xl border border-white/5 opacity-50">
                            <div className="flex-1">
                              <h3 className="text-white/50 font-bold text-base">{batch.name}</h3>
                            </div>
                            <span className="text-[9px] uppercase tracking-widest bg-white/10 text-white/40 px-2.5 py-1 rounded-full border border-white/10 whitespace-nowrap">Fechado</span>
                          </div>
                        ))}

                        {/* Lote ativo */}
                        <div className="mb-6 flex justify-between items-center bg-[#1a1a1a] p-4 rounded-xl border border-white/10">
                          <div>
                            <h3 className="text-[#d4af37] font-bold text-lg">
                              {(activeEvent!.batches.find(b => b.is_active !== false) ?? activeEvent!.batches[0])?.name}
                            </h3>
                            <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">Lote Atual — Inscrições Abertas</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {previewSectors.map((sector, si) => {
                            const isExpanded = expandedSectorId === sector.id;
                            const sectorMinPrice = activeEvent!.priceType === 'gender'
                              ? Math.min(sector.priceMale || Infinity, sector.priceFemale || Infinity)
                              : sector.price;
                            const mockRemaining = Math.floor(Math.random() * 50) + 1;
                            const isEndingSoon = mockRemaining < 20;

                            return (
                              <div
                                key={sector.id ?? `sector-${si}`}
                                className={`bg-[#0a0a0a] border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-[#d4af37]/50 shadow-[0_0_20px_rgba(212,175,55,0.05)]' : 'border-white/5 hover:border-white/20 cursor-pointer'}`}
                              >
                                <div
                                  className="p-5 flex justify-between items-center"
                                  onClick={() => {
                                    if (!isExpanded) {
                                      setExpandedSectorId(sector.id);
                                      setSingleTickets(0);
                                      setMaleTickets(0);
                                      setFemaleTickets(0);
                                    } else {
                                      setExpandedSectorId(null);
                                    }
                                  }}
                                >
                                  <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h3 className="text-base font-semibold text-white">{sector.name}</h3>
                                      {isEndingSoon && (
                                        <span className="text-[9px] uppercase tracking-widest bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 whitespace-nowrap animate-pulse">
                                          Últimos
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-white/40 line-clamp-1">
                                      {isExpanded ? 'Inclui acesso à área selecionada.' : 'Selecione para ver opções'}
                                    </p>
                                  </div>
                                  <div className="text-right flex items-center gap-4 shrink-0">
                                    <div>
                                      <span className="text-[10px] uppercase tracking-widest text-white/50 block mb-0.5">A partir de</span>
                                      <span className="text-lg font-display text-[#d4af37]">
                                        R$ {sectorMinPrice !== Infinity ? sectorMinPrice.toFixed(2) : '0.00'}
                                      </span>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 text-white/30 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-[#d4af37]' : ''}`} />
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="px-5 pb-5 pt-2 flex flex-col gap-4 border-t border-white/10 bg-[#111]"
                                    >
                                      {activeEvent?.priceType === 'gender' ? (
                                        <>
                                          <div className="flex justify-between items-center py-3">
                                            <div>
                                              <span className="text-sm font-semibold text-white">Ingresso Masculino</span>
                                              <div className="text-[#d4af37] font-display text-base mt-0.5">
                                                R$ {(sector.priceMale || 0).toFixed(2)}
                                                <span className="text-[10px] text-white/40 font-sans tracking-widest"> + taxa</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                              <button onClick={(e) => { e.stopPropagation(); setMaleTickets(Math.max(0, maleTickets - 1)); }} disabled={maleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4" /></button>
                                              <span className="w-5 text-center text-sm font-bold text-white">{maleTickets}</span>
                                              <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setMaleTickets(maleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4" /></button>
                                            </div>
                                          </div>
                                          <div className="flex justify-between items-center py-3 border-t border-white/5">
                                            <div>
                                              <span className="text-sm font-semibold text-white">Ingresso Feminino</span>
                                              <div className="text-[#d4af37] font-display text-base mt-0.5">
                                                R$ {(sector.priceFemale || 0).toFixed(2)}
                                                <span className="text-[10px] text-white/40 font-sans tracking-widest"> + taxa</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                              <button onClick={(e) => { e.stopPropagation(); setFemaleTickets(Math.max(0, femaleTickets - 1)); }} disabled={femaleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4" /></button>
                                              <span className="w-5 text-center text-sm font-bold text-white">{femaleTickets}</span>
                                              <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setFemaleTickets(femaleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4" /></button>
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex justify-between items-center py-3">
                                          <div>
                                            <span className="text-sm font-semibold text-white">Ingresso {sector.name}</span>
                                            <div className="text-[#d4af37] font-display text-base mt-0.5">
                                              R$ {(sector.price || 0).toFixed(2)}
                                              <span className="text-[10px] text-white/40 font-sans tracking-widest"> + taxa</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                            <button onClick={(e) => { e.stopPropagation(); setSingleTickets(Math.max(0, singleTickets - 1)); }} disabled={singleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4" /></button>
                                            <span className="w-5 text-center text-sm font-bold text-white">{singleTickets}</span>
                                            <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setSingleTickets(singleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4" /></button>
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Painel de Mesas / Bistrô */}
                  {activePanel === 'tables' && hasTables && (
                    <motion.div
                      key="tables-panel"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="space-y-6 flex flex-col p-1 border border-[#ffffff1a] bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] rounded-[1.5rem]">
                        <div className="pt-8 pb-8 pr-8 pl-[17px]">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                            <div>
                              <h2 className="text-xl font-serif text-[#d4af37] mb-2">Mapa do Evento</h2>
                              <p className="text-[10px] opacity-50 uppercase tracking-widest">Selecione sua mesa ou bistrô</p>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap text-[10px] uppercase opacity-60 tracking-widest">
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-[#C9A84C]" />
                                Livre
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-3 h-3 text-[#555]" />
                                Reservada
                              </div>
                              {hasBistro && (
                                <div className="flex items-center gap-1.5">
                                  <svg width="12" height="12" viewBox="-2 -2 44 44" style={{ display: 'block', flexShrink: 0 }}>
                                    <circle cx="20" cy="20" r="20" fill="#8B4513" stroke="#C9A84C" strokeWidth="3" />
                                  </svg>
                                  Bistrô
                                </div>
                              )}
                            </div>
                          </div>

                          {/* SVG Map */}
                          {(() => {
                            const rawLayout = activeEvent?.tableLayout ?? [];
                            const interactiveElements = rawLayout.filter(
                              el => el.type === 'round-table' || el.type === 'rect-table' || el.type === 'bistro-table'
                            );
                            const hasLayout = interactiveElements.length > 0;

                            // Fallback to reference layout when none saved
                            const totalT = activeEvent?.tableConfig?.totalTables ?? 30;
                            const totalB = activeEvent?.tableConfig?.totalBistros ?? 10;
                            const seats = activeEvent?.tableConfig?.seatsPerTable ?? 4;
                            const displayElements = hasLayout
                              ? rawLayout
                              : generateDefaultLayout(totalT, totalB, seats);
                            const tableElements = hasLayout
                              ? interactiveElements
                              : displayElements.filter(el => el.type === 'rect-table' || el.type === 'bistro-table');

                            const viewBox = getLayoutViewBox(displayElements);
                            const [,, vbW, vbH] = viewBox.split(' ').map(Number);

                            return hasTables ? (
                            <div
                              className="relative w-full max-w-3xl mx-auto bg-[#111111] rounded-2xl border border-[#2a2a2a] overflow-x-hidden"
                              style={{ minHeight: 300 }}
                            >
                              <div className="overflow-x-auto overflow-y-auto w-full" style={{ maxHeight: 520 }}>
                                <svg
                                  viewBox={viewBox}
                                  style={{ display: 'block', width: '100%', minWidth: 320, minHeight: 300 }}
                                  preserveAspectRatio="xMidYMin meet"
                                >
                                  <defs>
                                    <pattern id="mapGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                      <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.03)" />
                                    </pattern>
                                  </defs>
                                  <rect width={vbW} height={vbH} fill="#111111" />
                                  <rect width={vbW} height={vbH} fill="url(#mapGrid)" />

                                  {/* Palco — fiel ao SVG original */}
                                  <text x={vbW / 2} y="50" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="10" letterSpacing="3">ÁREA DE CARGA E DESCARGA</text>
                                  <rect x="50" y="70" width="650" height="150" fill="#1a1a1a" stroke="#C9A84C" strokeWidth="2" />
                                  <text x="375" y="157" textAnchor="middle" fill="#C9A84C" fontSize="26" fontWeight="bold" letterSpacing="8" opacity="0.85">PALCO</text>
                                  <rect x="50" y="160" width="75" height="60" fill="#151515" stroke="#C9A84C" strokeWidth="1.5" opacity="0.75" />
                                  <line x1="50" y1="175" x2="125" y2="175" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />
                                  <line x1="50" y1="190" x2="125" y2="190" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />
                                  <line x1="50" y1="205" x2="125" y2="205" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />

                                  {/* Decorative non-table elements (entry/exit) */}
                                  {displayElements
                                    .filter(el => el.type !== 'round-table' && el.type !== 'rect-table' && el.type !== 'bistro-table')
                                    .map(el => (
                                      <g key={el.id}>
                                        <rect x={el.x} y={el.y} width={el.width} height={el.height} rx="6" fill={el.color} opacity="0.7" />
                                        <text x={el.x + el.width / 2} y={el.y + el.height / 2 + 4} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11">{el.label}</text>
                                      </g>
                                    ))}

                                  {/* Mesas e Bistrôs interativos */}
                                  {tableElements.map((el, i) => {
                                    const tableNum = i + 1;
                                    const isBistro = el.type === 'bistro-table';
                                    const tableData = derivedTables.find(t => t.id === tableNum);
                                    const status = tableData ? getTableStatus(tableNum, tableData.status) : 'available';
                                    const isReserved = status === 'reserved';
                                    const isSelected = status === 'selected';
                                    const cx = el.x + el.width / 2;
                                    const cy = el.y + el.height / 2;

                                    // Display sizes independent of stored el.width/height
                                    const half = isBistro ? 14 : 17;
                                    const cs = isBistro ? 0 : 7;
                                    const gap = isBistro ? 0 : 3;

                                    const tampoFill = isReserved ? '#3a3a3a' : isSelected ? '#f5c842' : '#C9A84C';
                                    const bistroFill = isReserved ? '#3a3a3a' : isSelected ? '#a0450f' : '#8B4513';
                                    const chairFill = isReserved ? '#2a2a2a' : '#4a4a4a';
                                    const strokeColor = isReserved ? '#333' : isSelected ? '#f5c842' : '#C9A84C66';
                                    const labelFill = isReserved ? '#555' : isBistro ? '#C9A84C' : '#1a1a1a';
                                    const labelNum = el.label || String(tableNum).padStart(2, '0');

                                    return (
                                      <g
                                        key={el.id}
                                        onClick={() => { if (!isReserved && tableData) toggleTableSelection(tableNum, tableData.status); }}
                                        style={{ cursor: isReserved ? 'not-allowed' : 'pointer' }}
                                        opacity={isReserved ? 0.6 : 1}
                                      >
                                        <title>
                                          {isBistro ? 'Bistrô' : 'Mesa'} {labelNum} • {tableData?.capacity ?? el.capacity ?? (isBistro ? 2 : 4)} pessoas • R$ {(tableData?.price ?? 0).toFixed(2)}{isReserved ? ' • Reservada' : isSelected ? ' • Selecionada' : ' • Livre'}
                                        </title>

                                        {/* Hover highlight */}
                                        {!isReserved && (
                                          <circle
                                            cx={cx} cy={cy} r={half + 8}
                                            fill="rgba(201,168,76,0)"
                                            className="transition-all duration-200"
                                            style={{ pointerEvents: 'none' }}
                                          />
                                        )}

                                        {isBistro ? (
                                          <>
                                            <circle cx={cx} cy={cy} r={half} fill={bistroFill} stroke={isReserved ? '#333' : '#C9A84C'} strokeWidth={isSelected ? 3 : 2} />
                                            {isSelected && (
                                              <circle cx={cx} cy={cy} r={half} fill="none" stroke="#f5c842" strokeWidth="3">
                                                <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
                                              </circle>
                                            )}
                                            {isReserved
                                              ? <text x={cx} y={cy + 5} textAnchor="middle" dominantBaseline="middle" fontSize="16" fill="#555">🔒</text>
                                              : <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={labelFill}>{labelNum}</text>
                                            }
                                          </>
                                        ) : (
                                          <>
                                            <rect x={cx - cs/2} y={cy - half - gap - cs} width={cs} height={cs} rx="1" fill={chairFill} />
                                            <rect x={cx - cs/2} y={cy + half + gap} width={cs} height={cs} rx="1" fill={chairFill} />
                                            <rect x={cx - half - gap - cs} y={cy - cs/2} width={cs} height={cs} rx="1" fill={chairFill} />
                                            <rect x={cx + half + gap} y={cy - cs/2} width={cs} height={cs} rx="1" fill={chairFill} />
                                            <rect x={cx - half} y={cy - half} width={half*2} height={half*2} rx="4" fill={tampoFill} stroke={strokeColor} strokeWidth="2" />
                                            {isSelected && (
                                              <rect x={cx - half} y={cy - half} width={half*2} height={half*2} rx="4" fill="none" stroke="#f5c842" strokeWidth="2.5">
                                                <animate attributeName="stroke-opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite" />
                                              </rect>
                                            )}
                                            {isReserved
                                              ? <text x={cx} y={cy + 5} textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#555">🔒</text>
                                              : <text x={cx} y={cy + 4} textAnchor="middle" fontSize={Math.max(9, Math.round(half * 0.55))} fontWeight="bold" fill={labelFill}>{labelNum}</text>
                                            }
                                          </>
                                        )}
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            </div>
                            ) : null;
                          })()}

                          {/* Grade fallback — só quando não há hasTables */}
                          {!hasTables && (
                            /* Grid Fallback */
                            <div className="relative w-full max-w-3xl mx-auto bg-[#0d0d0d] rounded-2xl border border-[#ffffff0a] flex flex-col text-center">
                              <div className="w-full flex-1 flex flex-col items-center justify-center pt-8 pb-6 px-1 md:px-4 min-h-[350px]">
                                <div className="w-[120px] md:w-[200px] h-4 bg-[#d4af37] rounded-b-lg opacity-20 text-[8px] flex items-center justify-center tracking-[1em] uppercase absolute top-0 text-[#0a0a0a] font-bold">
                                  Palco
                                </div>
                                {(() => {
                                  const gridCols = activeEvent?.tableConfig?.gridCols || 5;
                                  const totalTables = derivedTables.length;
                                  const isVeryDense = totalTables > 40 || gridCols >= 7;
                                  const isDense = !isVeryDense && (totalTables > 20 || gridCols >= 5);
                                  const tableBaseSize = isVeryDense ? 'w-[22px] h-[22px] md:w-9 md:h-9' : isDense ? 'w-7 h-7 md:w-11 md:h-11' : 'w-9 h-9 md:w-14 md:h-14';
                                  const chairHBaseSizeX = isVeryDense ? 'w-2 h-1 md:w-3 md:h-1.5' : isDense ? 'w-[10px] h-1 md:w-4 md:h-2' : 'w-3 h-1.5 md:w-5 md:h-2.5';
                                  const chairVBaseSizeY = isVeryDense ? 'w-1 h-2 md:w-1.5 md:h-3' : isDense ? 'w-1 h-[10px] md:w-2 md:h-4' : 'w-1.5 h-3 md:w-2.5 md:h-5';
                                  const offsetY = isVeryDense ? '-top-[3px] md:-top-[6px]' : isDense ? '-top-[4px] md:-top-[8px]' : '-top-[6px] md:-top-[10px]';
                                  const offsetB = isVeryDense ? '-bottom-[3px] md:-bottom-[6px]' : isDense ? '-bottom-[4px] md:-bottom-[8px]' : '-bottom-[6px] md:-bottom-[10px]';
                                  const offsetL = isVeryDense ? '-left-[3px] md:-left-[6px]' : isDense ? '-left-[4px] md:-left-[8px]' : '-left-[6px] md:-left-[10px]';
                                  const offsetR = isVeryDense ? '-right-[3px] md:-right-[6px]' : isDense ? '-right-[4px] md:-right-[8px]' : '-right-[6px] md:-right-[10px]';
                                  const gaps = isVeryDense ? 'gap-x-3 gap-y-4 md:gap-x-5 md:gap-y-6' : isDense ? 'gap-x-4 gap-y-5 md:gap-x-6 md:gap-y-8' : 'gap-x-5 gap-y-7 md:gap-x-8 md:gap-y-10';
                                  const labelSize = isVeryDense ? 'text-[5px] md:text-[8px]' : isDense ? 'text-[7px] md:text-[10px]' : 'text-[9px] md:text-[11px]';
                                  const labelIconSize = isVeryDense ? 'w-[8px] h-[8px] md:w-[12px] md:h-[12px]' : isDense ? 'w-[10px] h-[10px] md:w-[14px] md:h-[14px]' : 'w-3 h-3 md:w-4 md:h-4';
                                  const txtSize = isVeryDense ? 'text-[6px] md:text-[10px]' : isDense ? 'text-[8px] md:text-[10px]' : 'text-[10px] md:text-[12px]';
                                  return (
                                    <div
                                      className={`grid w-full px-8 md:px-12 justify-items-center mt-20 mb-10 ${gaps}`}
                                      style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                                    >
                                      {derivedTables.map((table, index) => {
                                        const status = getTableStatus(table.id, table.status);
                                        const category = index < totalTables / 2 ? 'VIP' : 'Standard';
                                        const categoryColor = category === 'VIP' ? 'bg-[#d4af37] text-black' : 'bg-white/20 text-white';
                                        const isFirstInRow = index % gridCols === 0;
                                        const isLastInRow = index % gridCols === gridCols - 1;
                                        const tooltipPos = isFirstInRow ? "-left-2" : isLastInRow ? "-right-2" : "left-1/2 -translate-x-1/2";
                                        const arrowPos = isFirstInRow ? "ml-6" : isLastInRow ? "mr-6 ml-auto" : "mx-auto";
                                        const chairBaseColor = status === 'available' ? (category === 'VIP' ? 'bg-[#d4af37]/40 group-hover:bg-[#d4af37]/80' : 'bg-[#e5e5e5]/40 group-hover:bg-[#e5e5e5]/80') : status === 'selected' ? 'bg-[#d4af37]/60 group-hover:bg-[#d4af37] shadow-[0_0_5px_rgba(212,175,55,0.3)]' : 'bg-[#222]';
                                        return (
                                          <div key={table.id} className="flex flex-col items-center gap-2 md:gap-4 relative group">
                                            <div className={`absolute -top-16 ${tooltipPos} opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50`}>
                                              <div className="bg-[#111] border border-[#ffffff1a] rounded-lg p-2.5 shadow-2xl flex flex-col items-center gap-1 w-[120px]">
                                                <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${categoryColor}`}>{category}</div>
                                                <div className="text-white text-xs font-bold leading-none mt-1">Mesa {table.id < 10 ? `0${table.id}` : table.id}</div>
                                                <div className="text-[10px] text-[#d4af37] font-display">R$ {table.price.toFixed(2)}</div>
                                              </div>
                                              <div className={`w-2 h-2 bg-[#111] border-b border-r border-[#ffffff1a] rotate-45 -mt-[5px] ${arrowPos}`} />
                                            </div>
                                            <motion.button
                                              whileHover={status === 'available' ? { scale: 1.12 } : {}}
                                              whileTap={status === 'available' ? { scale: 0.95 } : {}}
                                              onClick={() => toggleTableSelection(table.id, table.status)}
                                              disabled={table.status === 'reserved'}
                                              className={`relative flex items-center justify-center ${tableBaseSize} transition-colors duration-300 ${status === 'selected' ? 'scale-110' : ''} ${status === 'reserved' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                            >
                                              <div className={`absolute ${offsetY} left-1/2 -translate-x-1/2 ${chairHBaseSizeX} rounded-t-full transition-all duration-300 ${chairBaseColor}`} />
                                              <div className={`absolute ${offsetB} left-1/2 -translate-x-1/2 ${chairHBaseSizeX} rounded-b-full transition-all duration-300 ${chairBaseColor}`} />
                                              <div className={`absolute top-1/2 ${offsetL} -translate-y-1/2 ${chairVBaseSizeY} rounded-l-full transition-all duration-300 ${chairBaseColor}`} />
                                              <div className={`absolute top-1/2 ${offsetR} -translate-y-1/2 ${chairVBaseSizeY} rounded-r-full transition-all duration-300 ${chairBaseColor}`} />
                                              <div className={`relative z-10 w-full h-full rounded-full flex items-center justify-center border-2 transition-all duration-300 ${status === 'available' ? (category === 'VIP' ? 'border-[#d4af37]/50 bg-[#d4af3708] shadow-[0_0_10px_rgba(212,175,55,0.1)] group-hover:bg-[#d4af371a] group-hover:border-[#d4af37]' : 'border-white/20 bg-white/5 group-hover:border-white/50 group-hover:bg-white/10') : ''} ${status === 'selected' ? 'border-[#d4af37]/60 bg-[#d4af37]/80 shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:border-white group-hover:bg-[#d4af37] group-hover:shadow-[0_0_30px_rgba(212,175,55,0.9)]' : ''} ${status === 'reserved' ? 'border-[#333] bg-[#1a1a1a]' : ''}`}>
                                                {status === 'reserved' ? (
                                                  <Lock className={`${labelIconSize} text-[#555]`} />
                                                ) : (
                                                  <span className={`font-serif ${txtSize} font-bold transition-colors duration-300 ${status === 'selected' ? 'text-[#0a0a0a]/60 group-hover:text-[#0a0a0a]' : (category === 'VIP' ? 'text-[#d4af37] group-hover:text-[#fde68a]' : 'text-neutral-400 group-hover:text-white')}`}>
                                                    {table.id < 10 ? `0${table.id}` : table.id}
                                                  </span>
                                                )}
                                              </div>
                                            </motion.button>
                                            <div className={`flex items-center gap-1 md:gap-1.5 ${labelSize} uppercase tracking-[0.2em] transition-opacity duration-300 ${status === 'available' ? (category === 'VIP' ? 'text-[#d4af37] opacity-60' : 'text-neutral-400 opacity-60') : status === 'selected' ? 'text-white opacity-100 font-bold' : 'text-neutral-500 opacity-40'}`}>
                                              <Users className={labelIconSize} />
                                              <span>{table.capacity} <span className="hidden sm:inline">P</span></span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Detalhes do Evento */}
            <section className="mt-8 md:mt-12 bg-[#0f0f0f] border border-white/5 rounded-[1.5rem] p-6 md:p-10 mb-8">
              <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                <Info className="w-5 h-5 text-[#d4af37]" />
                <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Detalhes do Evento</h2>
              </div>
              <div className="space-y-8">
                {activeEvent?.description && (
                  <div>
                    <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-3">Sobre</h3>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{activeEvent.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex gap-4">
                    <Calendar className="w-5 h-5 text-white/40" />
                    <div>
                      <h3 className="text-[10px] tracking-widests text-[#d4af37] uppercase mb-1">Data e Hora</h3>
                      <p className="text-sm text-white/70">
                        {new Date(activeEvent?.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} {activeEvent?.time ? `às ${activeEvent.time}` : ''}
                      </p>
                    </div>
                  </div>
                  {activeEvent?.location && (
                    <div className="flex gap-4">
                      <MapPin className="w-5 h-5 text-white/40" />
                      <div>
                        <h3 className="text-[10px] tracking-widests text-[#d4af37] uppercase mb-1">Localização</h3>
                        <p className="text-sm text-white/70">{activeEvent.location}</p>
                      </div>
                    </div>
                  )}
                  {activeEvent?.ageRating && (
                    <div className="flex gap-4">
                      <Users className="w-5 h-5 text-white/40" />
                      <div>
                        <h3 className="text-[10px] tracking-widests text-[#d4af37] uppercase mb-1">Classificação</h3>
                        <p className="text-sm text-white/70">{activeEvent.ageRating}</p>
                      </div>
                    </div>
                  )}
                  {activeEvent?.posLocations && (
                    <div className="flex gap-4">
                      <Ticket className="w-5 h-5 text-white/40" />
                      <div>
                        <h3 className="text-[10px] tracking-widests text-[#d4af37] uppercase mb-1">Pontos Físicos</h3>
                        <p className="text-sm text-white/70">{activeEvent.posLocations}</p>
                      </div>
                    </div>
                  )}
                </div>
                {activeEvent?.importantNotes && (
                  <div className="bg-[#d4af37]/5 border border-[#d4af37]/10 p-5 rounded-xl">
                    <h3 className="text-[10px] tracking-widests text-[#d4af37] uppercase mb-3">Observações</h3>
                    <p className="text-sm text-[#d4af37]/80 leading-relaxed whitespace-pre-wrap">{activeEvent.importantNotes}</p>
                  </div>
                )}
                {activeEvent?.entryRules && (
                  <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-xl">
                    <h3 className="text-[10px] tracking-widests text-red-400 uppercase mb-3">Avisos e Regras</h3>
                    <p className="text-sm text-red-400/80 leading-relaxed whitespace-pre-wrap">{activeEvent.entryRules}</p>
                  </div>
                )}
              </div>
            </section>

            {/* FAQ */}
            <section className="bg-transparent mb-8">
              <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <Info className="w-5 h-5 text-[#d4af37]" />
                <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Informações Úteis / FAQ</h2>
              </div>
              <div className="space-y-3">
                <details className="bg-[#111] border border-[#ffffff0a] rounded-2xl group hover:border-white/20 transition-all cursor-pointer">
                  <summary className="flex justify-between items-center p-5 list-none font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded-xxl tracking-wide text-sm [::-webkit-details-marker]:hidden">
                    Posso transferir meu ingresso?
                    <ChevronRight className="w-5 h-5 text-white/30 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-xs text-white/40 leading-relaxed border-t border-white/5 pt-3">
                    Sim, a transferência de titularidade pode ser feita pelo app do Espaço Mix até 24h antes do evento. Apenas um repasse é permitido por ingresso.
                  </div>
                </details>
                <details className="bg-[#111] border border-[#ffffff0a] rounded-2xl group hover:border-white/20 transition-all cursor-pointer">
                  <summary className="flex justify-between items-center p-5 list-none font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded-xxl tracking-wide text-sm [::-webkit-details-marker]:hidden">
                    Qual a política de cancelamento?
                    <ChevronRight className="w-5 h-5 text-white/30 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-xs text-white/40 leading-relaxed border-t border-white/5 pt-3">
                    Conforme o CDC, você pode cancelar a compra em até 7 dias após o pedido, desde que falte mais de 48h para o evento.
                  </div>
                </details>
                <details className="bg-[#111] border border-[#ffffff0a] rounded-2xl group hover:border-white/20 transition-all cursor-pointer">
                  <summary className="flex justify-between items-center p-5 list-none font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded-xxl tracking-wide text-sm [::-webkit-details-marker]:hidden">
                    Quais os métodos de pagamento?
                    <ChevronRight className="w-5 h-5 text-white/30 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-xs text-white/40 leading-relaxed border-t border-white/5 pt-3">
                    Aceitamos Pix (com aprovação imediata), Cartão de Crédito em até 12x e Apple Pay mediante stripe checkout.
                  </div>
                </details>
              </div>
            </section>
          </div>

          {/* Right Column: Resumo */}
          <div className={`lg:col-span-4 flex flex-col ${activeEvent?.status === 'Em breve' && !isPreviewingEvent ? 'hidden' : ''}`}>
            <div className="sticky top-24 flex flex-col gap-8">
              <div className="flex-1 flex flex-col">
                <h2 className="text-[10px] tracking-[0.2em] uppercase text-[#d4af37] mb-6">Detalhes do Pedido</h2>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex-1 flex flex-col">
                  <div className="space-y-4 flex-1">
                    {selectedTables.length === 0 && singleTickets === 0 && maleTickets === 0 && femaleTickets === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center space-y-4 opacity-70">
                        <div className="w-16 h-16 rounded-full border border-white/20 bg-white/5 flex items-center justify-center">
                          <Ticket className="w-6 h-6 text-white/50" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-widests text-[#e5e5e5] font-bold mb-1">Seu carrinho está vazio</p>
                          <p className="text-[10px] text-white/50 max-w-[200px] mx-auto">Adicione ingressos ou mesas para continuar</p>
                        </div>
                      </div>
                    ) : (
                      <AnimatePresence>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0">
                          {activeEvent?.priceType === 'gender' ? (
                            <>
                              {maleTickets > 0 && (
                                <div className="flex justify-between items-center py-4 border-b border-white/10 group">
                                  <div className="flex items-start flex-col gap-1">
                                    <span className="text-[11px] uppercase opacity-60 tracking-wider">Masc: {previewSectors[0]?.name || 'Pista'}</span>
                                    <span className="text-xs text-[#d4af37] font-bold">{maleTickets}x Ingressos</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-display">R$ {(maleTickets * (previewSectors[0]?.priceMale || 0)).toFixed(2)}</span>
                                    <button onClick={() => setMaleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              )}
                              {femaleTickets > 0 && (
                                <div className="flex justify-between items-center py-4 border-b border-white/10 group">
                                  <div className="flex items-start flex-col gap-1">
                                    <span className="text-[11px] uppercase opacity-60 tracking-wider">Fem: {previewSectors[0]?.name || 'Pista'}</span>
                                    <span className="text-xs text-[#d4af37] font-bold">{femaleTickets}x Ingressos</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-display">R$ {(femaleTickets * (previewSectors[0]?.priceFemale || 0)).toFixed(2)}</span>
                                    <button onClick={() => setFemaleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            singleTickets > 0 && (
                              <div className="flex justify-between items-center py-4 border-b border-white/10 group">
                                <div className="flex items-start flex-col gap-1">
                                  <span className="text-[11px] uppercase opacity-60 tracking-wider">{previewSectors[0]?.name || 'Entrada Pista'}</span>
                                  <span className="text-xs text-[#d4af37] font-bold">{singleTickets}x Ingressos</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-display">R$ {ticketsTotal.toFixed(2)}</span>
                                  <button onClick={() => setSingleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4" /></button>
                                </div>
                              </div>
                            )
                          )}
                          {selectedTablesData.map((table) => {
                            const layoutEl = interactiveLayoutEls[table.id - 1];
                            const itemIsBistro = layoutEl?.type === 'bistro-table';
                            const itemLabel = layoutEl?.label ?? String(table.id).padStart(2, '0');
                            return (
                            <div key={table.id} className="flex justify-between items-center py-4 border-b border-white/10 group">
                              <div className="flex items-start flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  {itemIsBistro && (
                                    <svg width="10" height="10" viewBox="-2 -2 44 44" style={{ display: 'block', flexShrink: 0 }}>
                                      <circle cx="20" cy="20" r="20" fill="#8B4513" stroke="#C9A84C" strokeWidth="4" />
                                    </svg>
                                  )}
                                  <span className="text-[11px] uppercase opacity-60 tracking-wider">
                                    {itemIsBistro ? `Bistrô ${itemLabel}` : `Mesa #${itemLabel}`}
                                  </span>
                                </div>
                                <span className="text-xs text-[#d4af37] font-bold">{table.capacity} {itemIsBistro ? 'Pessoas' : 'Pessoas'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-display">R$ {table.price.toFixed(2)}</span>
                                <button onClick={() => toggleTableSelection(table.id, table.status)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>

                  {cartTimeLeft !== null && cartTimeLeft > 0 && (
                    <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 p-3 rounded-lg my-4 flex items-center justify-between">
                      <span className="text-[10px] text-[#d4af37] uppercase tracking-widests font-bold">Reserva Temporária</span>
                      <span className="text-[#d4af37] font-mono font-bold">
                        {Math.floor(cartTimeLeft / 60000).toString().padStart(2, '0')}:
                        {Math.floor((cartTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-[11px] uppercase tracking-widests">Subtotal</span>
                      <span className="text-sm font-serif text-white">R$ {subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-[11px] uppercase tracking-widests">Taxa de conveniência (10%)</span>
                      <span className="text-sm font-serif text-white">R$ {taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                      <span className="text-[11px] uppercase opacity-80 tracking-widests font-bold text-[#d4af37]">Total</span>
                      <span className="text-2xl font-serif text-[#d4af37]">
                        <span className="opacity-50 mr-2 text-lg">R$</span>
                        {grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={grandTotal === 0}
                  className="w-full bg-[#d4af37] text-[#0a0a0a] py-5 mt-6 rounded-xl font-black uppercase tracking-widests text-[11px] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
                >
                  Ir para Pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
