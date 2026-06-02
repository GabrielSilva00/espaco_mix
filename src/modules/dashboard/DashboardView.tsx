import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scanner } from '@yudiel/react-qr-scanner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Calendar, MapPin, Users, ChevronRight, ChevronDown, Check, X,
  Plus, Minus, AlertCircle, ShieldAlert, ScanLine, Edit2, Activity,
  DollarSign, TrendingUp, Filter, Search, Download, Mail, StopCircle,
  QrCode, User, ShieldCheck, RefreshCcw,
  ArrowLeft, Info, Trash2, UploadCloud, Square, UserCog,
  Link as LinkIcon, BarChart3, Code2, Layers, AlertTriangle, Info as InfoIcon, Trash,
} from 'lucide-react';
import type { Batch } from '../../types';
import { useApp } from '../../context/AppContext';
import { ProducerOnboardingFlow } from '../../components/ProducerOnboardingFlow';
import { ProducerDashboard } from '../../components/ProducerDashboard';
import { ApprovalQueue } from '../../components/ApprovalQueue';
import { AdminSettings } from '../../components/AdminSettings';
import { DeveloperPanel } from '../../components/DeveloperPanel';
import { TableLayoutEditor } from '../../components/TableLayoutEditor';
import { downloadPDFList } from '../../shared/utils/pdf';
import { generateDefaultLayout, getLayoutViewBox } from '../../shared/utils/defaultLayout';
import { isEventPast } from '../../shared/utils/eventMapper';
import type { Event, Buyer, Reservation } from '../../types';

// ─── Admin Overview ────────────────────────────────────────────
function AdminOverviewPanel({ events, buyers, reservations }: { events: Event[]; buyers: Buyer[]; reservations: Reservation[] }) {
  const totalRevenue = reservations.reduce((s, r) => s + (r.total || 0), 0);
  const activeEvents = events.filter(e => e.status === 'Ativo' || e.status === 'Vendas liberadas').length;
  const soldTickets = reservations.filter(r => r.paymentStatus === 'approved' || (r as any).payment_status === 'approved').length;
  const checkedInCount = buyers.filter(b => b.checkedIn).length;
  const occupancyRate = soldTickets > 0 ? Math.round((checkedInCount / soldTickets) * 100) : 0;

  const last5Sales = [...reservations]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleString('pt-BR', { month: 'short' });
    const count = reservations.filter(r => {
      if (!r.createdAt) return false;
      const rd = new Date(r.createdAt);
      return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
    }).length;
    return { label, count };
  });
  const maxCount = Math.max(...months.map(m => m.count), 1);

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-[#d4af37]" />
        <h1 className="text-2xl font-serif text-[#d4af37]">Dashboard</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Eventos Ativos', value: activeEvents, icon: <Calendar className="w-5 h-5" />, color: 'text-blue-400' },
          { label: 'Total Eventos', value: events.length, icon: <Layers className="w-5 h-5" />, color: 'text-purple-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-5">
            <div className={`mb-3 ${kpi.color}`}>{kpi.icon}</div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico simples de vendas por mês */}
      <div className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-4">Reservas — Últimos 6 Meses</p>
        <div className="flex items-end gap-3 h-32">
          {months.map(m => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                <div
                  className="w-full bg-[#d4af37]/70 rounded-t-md transition-all"
                  style={{ height: `${(m.count / maxCount) * 80}px`, minHeight: m.count > 0 ? '4px' : '0' }}
                />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-white/30">{m.label}</span>
              <span className="text-[10px] font-bold text-white/60">{m.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de eventos */}
      <div className="bg-[#0d0d0d] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Últimas 5 Vendas</p>
        </div>
        <div className="divide-y divide-white/5">
          {last5Sales.map(r => {
            const evt = events.find(e => e.id === r.eventId || e.id === (r as any).event_id);
            return (
              <div key={r.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.buyerName || (r as any).buyer_name || '—'}</p>
                  <p className="text-[10px] text-white/30 mt-0.5 truncate">{evt?.title || `Evento #${r.eventId || (r as any).event_id}`}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#d4af37]">{(r.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p className="text-[9px] text-white/30 mt-0.5">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            );
          })}
          {last5Sales.length === 0 && (
            <div className="px-6 py-10 text-center text-[10px] uppercase tracking-widest text-white/20">Nenhuma venda registrada</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dev Overview ──────────────────────────────────────────────
const LOG_LEVEL_COLORS = { error: 'text-red-400 border-red-500/20 bg-red-500/5', warn: 'text-amber-400 border-amber-500/20 bg-amber-500/5', info: 'text-blue-400 border-blue-500/20 bg-blue-500/5' };

function DevOverviewPanel({ events, buyers, reservations, systemLogs, clearSystemLogs }: {
  events: Event[]; buyers: Buyer[]; reservations: Reservation[];
  systemLogs: { id: string; level: 'error' | 'warn' | 'info'; message: string; time: Date }[];
  clearSystemLogs: () => void;
}) {
  const [logFilter, setLogFilter] = React.useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [logSearch, setLogSearch] = React.useState('');

  const totalRevenue = reservations.reduce((s, r) => s + (r.total || 0), 0);
  const devFee = totalRevenue * 0.05;
  const activeEvents = events.filter(e => e.status === 'Ativo' || e.status === 'Vendas liberadas').length;

  const filteredLogs = systemLogs
    .filter(l => logFilter === 'all' || l.level === logFilter)
    .filter(l => !logSearch || l.message.toLowerCase().includes(logSearch.toLowerCase()));

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Code2 className="w-6 h-6 text-[#d4af37]" />
        <h1 className="text-2xl font-serif text-[#d4af37]">Painel do Desenvolvedor</h1>
      </div>

      {/* Estatísticas do site */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Eventos Ativos', value: activeEvents, color: 'text-green-400' },
          { label: 'Total Eventos', value: events.length, color: 'text-blue-400' },
          { label: 'Usuários', value: buyers.length, color: 'text-purple-400' },
          { label: 'Reservas', value: reservations.length, color: 'text-[#d4af37]' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-5">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Receita */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#d4af37]" />
            <span className="text-[10px] uppercase tracking-widest text-white/40">Receita do Site</span>
          </div>
          <p className="text-3xl font-bold text-[#d4af37]">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-[#0d0d0d] border border-[#d4af37]/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#d4af37]" />
            <span className="text-[10px] uppercase tracking-widest text-white/40">Taxa Dev (5%)</span>
          </div>
          <p className="text-3xl font-bold text-[#d4af37]">{devFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-[#0d0d0d] border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Logs do Sistema ({filteredLogs.length})</p>
          <button onClick={clearSystemLogs} className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-red-400 hover:text-red-300 transition">
            <Trash className="w-3 h-3" /> Limpar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'error', 'warn', 'info'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest font-bold transition ${logFilter === f ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'text-white/30 hover:text-white/60'}`}
              >
                {f === 'all' ? 'Todos' : f === 'error' ? 'Erros' : f === 'warn' ? 'Avisos' : 'Info'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
            <input
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Filtrar logs..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="px-6 py-10 text-center text-[10px] uppercase tracking-widest text-white/20">Nenhum log registrado</div>
          ) : filteredLogs.map(log => (
            <div key={log.id} className={`px-6 py-3 flex gap-3 items-start border-l-2 ${LOG_LEVEL_COLORS[log.level]}`}>
              {log.level === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {log.level === 'warn' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              {log.level === 'info' && <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono break-all text-white/70">{log.message}</p>
                <p className="text-[9px] text-white/20 mt-1">{log.time.toLocaleTimeString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const {
    dashboardMode, setDashboardMode,
    currentView,
    siteConfig, setSiteConfig,
    events, setEvents,
    buyers,
    staffAccounts,
    loggedInUserId,
    userRole, isAtLeast, isStaff,
    selectedDashboardEvent, setSelectedDashboardEvent,
    adminScrollRef, imageFileInputRef,
    showDefaultCredentialsWarning,
    loadingEvents,
    handleCreateEvent, handleEditEvent, handleSaveEvent, handleUpdateEventStatus,
    handleCheckIn, handleUndoCheckIn, handleScannerError, handleAddStaff,
    showToast,
    systemLogs, clearSystemLogs,
    reservations,
    formEvent, setFormEvent,
    errors, setErrors,
    releaseValidationFields, setReleaseValidationFields,
    newStaff, setNewStaff,
    salesChartPeriod, setSalesChartPeriod,
    consoleSearch, setConsoleSearch,
    consoleSearchInput, setConsoleSearchInput,
    consoleFilter, setConsoleFilter,
    consoleFilterOpen, setConsoleFilterOpen,
    consoleDisplayCount, setConsoleDisplayCount,
    isMessageModalOpen, setIsMessageModalOpen,
    isLogsModalOpen, setIsLogsModalOpen,
    checkinTab, setCheckinTab,
    checkInResult,
    scannerError, setScannerError,
    scannerKey, setScannerKey,
    scannerConstraints, setScannerConstraints,
    resetScanner,
    checkInInput, setCheckInInput,
    checkInSearch, setCheckInSearch,
    checkInSearchInput, setCheckInSearchInput,
    checkInFilter, setCheckInFilter,
    checkInHistory,
    setCurrentView,
    pendingApprovalsCount,
    handleImageFileChange,
    setActionTicket,
    setIsTableLayoutEditorOpen,
    setIsStaffModalOpen,
    setStaffAccounts,
  } = useApp();

  const [eventFilter, setEventFilter] = React.useState<'upcoming' | 'past'>('upcoming');
  const [pendingCheckin, setPendingCheckin] = React.useState<Buyer | null>(null);

  const downloadPDF = () => downloadPDFList(buyers, events.find(e => e.id === selectedDashboardEvent));

  return (
          <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-10 mt-8 mb-20 animate-in fade-in duration-500">
            {showDefaultCredentialsWarning && userRole === 'admin' && (
              <div className="mx-4 sm:mx-0 mb-6 p-4 border border-amber-500/30 bg-amber-500/10 rounded-2xl">
                <p className="text-[11px] md:text-xs uppercase tracking-widest text-amber-300 font-bold">
                  Você está usando credenciais padrão. Altere sua senha nas Configurações.
                </p>
              </div>
            )}
            {dashboardMode === 'producer-onboarding' ? (
              <ProducerOnboardingFlow />
            ) : dashboardMode === 'producer-dashboard' ? (
              <ProducerDashboard />
            ) : dashboardMode === 'approval-queue' && isAtLeast('admin') ? (
              <ApprovalQueue onToast={showToast} />
            ) : dashboardMode === 'list' ? (
              loadingEvents ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
                  <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Carregando eventos...</p>
                </div>
              ) : isStaff ? (
                // Staff shouldn't see the list via manual URL if they have no assigned event
                <div className="flex flex-col items-center justify-center py-20 text-center px-4 sm:px-0">
                  <ShieldAlert className="w-16 h-16 text-[#d4af37] opacity-20 mb-6" />
                  <h2 className="text-2xl font-serif text-[#d4af37] mb-2">Acesso Restrito</h2>
                  <p className="text-xs uppercase tracking-widest opacity-40 max-w-sm">
                    Você não possui eventos atribuídos no momento. Entre em contato com o administrador.
                  </p>
                </div>
              ) : (
                <div className="space-y-12 px-4 sm:px-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-serif text-[#d4af37] mb-2">Painel de Controle</h1>
                      <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-40">Gerencie seus eventos e acompanhe as vendas</p>
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                      <button
                        onClick={() => setEventFilter('upcoming')}
                        className={`px-5 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all ${eventFilter === 'upcoming' ? 'bg-[#d4af37] text-black' : 'text-white/50 hover:text-white'}`}
                      >Próximos</button>
                      <button
                        onClick={() => setEventFilter('past')}
                        className={`px-5 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all ${eventFilter === 'past' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
                      >Encerrados</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {events
                      .filter(evt => isAtLeast('admin') || evt.assignedStaffIds.includes(loggedInUserId || ''))
                      .filter(evt => eventFilter === 'past' ? isEventPast(evt) : !isEventPast(evt))
                      .map((evt) => (
                      <motion.div 
                          key={evt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setSelectedDashboardEvent(evt.id);
                            setDashboardMode('list');
                            setTimeout(() => setDashboardMode(isAtLeast('admin') ? 'details' : 'check-in'), 0);
                            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                            adminScrollRef.current?.scrollTo(0, 0);
                          }}
                          className="bg-[#0d0d0d] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer hover:border-[#d4af37]/30 transition-all duration-500"
                      >
                        <div className="h-40 md:h-48 overflow-hidden relative">
                          {evt.img ? <img src={evt.img} alt={evt.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" referrerPolicy="no-referrer" loading="lazy" decoding="async" /> : <div className="w-full h-full bg-white/5" />}
                          <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-md text-[8px] uppercase tracking-widest font-bold text-[#d4af37]">
                              {evt.status}
                          </div>
                        </div>
                        <div className="p-5 md:p-6">
                          <h3 className="text-lg font-serif text-white mb-4 group-hover:text-[#d4af37] transition-colors">{evt.title}</h3>
                          <div className="space-y-2 mb-6 md:mb-8">
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] opacity-40 uppercase tracking-widest">
                              <Calendar className="w-3 h-3" /> {new Date(evt.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] opacity-40 uppercase tracking-widest">
                              <MapPin className="w-3 h-3" /> {evt.location}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-5 md:pt-6 border-t border-white/5">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3 text-[#d4af37]" />
                                <span className="text-xs font-bold font-serif">148 vendidos</span>
                              </div>
                              <span className="text-[9px] md:text-[10px] uppercase font-bold text-[#d4af37] flex items-center gap-1">Acessar {isAtLeast('admin') ? 'Painel' : 'Check-in'} <ChevronRight className="w-3 h-3" /></span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                      {/* Create New Event Card */}
                      {isAtLeast('admin') && (
                        <div
                          onClick={handleCreateEvent}
                          className="bg-[#0d0d0d] border border-white/10 border-dashed rounded-2xl md:rounded-3xl flex flex-col items-center justify-center p-8 md:p-12 text-center group cursor-pointer hover:bg-white/5 transition min-h-[250px]"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Plus className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:text-[#d4af37] transition" />
                          </div>
                          <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-30">Criar Novo Evento</h4>
                        </div>
                      )}
                  </div>
                </div>
              )
            ) : (
              <>
                {/* Header Dashboard */}
                {/* Optimized Header for Mobile & Desktop */}
                <div className="flex flex-col gap-6 mb-8 md:mb-12 px-4 sm:px-0">
                  <div className="flex items-center justify-between">
                    {isAtLeast('admin') && (
                      <button
                        onClick={() => setDashboardMode(dashboardMode === 'check-in' ? 'details' : 'list')}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37] hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" /> {dashboardMode === 'check-in' ? 'Voltar para painel do evento' : 'Voltar para Lista'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                      <h1 className="text-lg md:text-3xl font-serif text-[#d4af37] leading-tight">
                        {dashboardMode === 'staff' ? 'Equipe de Colaboradores' : (events.find(e => e.id === selectedDashboardEvent)?.title || 'Evento')}
                      </h1>
                    </div>
                    <p className="text-[9px] md:text-xs uppercase tracking-widest opacity-40 font-medium">
                      {dashboardMode === 'staff' ? (
                        'Gestão global de acessos e equipe de campo'
                      ) : (
                        <>
                          <span className="text-[#d4af37]/60 font-bold">ID: #DRK-2026-00{selectedDashboardEvent}</span>
                          <span className="mx-2 opacity-20">•</span>
                          <span>Local: {events.find(e => e.id === selectedDashboardEvent)?.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

            {dashboardMode === 'details' ? (
              <div className="px-4 xl:px-0 space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Cabeçalho do Detalhe */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-serif text-white">
                      {events.find(e => e.id === selectedDashboardEvent)?.title || 'Evento'}
                    </h2>
                  </div>
                  {(() => {
                    const evt = events.find(e => e.id === selectedDashboardEvent);
                    if (!evt) return null;
                    const today = new Date().toISOString().split('T')[0];
                    const isEventPast = evt.date < today;
                    const isActive = !isEventPast && (evt.status === 'Ativo' || evt.status === 'Vendas liberadas');
                    const statusColor = isEventPast || evt.status === 'Finalizado'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : isActive ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : evt.status === 'Em breve' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-white/10 text-white/50 border-white/10';
                    const statusTooltip = isEventPast || evt.status === 'Finalizado' ? 'Evento encerrado'
                      : isActive ? 'Vendas abertas — evento ativo'
                      : evt.status === 'Em breve' ? 'Vendas ainda não iniciadas'
                      : 'Rascunho — não publicado';
                    return (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          title={statusTooltip}
                          className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold tracking-widest border flex items-center gap-1.5 ${statusColor}`}
                        >
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
                          {isEventPast ? 'Finalizado' : evt.status}
                        </span>
                        <button
                          onClick={() => setDashboardMode('check-in')}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition"
                        >
                          <ScanLine className="w-3.5 h-3.5" /> Controle de Portaria
                        </button>
                        <button
                          onClick={() => handleEditEvent(evt)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-bold uppercase tracking-widest hover:bg-[#d4af37]/20 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar Evento
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Controle de Status */}
                {(() => {
                  const evt = events.find(e => e.id === selectedDashboardEvent);
                  if (!evt) return null;
                  const today = new Date().toISOString().split('T')[0];
                  const isEventPast = evt.date < today;
                  return (
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
                      <p className="text-[10px] uppercase tracking-widest opacity-40 mb-4 font-bold text-center">Status do Evento</p>
                      {isEventPast ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <span className="px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-red-500/20 text-red-400 border-red-500/30">
                            Finalizado
                          </span>
                          <p className="text-[9px] opacity-40 ml-2">Evento já realizado — status bloqueado.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap justify-center gap-3">
                            <button
                              onClick={() => handleUpdateEventStatus(evt.id, 'Rascunho')}
                              className={`px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition border ${evt.status === 'Rascunho' ? 'bg-white/20 text-white border-white/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                              Rascunho
                            </button>
                            <button
                              onClick={() => handleUpdateEventStatus(evt.id, 'Em breve')}
                              className={`px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition border ${evt.status === 'Em breve' ? 'bg-blue-500/30 text-blue-300 border-blue-500/40' : 'bg-white/5 text-white/50 border-white/10 hover:bg-blue-500/10 hover:text-blue-300'}`}
                            >
                              Em breve
                            </button>
                            <button
                              onClick={() => handleUpdateEventStatus(evt.id, 'Vendas liberadas')}
                              className={`px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition border ${evt.status === 'Vendas liberadas' ? 'bg-green-500/30 text-green-300 border-green-500/40' : 'bg-white/5 text-white/50 border-white/10 hover:bg-green-500/10 hover:text-green-300'}`}
                            >
                              Vendas liberadas
                            </button>
                          </div>
                          <p className="text-[9px] opacity-30 mt-3">
                            {evt.status === 'Rascunho' && 'Rascunho: evento oculto para o público.'}
                            {evt.status === 'Em breve' && 'Em breve: visível ao público, sem opção de compra.'}
                            {evt.status === 'Vendas liberadas' && 'Vendas liberadas: público pode comprar ingressos e reservar mesas.'}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Smart Alerts */}
                <div className="bg-[#d4af37]/5 border-l-2 border-[#d4af37] rounded-r-2xl p-4 flex items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-[#d4af37]" />
                      <p className="text-xs text-[#d4af37]/80">
                        <strong className="text-[#d4af37]">Alerta Inteligente:</strong> 80% das Mesas VIP vendidas. A demanda está alta. Considere um lote extra.
                      </p>
                   </div>
                   <button onClick={() => {
                     const evt = events.find(e => e.id === selectedDashboardEvent);
                     if (evt) {
                       handleEditEvent(evt);
                       setTimeout(() => document.getElementById('lotes')?.scrollIntoView({ behavior: 'smooth' }), 100);
                     }
                   }} className="text-[10px] uppercase tracking-widest font-bold bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded transition whitespace-nowrap">
                     Ajustar Lotes
                   </button>
                </div>

                {/* KPIs Modernos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* KPI 1 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                         <DollarSign className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold text-green-400">+12% vs última ed.</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Receita Gerada</p>
                     <h3 className="text-3xl font-sans font-bold text-white">R$ 15.450</h3>
                     <div className="mt-3 flex gap-4 border-t border-white/5 pt-3">
                       <div>
                         <p className="text-[9px] uppercase opacity-30">Pista</p>
                         <p className="text-xs text-white/80 font-mono">R$ 5.450</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase opacity-30">Mesas</p>
                         <p className="text-xs text-[#d4af37] font-mono">R$ 10.000</p>
                       </div>
                     </div>
                  </div>

                  {/* KPI 2 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                         <Users className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold text-blue-400">Alta Proc.</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Lotação Atual</p>
                     <div className="flex items-baseline gap-2">
                       <h3 className="text-3xl font-sans font-bold text-white">148</h3>
                       <span className="text-sm opacity-40">/ 500 cap.</span>
                     </div>
                     <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-blue-500 w-[30%]"></div>
                     </div>
                  </div>

                  {/* KPI 3 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                         <MapPin className="w-4 h-4" />
                       </div>
                       <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">Portaria Live</span>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Check-ins Feitos</p>
                     <div className="flex items-baseline gap-2">
                       <h3 className="text-3xl font-sans font-bold text-white">0</h3>
                       <span className="text-sm opacity-40">/ 148 previstos</span>
                     </div>
                     <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-[#d4af37] w-[0%]"></div>
                     </div>
                  </div>

                  {/* KPI 4 */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                         <Activity className="w-4 h-4" />
                       </div>
                     </div>
                     <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Conversão Carrinho</p>
                     <h3 className="text-3xl font-sans font-bold text-white">24.5%</h3>
                     <p className="text-[9px] uppercase opacity-30 mt-3 pt-3 border-t border-white/5">25 checkouts abandonados</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Esquerda: Gráfico + Tabela */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Gráfico de Vendas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 flex flex-col" style={{minHeight: 340}}>
                       <div className="flex justify-between items-center mb-6">
                         <div>
                           <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-2">
                             <TrendingUp className="w-4 h-4" /> Evolução de Vendas
                           </h3>
                           <p className="text-[10px] opacity-30 mt-1 uppercase tracking-widest">
                             {salesChartPeriod === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
                           </p>
                         </div>
                         <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5">
                           <button
                             onClick={() => setSalesChartPeriod('7d')}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${salesChartPeriod === '7d' ? 'bg-[#d4af37] text-black' : 'text-white/40 hover:text-white/70'}`}
                           >
                             7 dias
                           </button>
                           <button
                             onClick={() => setSalesChartPeriod('30d')}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${salesChartPeriod === '30d' ? 'bg-[#d4af37] text-black' : 'text-white/40 hover:text-white/70'}`}
                           >
                             30 dias
                           </button>
                         </div>
                       </div>
                       <div className="flex gap-4 mb-4">
                         <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#d4af37]"></div><span className="text-[9px] uppercase tracking-widest opacity-50">Ingressos</span></div>
                         <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/40"></div><span className="text-[9px] uppercase tracking-widest opacity-50">Mesas</span></div>
                       </div>
                       <div className="flex-1 w-full relative min-h-0" style={{height: 220}}>
                         {(() => {
                            const data7d = [
                              { name: 'Seg', ingressos: 15, mesas: 2 },
                              { name: 'Ter', ingressos: 30, mesas: 3 },
                              { name: 'Qua', ingressos: 25, mesas: 1 },
                              { name: 'Qui', ingressos: 40, mesas: 5 },
                              { name: 'Sex', ingressos: 60, mesas: 8 },
                              { name: 'Sab', ingressos: 95, mesas: 12 },
                              { name: 'Dom', ingressos: 120, mesas: 18 },
                            ];
                            const data30d = [
                              { name: 'S1', ingressos: 42, mesas: 5 },
                              { name: 'S2', ingressos: 78, mesas: 9 },
                              { name: 'S3', ingressos: 55, mesas: 6 },
                              { name: 'S4', ingressos: 93, mesas: 11 },
                              { name: 'S5', ingressos: 110, mesas: 14 },
                              { name: 'S6', ingressos: 88, mesas: 10 },
                              { name: 'S7', ingressos: 130, mesas: 17 },
                              { name: 'S8', ingressos: 145, mesas: 20 },
                              { name: 'S9', ingressos: 102, mesas: 13 },
                              { name: 'S10', ingressos: 168, mesas: 22 },
                              { name: 'S11', ingressos: 190, mesas: 26 },
                              { name: 'S12', ingressos: 215, mesas: 30 },
                            ];
                            const chartData = salesChartPeriod === '7d' ? data7d : data30d;
                            return (
                              <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorIngressos" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorMesas" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#fff" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                  <XAxis dataKey="name" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', padding: '8px 12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#d4af37', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                  />
                                  <Area type="monotone" dataKey="ingressos" name="Ingressos" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorIngressos)" dot={false} activeDot={{ r: 4, fill: '#d4af37', strokeWidth: 0 }} />
                                  <Area type="monotone" dataKey="mesas" name="Mesas" stroke="#ffffff40" strokeWidth={2} fillOpacity={1} fill="url(#colorMesas)" dot={false} activeDot={{ r: 4, fill: '#fff', strokeWidth: 0 }} />
                                </AreaChart>
                              </ResponsiveContainer>
                            );
                         })()}
                       </div>
                    </div>

                    {/* Console de Acessos Recentes */}
                    {(() => {
                      const filteredBuyers = buyers
                        .filter(b => {
                          if (!consoleSearch) return true;
                          const q = consoleSearch.toLowerCase();
                          return b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q) || (b.cpf || '').includes(q);
                        })
                        .sort((a, b) => {
                          if (consoleFilter === 'data') {
                            const da = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
                            const db = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
                            return db - da;
                          }
                          if (consoleFilter === 'comprador') return a.name.localeCompare(b.name);
                          if (consoleFilter === 'tipo') return a.type.localeCompare(b.type);
                          if (consoleFilter === 'status') {
                            const order = { Presente: 0, Aguardando: 1, Cancelado: 2 };
                            const sa = a.checkedIn ? 'Presente' : a.status === 'Cancelado' ? 'Cancelado' : 'Aguardando';
                            const sb = b.checkedIn ? 'Presente' : b.status === 'Cancelado' ? 'Cancelado' : 'Aguardando';
                            return (order[sa as keyof typeof order] ?? 3) - (order[sb as keyof typeof order] ?? 3);
                          }
                          return 0;
                        });
                      const visibleBuyers = filteredBuyers.slice(0, consoleDisplayCount);
                      const hasMore = filteredBuyers.length > consoleDisplayCount;
                      return (
                     <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-white/5 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <h2 className="text-base font-serif text-white">
                            Console de Entradas & Vendas
                          </h2>
                          {/* Filtro dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => setConsoleFilterOpen(p => !p)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] uppercase tracking-widest font-bold transition ${consoleFilter !== 'todos' ? 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                            >
                              <Filter className="w-3.5 h-3.5" />
                              {consoleFilter === 'todos' ? 'Filtrar' : consoleFilter === 'data' ? 'Data de Compra' : consoleFilter === 'comprador' ? 'Comprador' : consoleFilter === 'tipo' ? 'Tipo' : 'Status Acesso'}
                            </button>
                            {consoleFilterOpen && (
                              <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                                {(['todos', 'data', 'comprador', 'tipo', 'status'] as const).map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => { setConsoleFilter(opt); setConsoleFilterOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-[10px] uppercase tracking-widest font-bold transition hover:bg-white/5 flex items-center justify-between ${consoleFilter === opt ? 'text-[#d4af37]' : 'text-white/50'}`}
                                  >
                                    {opt === 'todos' ? 'Todos' : opt === 'data' ? 'Data de Compra' : opt === 'comprador' ? 'Comprador' : opt === 'tipo' ? 'Tipo' : 'Status de Acesso'}
                                    {consoleFilter === opt && <Check className="w-3 h-3" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Campo de busca */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input
                              type="text"
                              placeholder="Buscar ingresso / nome / CPF… (Enter para buscar)"
                              value={consoleSearchInput}
                              onChange={(e) => setConsoleSearchInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { setConsoleSearch(consoleSearchInput); setConsoleDisplayCount(4); } }}
                              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs w-full focus:border-[#d4af37] outline-none"
                            />
                          </div>
                          {/* Botão de busca — aparece sempre no mobile, fica oculto em sm+ */}
                          <button
                            onClick={() => { setConsoleSearch(consoleSearchInput); setConsoleDisplayCount(4); }}
                            className="sm:hidden px-4 py-2 bg-[#d4af37] text-black text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5"
                          >
                            <Search className="w-3.5 h-3.5" /> Buscar
                          </button>
                          {consoleSearch && (
                            <button
                              onClick={() => { setConsoleSearch(''); setConsoleSearchInput(''); setConsoleDisplayCount(4); }}
                              className="hidden sm:flex items-center gap-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/40 hover:text-white transition"
                            >
                              <X className="w-3 h-3" /> Limpar
                            </button>
                          )}
                        </div>
                        {consoleSearch && (
                          <p className="text-[10px] opacity-40 uppercase tracking-widest">
                            {filteredBuyers.length} resultado{filteredBuyers.length !== 1 ? 's' : ''} para "{consoleSearch}"
                          </p>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Data Compra</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Comprador</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Tipo / Lote</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Status Acesso</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {visibleBuyers.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-xs opacity-30 italic">
                                  Nenhum resultado encontrado.
                                </td>
                              </tr>
                            ) : visibleBuyers.map((buyer) => (
                              <tr key={buyer.id} className="hover:bg-white/[0.03] transition relative group">
                                <td className="px-6 py-4">
                                   <div className="text-[11px] font-mono text-white/50">
                                     {buyer.purchaseDate
                                       ? new Date(buyer.purchaseDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                       : '—'}
                                   </div>
                                   <div className="text-[9px] font-mono text-white/25 mt-0.5">
                                     {buyer.purchaseDate
                                       ? new Date(buyer.purchaseDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                       : ''}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-[13px] font-medium text-white line-clamp-1">{buyer.name}</div>
                                  <div className="text-[10px] opacity-40 lowercase line-clamp-1">{buyer.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-block px-2 py-0.5 bg-white/5 rounded border border-white/10 text-[9px] uppercase tracking-widest font-bold">
                                    {buyer.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {buyer.checkedIn ? (
                                    <span className="text-[9px] uppercase tracking-widest font-bold text-green-500 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Presente
                                    </span>
                                  ) : buyer.status === 'Cancelado' ? (
                                    <span className="text-[9px] uppercase tracking-widest font-bold text-yellow-500 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div> Cancelado
                                    </span>
                                  ) : (
                                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-30 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div> Aguardando
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <button onClick={() => {
                                    setActionTicket({ id: buyer.id, type: 'view', data: buyer });
                                  }} className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-widest font-bold">Visualizar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {hasMore && (
                        <div className="p-4 border-t border-white/5 text-center bg-white/[0.01]">
                          <button
                            onClick={() => setConsoleDisplayCount(prev => prev + 4)}
                            className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mx-auto"
                          >
                            <ChevronDown className="w-3.5 h-3.5" /> Carregar mais operações ({filteredBuyers.length - consoleDisplayCount} restantes)
                          </button>
                        </div>
                      )}
                    </div>
                      );
                    })()}
                  </div>

                  {/* Direita: Sidebar Actions */}
                  <div className="space-y-6">
                    {/* Botões Operacionais Primários */}
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={downloadPDF} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">
                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                           <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-[#d4af37] transition" />
                         </div>
                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Lista PDF</span>
                       </button>
                       <button onClick={() => setIsMessageModalOpen(true)} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">
                         <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                           <Mail className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition" />
                         </div>
                         <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 text-center">Aviso a todos</span>
                       </button>
                       <button onClick={() => {
                         const currentEvt = events.find(e => e.id === selectedDashboardEvent);
                         if (currentEvt?.status === 'Pausado') {
                            setEvents(events.map(e => e.id === selectedDashboardEvent ? { ...e, status: 'Ativo' } : e));
                            showToast("Vendas retomadas com sucesso.", "success");
                         } else {
                            setEvents(events.map(e => e.id === selectedDashboardEvent ? { ...e, status: 'Pausado' } : e));
                            showToast("ALERTA CRÍTICO: VENDAS FORAM PAUSADAS IMEDIATAMENTE!", "error");
                         }
                       }} className={`col-span-2 border rounded-2xl p-4 transition flex items-center justify-center gap-3 group ${events.find(e => e.id === selectedDashboardEvent)?.status === 'Pausado' ? 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}>
                         <StopCircle className="w-4 h-4" />
                         <span className="text-[10px] uppercase tracking-widest font-bold">{events.find(e => e.id === selectedDashboardEvent)?.status === 'Pausado' ? 'Retomar Vendas' : 'Pausar Vendas de Emergência'}</span>
                       </button>
                    </div>

                    {/* Distribuição Melhorada */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-50 mb-6 flex items-center gap-2">
                        Ticket Mix (%)
                      </h3>
                      <div className="space-y-5">
                        {[
                          { l: 'Mesas VIP', v: '65', c: 'bg-[#d4af37]' },
                          { l: 'Pista Lote 1', v: '20', c: 'bg-white/40' },
                          { l: 'Pista Lote 2', v: '10', c: 'bg-white/20' },
                          { l: 'Cortesia/Staff', v: '5', c: 'bg-green-500/40' },
                        ].map((item, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-widest">{item.l}</span>
                              <span className="text-[10px] opacity-50">{item.v}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full ${item.c}`} style={{ width: `${item.v}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Histórico Atividade Rápido */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-50 mb-6">Atividade Log</h3>
                      <div className="space-y-4">
                         <div className="flex gap-4 relative">
                            <div className="w-px h-full bg-white/10 absolute left-1 top-2 bottom-0"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37] relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Lote de Ingressos Pista Esgotado</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Sistema • 2h atrás</span>
                            </div>
                         </div>
                         <div className="flex gap-4 relative">
                            <div className="w-px h-full bg-white/10 absolute left-1 top-2 bottom-0"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Disparo Mkt: "Últimas Mesas"</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Admin • 4h atrás</span>
                            </div>
                         </div>
                         <div className="flex gap-4 relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/20 relative z-10 shrink-0 mt-1"></div>
                            <div>
                               <p className="text-xs text-white">Edição V2 do mapa publicada</p>
                               <span className="text-[9px] uppercase tracking-widest opacity-40">Gabriel S. • Ontem</span>
                            </div>
                         </div>
                      </div>
                      <button onClick={() => setIsLogsModalOpen(true)} className="w-full mt-6 py-2 border border-white/10 rounded-xl text-[9px] uppercase tracking-widest font-bold hover:bg-white/5 transition">
                        Ver histórico completo
                      </button>
                    </div>

                  </div>
                </div>
              </div>
) : dashboardMode === 'check-in' ? (
              <div className="max-w-4xl mx-auto space-y-4 px-2 sm:px-0 pb-32">
                {/* Header KPI Check-in */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 sm:p-6 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 z-40 shadow-2xl">
                   <div className="flex items-center gap-4 w-full sm:w-auto">
                     <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 flex items-center justify-center border border-[#d4af37]/20">
                       <ShieldCheck className="w-6 h-6 text-[#d4af37]" />
                     </div>
                     <div>
                       <h2 className="text-sm uppercase tracking-widest font-black text-[#d4af37]">Check-in Operacional</h2>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold opacity-60">Operador: Gabriel</span>
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center justify-center gap-6 w-full sm:w-auto bg-white/5 p-3 rounded-xl">
                      <div className="text-center">
                         <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1">Entraram</p>
                         <p className="text-2xl font-black text-green-400 leading-none">{buyers.filter(b => b.checkedIn).length}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="text-center">
                         <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1">Restam</p>
                         <p className="text-2xl font-black text-white leading-none">{buyers.filter(b => !b.checkedIn && b.status === "Pago").length}</p>
                      </div>
                   </div>
                </div>

                {/* Main Tabs */}
                <div className="flex bg-[#0d0d0d] border border-white/10 p-1 rounded-xl w-full mb-6 relative z-30">
                  <button 
                    onClick={() => setCheckinTab('scanner')} 
                    className={`flex-1 py-3 text-[10px] sm:text-xs uppercase font-black tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${checkinTab === 'scanner' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/50 hover:bg-white/5'}`}
                  >
                    <QrCode className="w-4 h-4" /> SCANNER
                  </button>
                  <button 
                    onClick={() => setCheckinTab('list')} 
                    className={`flex-1 py-3 text-[10px] sm:text-xs uppercase font-black tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${checkinTab === 'list' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/50 hover:bg-white/5'}`}
                  >
                    <Users className="w-4 h-4" /> LISTA MANUAL
                  </button>
                </div>

                {checkinTab === 'scanner' && (
                  <div className="space-y-4">
                    {/* Scanner Area */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden relative shadow-xl">
                       <div className="relative max-w-sm mx-auto aspect-square w-full bg-black flex items-center justify-center">
                          {scannerError ? (
                            <div className="flex flex-col items-center justify-center gap-4 p-6 text-center h-full w-full">
                              <AlertCircle className="w-10 h-10 text-amber-400" />
                              <p className="text-sm text-white/70 max-w-xs">{scannerError}</p>
                              <button
                                onClick={resetScanner}
                                className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition text-white"
                              >
                                Tentar Novamente
                              </button>
                            </div>
                          ) : (
                            <Scanner
                              key={scannerKey}
                              onScan={(detectedCodes) => { if(detectedCodes?.[0]?.rawValue) handleCheckIn(detectedCodes[0].rawValue); }}
                              formats={['qr_code']}
                              allowMultiple={false}
                              constraints={scannerConstraints}
                              onError={handleScannerError}
                            />
                          )}
                          
                          {/* Full Screen Overlay for Results */}
                          <AnimatePresence>
                            {checkInResult && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center ${
                                  checkInResult.type === 'success' ? 'bg-green-500/95 backdrop-blur-xl' :
                                  checkInResult.type === 'warning' ? 'bg-amber-500/95 backdrop-blur-xl' :
                                  'bg-red-500/95 backdrop-blur-xl'
                                }`}
                              >
                                {checkInResult.type === 'success' ? <ShieldCheck className="w-24 h-24 text-white mb-6 drop-shadow-xl" /> : 
                                 checkInResult.type === 'warning' ? <Activity className="w-24 h-24 text-white mb-6 drop-shadow-xl" /> : 
                                 <X className="w-24 h-24 text-white mb-6 drop-shadow-xl" />}
                                <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-wider drop-shadow-xl mb-4 leading-tight">{checkInResult.message}</h1>
                                
                                {checkInResult.data && (
                                  <div className="bg-black/20 p-6 rounded-2xl w-full max-w-sm mt-4 backdrop-blur-sm border border-white/10 shadow-inner">
                                    <p className="text-lg font-bold text-white mb-1 uppercase drop-shadow-md">{checkInResult.data.name}</p>
                                    <div className="flex items-center justify-center gap-3">
                                      <span className="text-sm font-black bg-white text-black px-3 py-1 rounded uppercase tracking-widest">{checkInResult.data.type}</span>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                       </div>
                    </div>

                    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6">
                       <h3 className="text-xs font-serif text-[#d4af37] mb-4 uppercase tracking-widest leading-none">Busca Rápida</h3>
                       <div className="flex flex-col sm:flex-row gap-3">
                         <input 
                           type="text" 
                           placeholder="Digite o CPF (000.000.000-00) ou ID..."
                           value={checkInInput}
                           onChange={(e) => setCheckInInput(e.target.value)}
                           onKeyPress={(e) => e.key === 'Enter' && handleCheckIn(checkInInput)}
                           className="w-full sm:flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-[#d4af37] outline-none transition-colors text-white"
                         />
                         <button 
                           onClick={() => handleCheckIn(checkInInput)}
                           className="w-full sm:w-auto px-10 py-4 bg-[#d4af37] text-black font-black text-[10px] uppercase tracking-[0.1em] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4af371a] flex items-center justify-center"
                         >
                           <Search className="w-4 h-4 mr-2" /> Validar
                         </button>
                       </div>
                    </div>
                  </div>
                )}

                {checkinTab === 'list' && (
                  <div className="space-y-4">
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex gap-2 w-full sm:max-w-xs">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-white" />
                            <input
                               type="text"
                               placeholder="Buscar por nome ou CPF..."
                               value={checkInSearchInput}
                               onChange={(e) => setCheckInSearchInput(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && setCheckInSearch(checkInSearchInput)}
                               className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-[#d4af37] outline-none text-white"
                            />
                          </div>
                          <button
                            onClick={() => setCheckInSearch(checkInSearchInput)}
                            className="sm:hidden px-4 py-3 bg-[#d4af37] text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all"
                          >
                            Buscar
                          </button>
                        </div>
                        <div className="flex justify-center bg-white/5 rounded-xl p-1 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                           <button onClick={() => setCheckInFilter('all')} className={`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap ${checkInFilter === 'all' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Todos</button>
                           <button onClick={() => setCheckInFilter('pendentes')} className={`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap ${checkInFilter === 'pendentes' ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'text-white/40'}`}>Pendentes</button>
                           <button onClick={() => setCheckInFilter('check-ins')} className={`px-4 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg whitespace-nowrap ${checkInFilter === 'check-ins' ? 'bg-green-500/20 text-green-400' : 'text-white/40'}`}>Check-in</button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 custom-scrollbar">
                         {buyers
                            .filter(b => checkInFilter === 'all' || (checkInFilter === 'pendentes' ? !b.checkedIn : b.checkedIn))
                            .filter(b => b.name.toLowerCase().includes(checkInSearch.toLowerCase()) || b.cpf.replace(/\D/g, '').includes(checkInSearch.replace(/\D/g, '')))
                            .map(b => (
                            <div key={b.id} className={`flex items-center justify-between p-3 sm:p-4 border rounded-2xl transition-all ${b.checkedIn ? 'bg-green-500/5 border-green-500/10' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${b.checkedIn ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/50'}`}>
                                   {b.checkedIn ? <Check className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`text-sm font-bold leading-tight ${b.checkedIn ? 'text-green-100' : 'text-white'}`}>{b.name}</p>
                                    {b.cpf && <span className="text-[10px] font-mono text-[#d4af37]/60 bg-[#d4af37]/5 px-1.5 py-0.5 rounded">{b.cpf}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-white/40 uppercase tracking-widest font-bold">{b.type}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center">
                                {!b.checkedIn ? (
                                  <button onClick={() => setPendingCheckin(b)} className="px-4 py-2.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#ffe380] active:scale-95 transition-all">
                                    ENTRAR
                                  </button>
                                ) : (
                                  <button onClick={() => handleUndoCheckIn(b.id)} className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all">
                                    Desfazer
                                  </button>
                                )}
                              </div>
                            </div>
                         ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de confirmação de check-in */}
                <AnimatePresence>
                  {pendingCheckin && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
                      onClick={() => setPendingCheckin(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.95, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 10 }}
                        className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-sm w-full"
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 className="text-base font-bold text-[#d4af37] uppercase tracking-widest mb-4">Confirmar Check-in</h3>
                        <div className="space-y-2 mb-6">
                          <p className="text-sm font-bold text-white">{pendingCheckin.name}</p>
                          {pendingCheckin.cpf && <p className="text-xs font-mono text-white/50">{pendingCheckin.cpf}</p>}
                          <span className="inline-block text-[9px] px-2 py-1 bg-[#d4af37]/10 text-[#d4af37] rounded uppercase tracking-widest font-bold">{pendingCheckin.type}</span>
                          <p className={`text-xs font-bold ${pendingCheckin.status === 'Pago' ? 'text-green-400' : 'text-amber-400'}`}>{pendingCheckin.status}</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => { handleCheckIn(pendingCheckin.id); setPendingCheckin(null); }}
                            className="flex-1 py-3 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition"
                          >Confirmar</button>
                          <button
                            onClick={() => setPendingCheckin(null)}
                            className="flex-1 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition"
                          >Cancelar</button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Live Feed / History */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6">
                  <h3 className="text-xs flex items-center font-serif text-white mb-6 uppercase tracking-widest opacity-40"><Activity className="w-4 h-4 mr-2" /> Feed Ao Vivo</h3>
                  <div className="space-y-3">
                     {checkInHistory.length > 0 ? checkInHistory.map((h) => (
                       <div key={h.id + h.time.getTime()} className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.02] rounded-xl flex-wrap gap-4">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                             <Check className="w-4 h-4 text-green-500" />
                           </div>
                           <div>
                             <p className="text-xs font-bold text-white">{h.name}</p>
                             <p className="text-[9px] opacity-40 uppercase tracking-widest">{h.type} • Agora</p>
                           </div>
                         </div>
                         <button onClick={() => handleUndoCheckIn(h.id)} className="text-[9px] uppercase tracking-widest font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-all flex items-center">
                            <RefreshCcw className="w-3 h-3 mr-1" /> Desfazer
                         </button>
                       </div>
                     )) : (
                       <p className="text-xs opacity-30 italic text-center py-4">Aguardando scan...</p>
                     )}
                  </div>
                </div>
              </div>
) : dashboardMode === 'edit' && formEvent ? (
              <div className="w-full max-w-none px-3 sm:px-0 animate-in slide-in-from-bottom-6 duration-700 pb-32 mt-6 lg:mt-10">
                
                {/* Sticky Header */}
                <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 pb-4 pt-4 mb-10 flex justify-end">
                  <div className="flex flex-wrap sm:flex-nowrap w-full sm:w-auto gap-2 sm:gap-3">
                    <button
                      onClick={() => { setDashboardMode(events.find(e => e.id === formEvent.id) ? 'details' : 'list'); setFormEvent(null); setReleaseValidationFields([]); }}
                      className="flex-1 sm:flex-none px-2 sm:px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] sm:text-[10px] uppercase font-bold tracking-widest hover:bg-white/10 transition text-center whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveEvent(!events.find(e => e.id === formEvent.id))}
                      className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-[#d4af37] text-black rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-[#d4af3733] transition flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
                    >
                      <Check className="w-4 h-4 stroke-[3px]" /> {events.find(e => e.id === formEvent.id) ? 'Salvar' : 'Salvar Rascunho'}
                    </button>
                  </div>
                </div>

                {errors.form && (
                  <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-red-500 font-bold text-sm">Erro ao salvar</h4>
                      <p className="text-red-400/80 text-xs mt-1">{errors.form}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
                  {/* Left Column (Main Info) */}
                  <div className="lg:col-span-8 space-y-8 md:space-y-10">
                    
                    {/* Section 1: Informações Básicas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Info className="w-32 h-32" />
                      </div>
                      
                      <div className="flex items-center gap-3 mb-8 md:mb-10">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
                          <Info className="w-5 h-5" />
                        </div>
                        <h3 className="text-base md:text-lg font-serif text-white uppercase tracking-widest">Informações Básicas</h3>
                      </div>

                      {releaseValidationFields.length > 0 && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Preencha os campos obrigatórios para liberar vendas:
                          </p>
                          <ul className="text-red-400/80 text-xs space-y-0.5 list-disc list-inside">
                            {releaseValidationFields.map(f => <li key={f}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Nome do Evento *</label>
                          <input
                            type="text"
                            value={formEvent.title || ''}
                            onChange={(e) => { setFormEvent({ ...formEvent, title: e.target.value }); if(e.target.value.trim()) setReleaseValidationFields(prev => prev.filter(f => f !== 'Nome do Evento')); }}
                            placeholder="Ex: Réveillon 2025"
                            className={`w-full bg-white/[0.03] border rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all ${releaseValidationFields.includes('Nome do Evento') ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'}`}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Categoria</label>
                            <select
                              value={formEvent.category || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, category: e.target.value })}
                              className="w-full select-field md:rounded-2xl"
                            >
                              <option value="">Selecione uma categoria...</option>
                              <option value="Festa">Festa / Balada</option>
                              <option value="Show">Show ao Vivo</option>
                              <option value="Festival">Festival</option>
                              <option value="Teatro">Teatro / Stand-up</option>
                              <option value="Tecnologia">Tecnologia</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Classificação Indicativa</label>
                            <select
                              value={formEvent.ageRating || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, ageRating: e.target.value })}
                              className="w-full select-field md:rounded-2xl"
                            >
                              <option value="">Selecione...</option>
                              <option value="Livre">Livre</option>
                              <option value="16+">16+ Anos</option>
                              <option value="18+">18+ Anos</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Capacidade</label>
                            <input
                              type="number"
                              min={1}
                              value={formEvent.capacity || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, capacity: Number(e.target.value) || 0 })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all"
                              placeholder="Ex: 1500"
                            />
                            {siteConfig.venueMaxCapacity && (formEvent.capacity ?? 0) > siteConfig.venueMaxCapacity && (
                              <p className="text-yellow-400 text-[10px] mt-1.5 ml-1">Excede a capacidade máxima do venue ({siteConfig.venueMaxCapacity})</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Descrição Completa</label>
                          <textarea 
                            value={formEvent.description}
                            onChange={(e) => setFormEvent({ ...formEvent, description: e.target.value })}
                            placeholder="Descreva a experiência que o público terá..."
                            rows={4}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all resize-none"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Data e Local */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
                      <div className="flex items-center gap-3 mb-8 md:mb-10">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                         <h3 className="text-base md:text-lg font-serif text-white uppercase tracking-widest">Data e Local</h3>
                         <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Onde e Quando</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Data Início *</label>
                            <input
                              type="date"
                              value={formEvent.date || ''}
                              onChange={(e) => { setFormEvent({ ...formEvent, date: e.target.value }); if(e.target.value) setReleaseValidationFields(prev => prev.filter(f => f !== 'Data')); }}
                              className={`w-full bg-white/[0.03] border rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark] ${releaseValidationFields.includes('Data') ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Hora Abertura *</label>
                            <input
                              type="time"
                              value={formEvent.time || ''}
                              onChange={(e) => { setFormEvent({ ...formEvent, time: e.target.value }); if(e.target.value) setReleaseValidationFields(prev => prev.filter(f => f !== 'Horário')); }}
                              className={`w-full bg-white/[0.03] border rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark] ${releaseValidationFields.includes('Horário') ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Data Término (Opcional)</label>
                            <input 
                              type="date" 
                              value={formEvent.endDate || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, endDate: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Hora Encerramento</label>
                            <input 
                              type="time" 
                              value={formEvent.endTime || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, endTime: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark]"
                            />
                          </div>
                        </div>


                        {(() => {
                          let posList: { name: string; address: string; number: string }[] = [];
                          try {
                            const raw = formEvent.posLocations;
                            if (raw && raw.startsWith('[')) {
                              posList = JSON.parse(raw);
                            } else if (raw) {
                              posList = [{ name: raw, address: '', number: '' }];
                            }
                          } catch { posList = []; }

                          const updatePosList = (list: { name: string; address: string; number: string }[]) => {
                            setFormEvent({ ...formEvent, posLocations: JSON.stringify(list) });
                          };

                          return (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <label className="block text-[9px] md:text-[10px] uppercase opacity-40 font-bold tracking-[0.2em] ml-1">Pontos de Venda Físicos</label>
                                <button
                                  type="button"
                                  onClick={() => updatePosList([...posList, { name: '', address: '', number: '' }])}
                                  className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-[#d4af37] hover:text-white transition"
                                >
                                  <Plus className="w-3 h-3" /> Adicionar
                                </button>
                              </div>
                              <div className="space-y-3">
                                {posList.map((pos, idx) => (
                                  <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        value={pos.name}
                                        onChange={e => { const l = [...posList]; l[idx] = { ...l[idx], name: e.target.value }; updatePosList(l); }}
                                        placeholder="Ponto de Venda"
                                        className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none placeholder:opacity-30"
                                      />
                                      <input
                                        type="text"
                                        value={pos.address}
                                        onChange={e => { const l = [...posList]; l[idx] = { ...l[idx], address: e.target.value }; updatePosList(l); }}
                                        placeholder="Endereço"
                                        className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none placeholder:opacity-30"
                                      />
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={pos.number}
                                          onChange={e => { const l = [...posList]; l[idx] = { ...l[idx], number: e.target.value }; updatePosList(l); }}
                                          placeholder="Nº"
                                          className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none placeholder:opacity-30"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updatePosList(posList.filter((_, i) => i !== idx))}
                                          className="px-2 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                        ><Trash className="w-4 h-4" /></button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {posList.length === 0 && (
                                  <p className="text-[10px] text-white/20 italic py-2">Nenhum ponto de venda cadastrado.</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Section 4: Configuração de Lotes */}
                    <div id="lotes" className={`bg-[#0d0d0d] border rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl ${releaseValidationFields.includes('Pelo menos 1 Lote de Ingressos') ? 'border-red-500/40' : 'border-white/10'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 md:mb-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-serif text-white uppercase tracking-widest">Ingressos e Lotes</h3>
                            <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Regras de precificação</p>
                          </div>
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                          <button 
                            onClick={() => setFormEvent({ ...formEvent, priceType: 'unique' })}
                            className={`px-4 py-2.5 rounded-lg text-[9px] uppercase font-bold tracking-widest transition-all ${formEvent.priceType === 'unique' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af3733]' : 'opacity-40 hover:opacity-100'}`}
                          >
                            Valor Único
                          </button>
                          <button 
                            onClick={() => setFormEvent({ ...formEvent, priceType: 'gender' })}
                            className={`px-4 py-2.5 rounded-lg text-[9px] uppercase font-bold tracking-widest transition-all ${formEvent.priceType === 'gender' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af3733]' : 'opacity-40 hover:opacity-100'}`}
                          >
                            Masc/Fem
                          </button>
                        </div>
                      </div>

                      {/* Indicador de capacidade */}
                      {(() => {
                        const cap = formEvent.capacity ?? 0;
                        const totalQty = formEvent.batches.reduce((sum, b) => sum + b.sectors.reduce((s2, sec) => s2 + (sec.quantity ?? 0), 0), 0);
                        if (cap <= 0) return null;
                        const pct = Math.min((totalQty / cap) * 100, 100);
                        const over = totalQty > cap;
                        return (
                          <div className={`mb-8 p-4 rounded-2xl border ${over ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Uso de Capacidade</span>
                              <span className={`text-sm font-bold ${over ? 'text-red-400' : 'text-[#d4af37]'}`}>
                                {totalQty.toLocaleString('pt-BR')} / {cap.toLocaleString('pt-BR')} ingressos
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-[#d4af37]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {over && (
                              <p className="mt-2 text-[10px] text-red-400 font-medium">
                                Total de ingressos excede a capacidade máxima em {(totalQty - cap).toLocaleString('pt-BR')} ingresso(s). Reduza as quantidades.
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-8">
                        {formEvent.batches.map((batch, batchIndex) => (
                          <div key={batch.id ?? `batch-${batchIndex}`} className={`p-6 md:p-8 rounded-2xl border relative group ${batch.is_active === false ? 'bg-white/[0.01] border-white/5 opacity-60' : 'bg-white/[0.02] border-white/8'}`}>
                            <div className="flex justify-between items-center mb-7">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={batch.name}
                                  onChange={(e) => {
                                    setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, name: e.target.value } : b) });
                                  }}
                                  className="bg-transparent border-b border-white/20 text-white font-bold text-lg focus:border-[#d4af37] outline-none transition-all pb-1 min-w-[160px]"
                                  placeholder="Nome do Lote"
                                />
                                {batch.is_active === false ? (
                                  <span className="text-[9px] uppercase tracking-widest bg-white/10 text-white/40 px-2.5 py-1 rounded-full border border-white/10 whitespace-nowrap">Fechado</span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-widest bg-[#d4af37]/10 text-[#d4af37] px-2.5 py-1 rounded-full border border-[#d4af37]/20 whitespace-nowrap">Ativo</span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setFormEvent({ ...formEvent, batches: formEvent.batches.filter((_, i) => i !== batchIndex) });
                                  showToast('Lote removido.', 'info');
                                }}
                                className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 opacity-50 hover:opacity-100 transition-opacity ml-3 shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-4">
                              {batch.sectors.map((sector, sectorIndex) => (
                                <div key={sector.id ?? `sector-${batchIndex}-${sectorIndex}`} className="p-5 md:p-6 rounded-xl bg-black/40 border border-white/8">
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4">
                                    <div className="md:col-span-4">
                                      <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Nome do Setor / Ingresso</label>
                                      <input 
                                        type="text" 
                                        value={sector.name}
                                        onChange={(e) => {
                                          setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, name: e.target.value } : s) } : b) });
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                        placeholder="Ex: Pista / Camarote"
                                      />
                                    </div>

                                    {formEvent.priceType === 'unique' ? (
                                      <div className="md:col-span-2">
                                        <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">+ Preço (R$)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={sector.price === 0 ? '' : sector.price}
                                          onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                            setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, price: val } : s) } : b) });
                                          }}
                                          placeholder="0,00"
                                          className="w-full bg-[#d4af37]/10 text-[#d4af37] font-bold border border-[#d4af37]/30 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                        />
                                      </div>
                                    ) : (
                                      <div className="md:col-span-3 grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Fem (R$)</label>
                                          <input
                                            type="number"
                                            value={sector.priceFemale ?? ''}
                                            onChange={(e) => {
                                              setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, priceFemale: e.target.value === '' ? undefined : Number(e.target.value) } : s) } : b) });
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37]"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Masc (R$)</label>
                                          <input
                                            type="number"
                                            value={sector.priceMale ?? ''}
                                            onChange={(e) => {
                                              setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, priceMale: e.target.value === '' ? undefined : Number(e.target.value) } : s) } : b) });
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37]"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="md:col-span-2">
                                      <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Lim/CPF</label>
                                      <input 
                                        type="number" 
                                        value={sector.limitPerUser || 4}
                                        onChange={(e) => {
                                          setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, limitPerUser: Number(e.target.value) } : s) } : b) });
                                        }}
                                        min="1"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      {(() => {
                                        const cap = formEvent.capacity ?? 0;
                                        const totalOthers = formEvent.batches.reduce((sum, b, bi) =>
                                          sum + b.sectors.reduce((s2, sec, si) =>
                                            bi === batchIndex && si === sectorIndex ? s2 : s2 + (sec.quantity ?? 0), 0), 0);
                                        const maxAllowed = cap > 0 ? cap - totalOthers : Infinity;
                                        const isOver = cap > 0 && (sector.quantity ?? 0) > maxAllowed;
                                        return (
                                          <>
                                            <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">QTD Ingressos</label>
                                            <input
                                              type="number"
                                              min="0"
                                              value={sector.quantity === 0 ? '' : sector.quantity}
                                              onChange={(e) => {
                                                const raw = e.target.value;
                                                const newVal = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                                setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.map((s, si) => si === sectorIndex ? { ...s, quantity: newVal } : s) } : b) });
                                              }}
                                              placeholder="0"
                                              className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none ${isOver ? 'border-red-500' : 'border-white/10'}`}
                                            />
                                            {isOver && (
                                              <p className="mt-1 text-[9px] text-red-400">Máx: {maxAllowed > 0 ? maxAllowed : 0}</p>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                    
                                    <div className="md:col-span-1 flex items-end">
                                      <button
                                        onClick={() => {
                                          setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: b.sectors.filter((_, si) => si !== sectorIndex) } : b) });
                                        }}
                                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center rounded-lg transition"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              <button
                                onClick={() => {
                                  const newSector = { id: crypto.randomUUID(), name: '', quantity: 0, price: 0, limitPerUser: 4 };
                                  setFormEvent({ ...formEvent, batches: formEvent.batches.map((b, bi) => bi === batchIndex ? { ...b, sectors: [...b.sectors, newSector] } : b) });
                                }}
                                className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] hover:underline flex items-center gap-2"
                              >
                                <Plus className="w-3 h-3" /> Adicionar Setor neste Lote
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            const newBatch: Batch = {
                              id: crypto.randomUUID(),
                              name: `Lote ${formEvent.batches.length + 1}`,
                              startDate: new Date().toISOString().split('T')[0],
                              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              sectors: [{ id: crypto.randomUUID(), name: '', quantity: 0, price: 0, limitPerUser: 4 }],
                              is_active: true,
                            };
                            const updatedBatches = formEvent.batches.map(b => ({ ...b, is_active: false }));
                            setFormEvent({ ...formEvent, batches: [...updatedBatches, newBatch] });
                            setReleaseValidationFields(prev => prev.filter(f => f !== 'Pelo menos 1 Lote de Ingressos'));
                          }}
                          className="w-full py-6 border-2 border-dashed border-[#d4af37]/30 hover:border-[#d4af37]/50 bg-[#d4af37]/5 hover:bg-[#d4af37]/10 rounded-2xl flex flex-col items-center justify-center gap-2 transition group"
                        >
                          <Plus className="w-6 h-6 text-[#d4af37] opacity-70 group-hover:opacity-100 transition" />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37]">Adicionar Novo Lote</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (Media, Maps, Teams) */}
                  <div className="lg:col-span-4 space-y-8 md:space-y-10">
                    
                    {/* Section: Cover Media */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[#d4af37]">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-serif text-white uppercase tracking-widest">Mídia Oficial</h3>
                      </div>
                      <div className="space-y-6">
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileChange}
                        />
                        <div
                          onClick={() => imageFileInputRef.current?.click()}
                          className={`aspect-[4/5] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer transition-colors ${releaseValidationFields.includes('Imagem de Capa') ? 'border-red-500/60 bg-red-500/5 hover:border-red-500/80' : 'border-white/20 bg-white/2 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5'}`}
                        >
                            {formEvent.img ? (
                              <>
                                <img src={formEvent.img} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-40 transition" loading="lazy" decoding="async" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                  <div className="bg-black/80 px-4 py-2 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md">Alterar Imagem</div>
                                </div>
                              </>
                            ) : (
                              <div className="text-center p-6">
                                <UploadCloud className={`w-8 h-8 mx-auto mb-3 transition-colors ${releaseValidationFields.includes('Imagem de Capa') ? 'text-red-400/60 group-hover:text-red-400' : 'text-white/30 group-hover:text-[#d4af37]'}`} />
                                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-relaxed">Clique para escolher a imagem</p>
                                <p className="text-[8px] text-[#d4af37]/80 mt-2 uppercase tracking-widest border border-[#d4af37]/30 px-2 py-0.5 rounded-full inline-block">1080x1350px recomendado</p>
                              </div>
                            )}
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">... ou insira URL Direta</label>
                          <input
                            type="text"
                            value={formEvent.img}
                            onChange={(e) => {
                              setFormEvent({ ...formEvent, img: e.target.value });
                              if (e.target.value.trim()) setReleaseValidationFields(prev => prev.filter(f => f !== 'Imagem de Capa'));
                            }}
                            placeholder="https://suaimagem.com/foto.jpg"
                            className={`w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-xs focus:border-[#d4af37] outline-none ${releaseValidationFields.includes('Imagem de Capa') ? 'border-red-500/60' : 'border-white/10'}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section: URL e Politicas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-serif text-white uppercase tracking-widest">Links & SEO</h3>
                      </div>
                      <div className="space-y-5">
                         <div>
                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">URL Personalizada</label>
                          <div className="flex">
                            <span className="bg-white/5 border border-white/10 border-r-0 rounded-l-xl px-3 py-3 text-[10px] opacity-40 flex items-center">domain.com/</span>
                            <input 
                              type="text" 
                              value={formEvent.customUrl || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, customUrl: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                              placeholder="reveillon-2025"
                              className="w-full bg-[#d4af37]/5 text-[#d4af37] font-bold border border-white/10 rounded-r-xl px-4 py-3 text-sm focus:border-[#d4af37] outline-none transition-all placeholder:text-[#d4af37]/30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Instagram (@)</label>
                          <input 
                            type="text" 
                            value={formEvent.socialLinks?.instagram || ''}
                            onChange={(e) => setFormEvent({ ...formEvent, socialLinks: {...formEvent.socialLinks, instagram: e.target.value} })}
                            placeholder="@evento"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-3 text-sm focus:border-[#d4af37] outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Política Especial/Reembolso</label>
                          <textarea 
                            value={formEvent.refundPolicy || ''}
                            onChange={(e) => setFormEvent({ ...formEvent, refundPolicy: e.target.value })}
                            placeholder="Deixe em branco para usar a política padrão da plataforma..."
                            rows={3}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-3 text-xs focus:border-[#d4af37] outline-none transition-all resize-none"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* Section: Reserva de Mesas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
                              <Square className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-serif text-white uppercase tracking-widest">Apoio & Mesas</h3>
                         </div>
                         <button 
                            onClick={() => {
                              if (!formEvent.hasTables && !formEvent.tableConfig) {
                                const defaultTables = 30;
                                const defaultBistros = 10;
                                setFormEvent({
                                  ...formEvent,
                                  hasTables: true,
                                  tableConfig: { totalTables: defaultTables, seatsPerTable: 4, gridRows: 8, gridCols: 5, totalBistros: defaultBistros },
                                  tableLayout: generateDefaultLayout(defaultTables, defaultBistros, 4),
                                });
                              } else {
                                setFormEvent({ ...formEvent, hasTables: !formEvent.hasTables });
                              }
                            }}
                            className={`w-12 h-6 rounded-full transition-colors relative ${formEvent.hasTables ? 'bg-[#d4af37]' : 'bg-white/10'}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${formEvent.hasTables ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                          </button>
                      </div>

                      {formEvent.hasTables && formEvent.tableConfig && (
                        <div className="space-y-4 animate-in fade-in duration-300 relative">
                          {/* Row 1: Mesas + Bistrôs */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">
                                Total de Mesas{!!formEvent.tableLayout?.length && <span className="ml-1 text-[#d4af37]/50">(auto)</span>}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={30}
                                disabled={!!formEvent.tableLayout?.length}
                                title={formEvent.tableLayout?.length ? 'Definido automaticamente pelo layout' : undefined}
                                value={formEvent.tableConfig.totalTables}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, totalTables: Math.min(30, Number(e.target.value)) } })}
                                className={`w-full bg-white/[0.03] border rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] ${formEvent.tableLayout?.length ? 'opacity-40 cursor-not-allowed' : ''} ${formEvent.tableConfig.totalTables > 30 ? 'border-red-500/60' : 'border-white/10'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">
                                Total de Bistrôs{!!formEvent.tableLayout?.length && <span className="ml-1 text-[#d4af37]/50">(auto)</span>}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                disabled={!!formEvent.tableLayout?.length}
                                title={formEvent.tableLayout?.length ? 'Definido automaticamente pelo layout' : undefined}
                                value={formEvent.tableConfig.totalBistros ?? 0}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, totalBistros: Math.min(10, Number(e.target.value)) } })}
                                className={`w-full bg-white/[0.03] border rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] ${formEvent.tableLayout?.length ? 'opacity-40 cursor-not-allowed' : ''} ${(formEvent.tableConfig.totalBistros ?? 0) > 10 ? 'border-red-500/60' : 'border-white/10'}`}
                              />
                            </div>
                          </div>

                          {/* Row 2: Lugares + Valor Mesa */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">Lugares/Mesa</label>
                              <input
                                type="number"
                                value={formEvent.tableConfig.seatsPerTable}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, seatsPerTable: Number(e.target.value) } })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37]"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">Valor por Mesa (R$)</label>
                              <input
                                type="number"
                                min={0}
                                step={10}
                                placeholder="Ex: 300"
                                value={formEvent.tableConfig.tablePrice ?? ''}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, tablePrice: e.target.value !== '' ? Number(e.target.value) : undefined } })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] placeholder:opacity-30"
                              />
                            </div>
                          </div>

                          {/* Row 3: Valor Bistrô */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">Valor por Bistrô (R$)</label>
                              <input
                                type="number"
                                min={0}
                                step={10}
                                placeholder="Ex: 200"
                                value={formEvent.tableConfig.bistroPrice ?? ''}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, bistroPrice: e.target.value !== '' ? Number(e.target.value) : undefined } })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] placeholder:opacity-30"
                              />
                            </div>
                          </div>

                          {/* Preview do Mapa */}
                          <div className="pt-4 mt-2 border-t border-white/5">
                            <p className="text-[10px] uppercase font-bold text-[#C9A84C] mb-3 tracking-widest">Preview do Mapa</p>
                            {(() => {
                              const totalT = formEvent.tableConfig.totalTables;
                              const totalB = formEvent.tableConfig.totalBistros ?? 0;
                              const savedLayout = formEvent.tableLayout || [];
                              const hasElements = savedLayout.some(el =>
                                el.type === 'rect-table' || el.type === 'round-table' || el.type === 'bistro-table'
                              );
                              const previewElements = hasElements
                                ? savedLayout
                                : generateDefaultLayout(totalT, totalB, formEvent.tableConfig?.seatsPerTable ?? 4);
                              const viewBox = getLayoutViewBox(previewElements);
                              const [,, vbW, vbH] = viewBox.split(' ').map(Number);

                              return (
                                <div
                                  className="bg-[#111111] rounded-xl border border-[#2a2a2a] overflow-hidden"
                                  style={{ padding: 16 }}
                                >
                                  <div className="w-full overflow-x-auto overflow-y-auto" style={{ maxHeight: 360 }}>
                                    <svg
                                      viewBox={viewBox}
                                      style={{ display: 'block', width: '100%', height: 'auto', minHeight: 200 }}
                                    >
                                      <defs>
                                        <pattern id="previewGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                          <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.04)" />
                                        </pattern>
                                      </defs>
                                      <rect width={vbW} height={vbH} fill="#111111" />
                                      <rect width={vbW} height={vbH} fill="url(#previewGrid)" />
                                      {/* Palco — fiel ao SVG original */}
                                      <text x={vbW / 2} y="50" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="10" letterSpacing="3">ÁREA DE CARGA E DESCARGA</text>
                                      <rect x="50" y="70" width="650" height="150" fill="#1a1a1a" stroke="#C9A84C" strokeWidth="2" />
                                      <text x="375" y="157" textAnchor="middle" fill="#C9A84C" fontSize="26" fontWeight="bold" letterSpacing="8" opacity="0.85">PALCO</text>
                                      <rect x="50" y="160" width="75" height="60" fill="#151515" stroke="#C9A84C" strokeWidth="1.5" opacity="0.75" />
                                      <line x1="50" y1="175" x2="125" y2="175" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />
                                      <line x1="50" y1="190" x2="125" y2="190" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />
                                      <line x1="50" y1="205" x2="125" y2="205" stroke="#C9A84C" strokeWidth="1.2" opacity="0.45" />
                                      {/* Elementos */}
                                      {previewElements.map(el => {
                                        const cx = el.x + el.width / 2;
                                        const cy = el.y + el.height / 2;
                                        const isMesa = el.type === 'rect-table' || el.type === 'round-table';
                                        const isBistro = el.type === 'bistro-table';
                                        if (isMesa) {
                                          const half = 17; const cs = 7; const gap = 3;
                                          return (
                                            <g key={el.id}>
                                              <rect x={cx - cs/2} y={cy - half - gap - cs} width={cs} height={cs} rx="1" fill="#444" />
                                              <rect x={cx - cs/2} y={cy + half + gap} width={cs} height={cs} rx="1" fill="#444" />
                                              <rect x={cx - half - gap - cs} y={cy - cs/2} width={cs} height={cs} rx="1" fill="#444" />
                                              <rect x={cx + half + gap} y={cy - cs/2} width={cs} height={cs} rx="1" fill="#444" />
                                              <rect x={cx - half} y={cy - half} width={half*2} height={half*2} rx="3" fill="#C9A84C" stroke="#111" strokeWidth="1.2" />
                                              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1a1a1a">{el.label}</text>
                                            </g>
                                          );
                                        }
                                        if (isBistro) {
                                          return (
                                            <g key={el.id}>
                                              <circle cx={cx} cy={cy} r={20} fill="#8B4513" stroke="#C9A84C" strokeWidth="1.5" />
                                              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#C9A84C">{el.label}</text>
                                            </g>
                                          );
                                        }
                                        return (
                                          <g key={el.id}>
                                            <rect x={el.x} y={el.y} width={el.width} height={el.height} rx="4" fill="#374151" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">{el.label}</text>
                                          </g>
                                        );
                                      })}
                                    </svg>
                                  </div>
                                </div>
                              );
                            })()}
                            <button
                              onClick={() => {
                                if (!formEvent) return;
                                const total = formEvent.tableConfig?.totalTables || 0;
                                const totalB = formEvent.tableConfig?.totalBistros || 0;
                                const currentLayout = formEvent.tableLayout || [];
                                const hasTableElements = currentLayout.some(
                                  el => el.type === 'rect-table' || el.type === 'round-table'
                                );
                                if (!hasTableElements && total > 0) {
                                  setFormEvent({
                                    ...formEvent,
                                    tableLayout: generateDefaultLayout(total, totalB, formEvent.tableConfig?.seatsPerTable ?? 4),
                                  });
                                }
                                setIsTableLayoutEditorOpen(true);
                              }}
                              className="w-full mt-3 py-2.5 border border-[#C9A84C]/30 bg-[#C9A84C]/5 rounded-lg text-[9px] uppercase font-bold tracking-widest text-[#C9A84C] hover:bg-[#C9A84C]/10 transition"
                            >
                              Abrir Editor Visual (Drag &amp; Drop)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section: Equipe de Apoio / Staff */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
                          <Users className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-serif text-white uppercase tracking-widest">Equipe Alocada</h3>
                      </div>
                      <div className="space-y-4">
                         <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
                            {staffAccounts?.filter(s => formEvent.assignedStaffIds.includes(s.id)).map(staff => (
                               <div key={staff.id} className="flex flex-col items-center flex-shrink-0">
                                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-[#d4af37]/30 text-xs font-bold text-white mb-1">
                                    {staff.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-[8px] uppercase tracking-widest opacity-60 truncate w-12 text-center">{staff.name}</span>
                               </div>
                            ))}
                            {formEvent.assignedStaffIds.length === 0 && (
                              <p className="text-[10px] uppercase font-bold tracking-widest text-white/20 pb-2">Nenhum operador</p>
                            )}
                         </div>
                         <button 
                           onClick={() => setIsStaffModalOpen(true)}
                           className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs uppercase font-bold tracking-widest hover:bg-white/10 transition flex justify-center items-center gap-2"
                         >
                           <Plus className="w-4 h-4 opacity-50" />
                           Adicionar Operador
                         </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
) : dashboardMode === 'staff' ? (
              <div className="max-w-6xl mx-auto space-y-10 px-4 sm:px-0">
                {/* Add Staff Form - Now Horizontal and at the Top */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-[0_0_40px_rgba(212,175,55,0.03)]">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-[#d4af371a] flex items-center justify-center">
                      <Plus className="w-4 h-4 text-[#d4af37]" />
                    </div>
                    <h3 className="text-sm font-serif text-white uppercase tracking-widest opacity-60">Novo Colaborador</h3>
                  </div>
                  
                  <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] uppercase opacity-40 mb-3 font-bold tracking-widest ml-1">Nome Completo</label>
                      <input 
                        type="text" 
                        value={newStaff.name}
                        onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-[#d4af37] outline-none transition placeholder:opacity-20"
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase opacity-40 mb-3 font-bold tracking-widest ml-1">Usuário</label>
                      <input 
                        type="text" 
                        value={newStaff.username}
                        onChange={e => setNewStaff({...newStaff, username: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-[#d4af37] outline-none transition placeholder:opacity-20"
                        placeholder="joao_staff"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase opacity-40 mb-3 font-bold tracking-widest ml-1">Senha</label>
                      <input 
                        type="password" 
                        value={newStaff.password}
                        onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-[#d4af37] outline-none transition placeholder:opacity-20"
                        placeholder="••••••"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-4 bg-[#d4af37] text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(212,175,55,0.1)] active:scale-95 duration-300"
                    >
                      <Plus className="w-4 h-4 stroke-[3px]" /> Cadastrar
                    </button>
                  </form>
                </div>

                {/* Staff List - Responsive Card/Table Layout */}
                <div className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-3xl overflow-hidden shadow-2xl">
                  <div className="px-6 md:px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                    <h4 className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold opacity-30">Equipe Cadastrada</h4>
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/[0.01]">
                          <th className="px-8 py-6 text-[10px] uppercase opacity-40 font-bold tracking-widest">Nome</th>
                          <th className="px-8 py-6 text-[10px] uppercase opacity-40 font-bold tracking-widest">Identificador de Usuário</th>
                          <th className="px-8 py-6 text-[10px] uppercase opacity-40 font-bold tracking-widest text-center">Nível de Acesso</th>
                          <th className="px-8 py-6 text-[10px] uppercase opacity-40 font-bold tracking-widest"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {staffAccounts.map(staff => (
                          <tr key={staff.id} className="hover:bg-white/[0.03] transition-colors group">
                            <td className="px-8 py-6 font-medium text-sm text-white/90">{staff.name}</td>
                            <td className="px-8 py-6 text-sm text-[#d4af37] font-mono">@{staff.username}</td>
                            <td className="px-8 py-6 text-center">
                              <span className="text-[9px] uppercase tracking-widest font-black px-4 py-1.5 bg-[#d4af371a] text-[#d4af37] rounded-full border border-[#d4af3733]">Colaborador</span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button 
                                onClick={() => setStaffAccounts(prev => prev.filter(s => s.id !== staff.id))}
                                className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Remover Colaborador"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-white/5">
                    {staffAccounts.map(staff => (
                      <div key={staff.id} className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-white/90">{staff.name}</p>
                            <p className="text-[11px] text-[#d4af37] font-mono mt-1">@{staff.username}</p>
                          </div>
                          <button 
                            onClick={() => setStaffAccounts(prev => prev.filter(s => s.id !== staff.id))}
                            className="p-2 text-red-500 bg-red-500/10 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] uppercase tracking-widest font-black px-3 py-1 bg-[#d4af371a] text-[#d4af37] rounded-full border border-[#d4af3733]">Colaborador</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {staffAccounts.length === 0 && (
                    <div className="px-8 py-20 text-center">
                      <UserCog className="w-12 md:w-16 h-12 md:h-16 text-white/5 mx-auto mb-6" />
                      <p className="text-[10px] md:text-xs opacity-20 uppercase tracking-[0.2em] md:tracking-[0.3em] font-medium italic">Nenhum colaborador na base de dados</p>
                    </div>
                  )}
                </div>
              </div>
            ) : dashboardMode === 'settings' && !isAtLeast('admin') ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4 sm:px-0">
                  <ShieldAlert className="w-16 h-16 text-red-500 opacity-80 mb-6" />
                  <h2 className="text-2xl font-serif text-red-500 mb-2">Acesso Negado</h2>
                  <p className="text-xs uppercase tracking-widest opacity-40 max-w-sm">
                    Você não tem permissão para acessar esta área.
                  </p>
                </div>
            ) : dashboardMode === 'settings' && isAtLeast('admin') ? (
              <AdminSettings
                userRole={userRole}
                onSettingsSaved={(name, logo, settings) => setSiteConfig(prev => ({
                  ...prev,
                  platformName: name,
                  platformLogo: logo,
                  address: settings?.address,
                  contactPhone: settings?.contactPhone,
                  contactEmail: settings?.contactEmail,
                  socialInstagram: settings?.socialInstagram,
                  companyName: settings?.companyName,
                  tradeName: settings?.tradeName,
                  personType: settings?.personType,
                }))}
              />
            ) : dashboardMode === 'developer-panel' && userRole === 'developer' ? (
              <DeveloperPanel />
            ) : dashboardMode === 'admin-overview' && isAtLeast('admin') ? (
              <AdminOverviewPanel events={events} buyers={buyers} reservations={reservations} />
            ) : dashboardMode === 'dev-overview' && userRole === 'developer' ? (
              <DevOverviewPanel events={events} buyers={buyers} reservations={reservations} systemLogs={systemLogs} clearSystemLogs={clearSystemLogs} />
            ) : null}
            </>
          )}
        </div>
  );
}
