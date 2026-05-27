import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Check, Smartphone, AlertTriangle,
  Users, Mail, RefreshCcw, ShieldAlert, Tag,
} from 'lucide-react';
import { useApp } from './context/AppContext';
import { AdminSidebar } from './shared/components/AdminSidebar';
import { Navbar } from './shared/components/Navbar';
import { Toast } from './shared/components/Toast';
import { ConsentBanner } from './shared/components/ConsentBanner';
import { Home } from './components/Home';
import { BookingView } from './modules/booking/BookingView';
import { ReservationsView } from './modules/reservations/ReservationsView';
import { ContactView } from './modules/contact/ContactView';
import { AuthView } from './modules/auth/AuthView';
import { ProfileView } from './modules/profile/ProfileView';
import { PrivacySettingsView } from './modules/profile/PrivacySettingsView';
import { PrivacyView } from './modules/privacy/PrivacyView';
import { TermsView } from './modules/terms/TermsView';
import { DashboardView } from './modules/dashboard/DashboardView';
import { CheckoutModal } from './modules/payment/CheckoutModal';
import { TableLayoutEditor } from './components/TableLayoutEditor';
import { InstallPrompt } from './components/InstallPrompt';

export function App() {
  const {
    isAdminLayout, currentView, isPreviewingEvent, consentData, saveConsent,
    setCurrentView, setDashboardMode, setIsPreviewingEvent,
    adminScrollRef, events, loadingEvents, selectedDashboardEvent, setFormEvent,
    isTableLayoutEditorOpen, setIsTableLayoutEditorOpen, formEvent, showToast,
    actionTicket, setActionTicket, actionError, setActionError,
    reservations, setReservations,
    isStaffModalOpen, setIsStaffModalOpen, staffAccounts,
    isMessageModalOpen, setIsMessageModalOpen, messageText, setMessageText, buyers,
    isLogsModalOpen, setIsLogsModalOpen,
  } = useApp();

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans selection:bg-[#d4af37]/30 ${isAdminLayout ? 'flex' : ''}`}>

      {isAdminLayout ? <AdminSidebar /> : <Navbar />}

      <div
        ref={adminScrollRef}
        data-lenis-prevent
        className={`${isAdminLayout ? 'flex-1 h-screen overflow-y-auto custom-scrollbar relative' : 'w-full'} flex flex-col`}
      >
        <main className={`${isAdminLayout ? 'pt-20 md:pt-10' : 'pt-16 md:pt-20'} pb-24 px-0 md:px-0 flex-1`}>

          {currentView === 'home' && (
            <Home
              events={events}
              loading={loadingEvents}
              onEventClick={event => {
                setFormEvent({ ...event });
                setCurrentView('booking');
              }}
            />
          )}

          {isPreviewingEvent && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-500">
              <button
                onClick={() => {
                  setCurrentView('dashboard');
                  setDashboardMode('edit');
                  setIsPreviewingEvent(false);
                  if (selectedDashboardEvent) {
                    const evt = events.find(e => e.id === selectedDashboardEvent);
                    if (evt) setFormEvent({ ...evt });
                  }
                }}
                className="flex items-center gap-3 px-8 py-4 bg-[#d4af37] text-black font-black text-xs rounded-full uppercase tracking-widest shadow-[0_20px_50px_rgba(212,175,55,0.4)] hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-md border border-white/20"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar à Edição
              </button>
            </div>
          )}

          {currentView === 'booking' && <BookingView />}
          {currentView === 'reservations' && <ReservationsView />}
          {currentView === 'contact' && <ContactView />}
          {currentView === 'admin-login' && <AuthView />}
          {currentView === 'profile' && <ProfileView />}
          {currentView === 'profile-privacy' && <PrivacySettingsView />}
          {currentView === 'privacy' && <PrivacyView />}
          {currentView === 'terms' && <TermsView />}
          {currentView === 'dashboard' && <DashboardView />}

        </main>

        <footer className="px-6 md:px-10 py-8 md:py-6 border-t border-[#ffffff1a] flex flex-col md:flex-row justify-between items-center gap-6 bg-[#0a0a0a]/50 backdrop-blur-sm relative z-40">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-center md:text-left">
            <p className="text-[9px] md:text-[10px] opacity-40 uppercase tracking-widest">© 2026 Espaço Mix Eventos</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('privacy')}
                className="text-[9px] opacity-30 hover:opacity-60 uppercase tracking-widest transition"
              >
                Privacidade
              </button>
              <button
                onClick={() => setCurrentView('terms')}
                className="text-[9px] opacity-30 hover:opacity-60 uppercase tracking-widest transition"
              >
                Termos de Uso
              </button>
              {consentData && (
                <button
                  onClick={() => setCurrentView('profile-privacy')}
                  className="text-[9px] opacity-30 hover:opacity-60 uppercase tracking-widest transition"
                >
                  Cookies
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span className="text-[9px] md:text-[10px] opacity-60 uppercase tracking-[0.2em]">Reservas Ativas</span>
          </div>
        </footer>
      </div>

      <ConsentBanner />

      {/* Modal — Layout do Local */}
      <AnimatePresence>
        {isTableLayoutEditorOpen && formEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col"
          >
            <div className="px-4 md:px-8 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-serif text-[#d4af37]">Layout do Local</h3>
              <button
                onClick={() => setIsTableLayoutEditorOpen(false)}
                className="p-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 md:p-6 overflow-auto">
              <TableLayoutEditor
                initialLayout={formEvent.tableLayout || []}
                requiredTables={formEvent.tableConfig?.totalTables}
                requiredBistros={formEvent.tableConfig?.totalBistros}
                initialIconSize={formEvent.tableConfig?.globalIconSize}
                onSave={(layout, iconSize) => {
                  setFormEvent({
                    ...formEvent,
                    tableLayout: layout,
                    tableConfig: formEvent.tableConfig
                      ? { ...formEvent.tableConfig, globalIconSize: iconSize }
                      : undefined,
                  });
                  setIsTableLayoutEditorOpen(false);
                  showToast('Layout salvo com sucesso.', 'success');
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — Ingresso / Ação */}
      <AnimatePresence>
        {actionTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl"
            >
              <div className="flex justify-between items-center p-6 border-b border-white/10">
                <h3 className="text-xl font-serif text-[#d4af37]">
                  {actionTicket.type === 'edit' ? 'Dados do Participante' :
                   actionTicket.type === 'view' ? 'Detalhes do Ingresso' :
                   actionTicket.type === 'transfer' || actionTicket.type === 'transfer_table' ? 'Transferir' :
                   'Cancelar'}
                </h3>
                <button
                  onClick={() => { setActionTicket(null); setActionError(''); }}
                  className="text-white/50 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {actionTicket.type === 'view' ? (
                  <div className="space-y-4">
                    <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 space-y-3">
                      <p className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-4">Informações do Ingresso</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] uppercase opacity-40 tracking-widest mb-1">Nome</p>
                          <p className="text-sm font-medium text-white">{actionTicket.data?.name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase opacity-40 tracking-widest mb-1">Celular</p>
                          <p className="text-sm font-medium text-white flex items-center gap-1">
                            <Smartphone className="w-3 h-3 opacity-40" />
                            {actionTicket.data?.phone || <span className="opacity-40 italic">Não informado</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase opacity-40 tracking-widest mb-1">Email</p>
                          <p className="text-sm font-medium text-white break-all">{actionTicket.data?.email}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase opacity-40 tracking-widest mb-1">Lote / Tipo</p>
                          <span className="inline-block px-2 py-0.5 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded text-[10px] uppercase tracking-widest font-bold text-[#d4af37]">
                            {actionTicket.data?.type}
                          </span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-[9px] uppercase opacity-40 tracking-widest mb-2">Status de Acesso</p>
                        {actionTicket.data?.checkedIn
                          ? <span className="text-green-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>Acessou o evento</span>
                          : actionTicket.data?.status === 'Cancelado'
                          ? <span className="text-yellow-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>Cancelado</span>
                          : <span className="opacity-40 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>Aguardando Check-in</span>
                        }
                      </div>
                      <p className="text-[10px] opacity-30 font-mono pt-2 border-t border-white/5">ID: {actionTicket.data?.id}</p>
                    </div>
                    <button
                      onClick={() => setActionTicket(null)}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs uppercase font-bold tracking-widest transition"
                    >
                      Fechar
                    </button>
                  </div>
                ) : actionTicket.type === 'cancel' || actionTicket.type === 'cancel_table' ? (
                  <>
                    <p className="text-sm opacity-70 mb-4">
                      {actionTicket.type === 'cancel_table'
                        ? 'Tem certeza que deseja cancelar esta mesa inteira? Esta ação invalidará o QR Code de todos os ocupantes.'
                        : 'Tem certeza que deseja cancelar este ingresso? Esta ação invalidará o QR Code permanentemente.'}
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-6 text-xs text-white/50">
                      Regras de reembolso: O estorno será processado automaticamente para pagamentos via PIX ou em até 2 faturas no cartão de crédito, caso o cancelamento ocorra em até 48h antes do evento.
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => { setActionTicket(null); setActionError(''); }}
                        className="flex-1 py-3 text-[10px] uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
                      >
                        Manter
                      </button>
                      <button
                        onClick={() => {
                          const updated = reservations.map(res => {
                            if (actionTicket.type === 'cancel_table' && res.id === actionTicket.reservationId) {
                              return { ...res, ticketsObj: res.ticketsObj?.map(t => t.tableNumber === actionTicket.id ? { ...t, status: 'cancelled' as const } : t) };
                            } else if (actionTicket.type === 'cancel') {
                              return { ...res, ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id ? { ...t, status: 'cancelled' as const } : t) };
                            }
                            return res;
                          });
                          setReservations(updated);
                          setActionTicket(null);
                        }}
                        className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition"
                      >
                        Confirmar Cancelamento
                      </button>
                    </div>
                  </>
                ) : actionTicket.type === 'transfer' || actionTicket.type === 'transfer_table' ? (
                  <>
                    {actionTicket.data?.transferStep === 2 ? (
                      <>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-2">
                          <p className="text-[10px] uppercase tracking-widest opacity-40">E-mail do destinatário</p>
                          <p className="text-base font-semibold text-white break-all">{actionTicket.data?.email}</p>
                          <p className="text-[10px] opacity-50">Verifique se o e-mail está correto antes de confirmar.</p>
                        </div>
                        {actionError && <p className="text-red-400 text-xs text-center mt-2">{actionError}</p>}
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() => { setActionTicket({ ...actionTicket, data: { ...actionTicket.data, transferStep: 1 } }); setActionError(''); }}
                            className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
                          >
                            Voltar
                          </button>
                          <button
                            onClick={() => {
                              const expiresAt = Date.now() + 3540000;
                              showToast(`Convite enviado para ${actionTicket.data.email}. A transferência expira em 59 minutos.`, 'success');
                              const updated = reservations.map(res => {
                                if (actionTicket.type === 'transfer_table' && res.id === actionTicket.reservationId) {
                                  return { ...res, ticketsObj: res.ticketsObj?.map(t => t.tableNumber === actionTicket.id ? { ...t, status: 'pending_transfer' as const, pendingTransferEmail: actionTicket.data?.email, transferExpiresAt: expiresAt } : t) };
                                } else if (actionTicket.type === 'transfer') {
                                  return { ...res, ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id ? { ...t, status: 'pending_transfer' as const, pendingTransferEmail: actionTicket.data?.email, transferExpiresAt: expiresAt } : t) };
                                }
                                return res;
                              });
                              setReservations(updated);
                              setActionTicket(null);
                            }}
                            className="flex-1 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-xl hover:brightness-110 transition"
                          >
                            Confirmar Envio
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-300 leading-relaxed">Cada ingresso pode ser transferido no máximo <strong>duas vezes</strong>. Esta ação não poderá ser desfeita após a aceitação do destinatário.</p>
                        </div>
                        <p className="text-xs opacity-60 mt-1">O destinatário precisa ter cadastro no site. Um e-mail será enviado para que ele confirme a transferência.</p>
                        <div className="mt-3">
                          <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-2 px-1">E-mail do Destinatário</label>
                          <input
                            type="email"
                            value={actionTicket.data?.email || ''}
                            onChange={(e) => { setActionTicket({ ...actionTicket, data: { ...actionTicket.data, email: e.target.value } }); setActionError(''); }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                            placeholder="destinatario@email.com"
                          />
                        </div>
                        {actionError && <p className="text-red-400 text-xs text-center mt-2">{actionError}</p>}
                        <button
                          onClick={() => {
                            if (!actionTicket.data?.email || !actionTicket.data.email.includes('@')) {
                              setActionError('Insira um e-mail válido.');
                              return;
                            }
                            setActionTicket({ ...actionTicket, data: { ...actionTicket.data, transferStep: 2 } });
                            setActionError('');
                          }}
                          disabled={!actionTicket.data?.email}
                          className="w-full mt-4 py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-xl hover:brightness-110 transition disabled:opacity-50"
                        >
                          Continuar
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-2 px-1">Nome Completo</label>
                      <input
                        type="text"
                        value={actionTicket.data?.name || ''}
                        onChange={(e) => setActionTicket({ ...actionTicket, data: { ...actionTicket.data, name: e.target.value } })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-2 px-1">CPF</label>
                      <input
                        type="text"
                        value={actionTicket.data?.cpf || ''}
                        onChange={(e) => setActionTicket({ ...actionTicket, data: { ...actionTicket.data, cpf: e.target.value } })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-2 px-1">E-mail (Opcional)</label>
                      <input
                        type="email"
                        value={actionTicket.data?.email || ''}
                        onChange={(e) => setActionTicket({ ...actionTicket, data: { ...actionTicket.data, email: e.target.value } })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 transition"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const updated = reservations.map(res => ({
                          ...res,
                          ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id
                            ? { ...t, ownerName: actionTicket.data?.name || '', ownerCpf: actionTicket.data?.cpf || '', ownerEmail: actionTicket.data?.email || '' }
                            : t
                          )
                        }));
                        setReservations(updated);
                        setActionTicket(null);
                      }}
                      disabled={!actionTicket.data?.name || !actionTicket.data?.cpf}
                      className="w-full mt-4 py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-xl hover:brightness-110 transition disabled:opacity-50"
                    >
                      Salvar Dados
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — Equipe de Campo */}
      <AnimatePresence>
        {isStaffModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0d0d0d] border border-white/10 p-6 md:p-8 w-full max-w-2xl rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.05)] max-h-[80vh] flex flex-col items-center justify-center text-center relative"
            >
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-serif mb-2 text-[#d4af37]">Equipe de Campo</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-8 max-w-sm mx-auto">
                Selecione os colaboradores que participarão deste evento
              </p>
              <div className="w-full flex-1 overflow-y-auto pr-2 custom-scrollbar text-left mb-6">
                {staffAccounts.length === 0 ? (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-8 text-center text-[10px] uppercase tracking-[0.2em] opacity-40">
                    Nenhum colaborador cadastrado no sistema.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {staffAccounts.map(staff => {
                      const isAssigned = formEvent?.assignedStaffIds?.includes(staff.id) || false;
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            if (!formEvent) return;
                            const ids = formEvent.assignedStaffIds || [];
                            setFormEvent({
                              ...formEvent,
                              assignedStaffIds: isAssigned ? ids.filter(id => id !== staff.id) : [...ids, staff.id],
                            });
                          }}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${isAssigned ? 'bg-[#d4af37]/10 border-[#d4af37]/50 shadow-[0_0_15px_rgba(212,175,55,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${isAssigned ? 'bg-[#d4af37] border-[#d4af37]' : 'border-white/30'}`}>
                            {isAssigned && <Check className="w-3 h-3 text-black" />}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white truncate">{staff.name}</span>
                            <span className={`text-[10px] font-mono mt-0.5 truncate ${isAssigned ? 'text-[#d4af37]' : 'text-white/40'}`}>@{staff.username}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="w-full sm:w-auto px-10 py-4 bg-[#d4af37] text-black font-black text-xs rounded-xl uppercase tracking-widest hover:brightness-110 shadow-lg shadow-[#d4af3733] transition-all transform hover:scale-105 active:scale-95"
              >
                Concluir Seleção
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — Disparo em Massa */}
      <AnimatePresence>
        {isMessageModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0d0d0d] border border-white/10 p-6 md:p-8 w-full max-w-xl rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.05)] relative"
            >
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-serif mb-2 text-white">Disparo em Massa</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-2">
                Envie um aviso para todos os clientes deste evento.
              </p>
              <div className="flex items-center gap-2 mb-6 p-3 bg-white/5 border border-white/10 rounded-xl">
                <Users className="w-4 h-4 text-[#d4af37] opacity-70" />
                <span className="text-[11px] text-white/60">
                  <strong className="text-white">{buyers.length}</strong> destinatário{buyers.length !== 1 ? 's' : ''} receberão este aviso
                </span>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[9px] uppercase tracking-widest opacity-40 mb-2">Mensagem</label>
                  <textarea
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    placeholder="Escreva seu aviso aqui..."
                    rows={5}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d4af37] outline-none transition-all resize-none text-white"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!messageText.trim()) { showToast('Escreva uma mensagem primeiro', 'warning'); return; }
                  showToast('Aviso sendo enviado para todos...', 'success');
                  setIsMessageModalOpen(false);
                  setMessageText('');
                }}
                className="w-full px-10 py-4 bg-[#d4af37] text-black font-black text-xs rounded-xl uppercase tracking-widest hover:brightness-110 shadow-lg shadow-[#d4af3733] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Enviar Agora
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — Histórico do Evento */}
      <AnimatePresence>
        {isLogsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0d0d0d] border border-white/10 p-6 md:p-8 w-full max-w-2xl rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.05)] relative max-h-[85vh] flex flex-col"
            >
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-serif mb-2 text-white">Histórico do Evento</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-6 border-b border-white/5 pb-4">
                Registro de auditoria completo
              </p>
              <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                {[1,2,3,4,5,6,7,8].map((i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-white/[0.02] transition border border-transparent hover:border-white/5 group">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                      {i % 3 === 0 ? <RefreshCcw className="w-3 h-3 text-blue-400 opacity-70" /> : i % 2 === 0 ? <ShieldAlert className="w-3 h-3 text-red-500 opacity-70" /> : <Tag className="w-3 h-3 text-[#d4af37] opacity-70" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white mb-1 group-hover:text-[#d4af37] transition-colors">
                        {i % 3 === 0 ? 'Transferência de Ingresso aprovada' : i % 2 === 0 ? 'Ação administrativa de emergência executada' : 'Novo Lote Cadastrado'}
                      </p>
                      <span className="text-[10px] uppercase tracking-widest opacity-40">
                        Usuário_x{i}983 • {i * 2} horas atrás
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex justify-center text-xs opacity-30 mt-4 border-t border-white/5 py-4">
                  Fim do histórico visível.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CheckoutModal />
      <Toast />
      <InstallPrompt />
    </div>
  );
}
