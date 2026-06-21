import React, { Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Check, Smartphone, AlertTriangle,
  Users, Mail, RefreshCcw, ShieldAlert, Tag,
} from 'lucide-react';
import { useApp } from './context/AppContext';
import { supabase, getAccessTokenSafe, isSupabaseConfigured } from './lib/supabase';
import { AdminSidebar } from './shared/components/AdminSidebar';
import { Navbar } from './shared/components/Navbar';
import { Toast } from './shared/components/Toast';
import { ConsentBanner } from './shared/components/ConsentBanner';
import { Home } from './components/Home';
import { Footer } from './components/Footer';
import { SplashScreen } from './components/SplashScreen';
import { BookingView } from './modules/booking/BookingView';
import { ReservationsView } from './modules/reservations/ReservationsView';
import { CartView } from './modules/cart/CartView';
import { ContactView } from './modules/contact/ContactView';
import { AuthView } from './modules/auth/AuthView';
import { ProfileView } from './modules/profile/ProfileView';
import { PrivacySettingsView } from './modules/profile/PrivacySettingsView';
import { LegalView } from './modules/legal/LegalView';
import { InstallPrompt } from './components/InstallPrompt';
import { AdminOnboarding } from './components/AdminOnboarding';
import { CompleteProfileModal } from './components/CompleteProfileModal';
import { EmailCodeModal } from './components/EmailCodeModal';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { generateDefaultLayout } from './shared/utils/defaultLayout';
import type { TableLayoutElement } from './components/TableLayoutEditor';

function isDefaultLayout(layout: TableLayoutElement[], def: TableLayoutElement[]): boolean {
  if (layout.length !== def.length) return false;
  return layout.every((el, i) => el.type === def[i].type);
}

/**
 * React.lazy com retry: se o import de um chunk falhar (ex.: chunk obsoleto após
 * novo deploy na Vercel), tenta novamente 1x; persistindo a falha, força um único
 * reload completo da página para puxar o index.html/manifest atualizados.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string,
) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        return await factory();
      } catch (err2) {
        const flag = `chunk-reload-${chunkName}`;
        if (!sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, '1');
          window.location.reload();
          // Promise que nunca resolve enquanto a página recarrega
          return await new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}

// Lazy-loaded: carregados sob demanda para reduzir o bundle inicial
const DashboardView = lazyWithRetry(
  () => import('./modules/dashboard/DashboardView').then(m => ({ default: m.DashboardView })),
  'dashboard',
);
const CheckoutModal = lazyWithRetry(
  () => import('./modules/payment/CheckoutModal').then(m => ({ default: m.CheckoutModal })),
  'checkout',
);
const TableLayoutEditor = lazyWithRetry(
  () => import('./components/TableLayoutEditor').then(m => ({ default: m.TableLayoutEditor })),
  'table-editor',
);

export function App() {
  const {
    isAdminLayout, currentView, isPreviewingEvent, consentData, saveConsent,
    setCurrentView, setDashboardMode, setIsPreviewingEvent,
    adminScrollRef, events, loadingEvents, selectedDashboardEvent, setSelectedDashboardEvent, setFormEvent,
    isTableLayoutEditorOpen, setIsTableLayoutEditorOpen, formEvent, showToast,
    actionTicket, setActionTicket, actionError, setActionError,
    reservations, setReservations,
    isStaffModalOpen, setIsStaffModalOpen, staffAccounts,
    isMessageModalOpen, setIsMessageModalOpen, messageText, setMessageText, buyers,
    isLogsModalOpen, setIsLogsModalOpen, userRole,
    showOnboarding, developerConfig,
    dataLoadError, retryDataLoad,
    showExitConfirm, setShowExitConfirm, confirmExitApp,
    reloadReservations,
  } = useApp();

  const [resendingEmail, setResendingEmail] = React.useState(false);
  const [cancellingTicket, setCancellingTicket] = React.useState(false);

  // Splash screen — exibe apenas 1x por sessão
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem('splash-shown')) return false;
    return true;
  });
  const handleSplashComplete = () => {
    sessionStorage.setItem('splash-shown', '1');
    setShowSplash(false);
  };

  // Remove o splash HTML inline se a splash React não for exibida
  useEffect(() => {
    if (!showSplash) {
      const htmlSplash = document.getElementById('html-splash');
      if (htmlSplash) {
        htmlSplash.style.opacity = '0';
        setTimeout(() => htmlSplash.remove(), 300);
      }
    }
  }, [showSplash]);

  const handleCancelConfirm = async () => {
    if (!actionTicket || cancellingTicket) return;
    setCancellingTicket(true);
    setActionError('');
    try {
      const token = await getAccessTokenSafe();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      if (actionTicket.type === 'cancel') {
        const resp = await fetch(`/api/ticket/${actionTicket.id}/cancel`, { method: 'POST', headers });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? 'Erro ao cancelar ingresso');
        }
        const data = await resp.json();
        setReservations(reservations.map(res => ({
          ...res,
          ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id ? { ...t, status: 'cancelled' as const } : t),
        })));
        const res = reservations.find(r => r.ticketsObj?.some(t => t.id === actionTicket.id));
        if (data.refundStatus === 'failed') {
          showToast('Ingresso cancelado, mas o estorno automático falhou. Nossa equipe fará o reembolso manualmente.', 'warning');
        } else if (data.refundStatus === 'manual_required') {
          showToast('Ingresso cancelado. O estorno será processado manualmente pela organização.', 'info');
        } else if (data.refundStatus === 'processed') {
          if (res?.paymentMethod === 'pix') {
            showToast(`Ingresso cancelado. Estorno de R$ ${(data.refundAmount ?? 0).toFixed(2)} devolvido automaticamente à conta PIX usada no pagamento (pode levar alguns dias úteis).`, 'success');
          } else {
            showToast(`Ingresso cancelado. Estorno de R$ ${(data.refundAmount ?? 0).toFixed(2)} devolvido ao cartão usado no pagamento.`, 'success');
          }
        } else {
          showToast('Ingresso cancelado com sucesso.', 'success');
        }
      } else if (actionTicket.type === 'cancel_table') {
        const reservation = reservations.find(r => r.id === actionTicket.reservationId);
        const tableTickets = reservation?.ticketsObj?.filter(t => t.tableNumber === actionTicket.id && t.status === 'active') ?? [];
        for (const tkt of tableTickets) {
          const resp = await fetch(`/api/ticket/${tkt.id}/cancel`, { method: 'POST', headers });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.error ?? 'Erro ao cancelar mesa');
          }
        }
        setReservations(reservations.map(res => {
          if (res.id !== actionTicket.reservationId) return res;
          return { ...res, ticketsObj: res.ticketsObj?.map(t => t.tableNumber === actionTicket.id ? { ...t, status: 'cancelled' as const } : t) };
        }));
        showToast('Mesa cancelada com sucesso.', 'success');
      }
      setActionTicket(null);
    } catch (err: any) {
      setActionError(err.message ?? 'Erro ao processar cancelamento');
    } finally {
      setCancellingTicket(false);
    }
  };

  const [transferringTicket, setTransferringTicket] = React.useState(false);

  // Aceitação de transferência recebida via link de e-mail (?transfer=<token>)
  const [transferToken, setTransferToken] = React.useState<string | null>(null);
  const [transferBusy, setTransferBusy] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('transfer');
    if (t) {
      setTransferToken(t);
      params.delete('transfer');
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const handleAcceptTransfer = async (accept: boolean) => {
    if (!transferToken || transferBusy) return;
    setTransferBusy(true);
    try {
      const token = await getAccessTokenSafe();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(`/api/transfer/${transferToken}/${accept ? 'accept' : 'reject'}`, { method: 'POST', headers });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error ?? 'Erro ao processar transferência');
      if (accept) {
        showToast(`Ingresso recebido${data.fromName ? ` de ${data.fromName}` : ''}! Confira em Minhas Reservas.`, 'success');
        reloadReservations();
        setCurrentView('reservations');
      } else {
        showToast('Transferência recusada.', 'info');
      }
      setTransferToken(null);
    } catch (err: any) {
      showToast(err.message ?? 'Erro ao processar transferência', 'error');
    } finally {
      setTransferBusy(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!actionTicket || transferringTicket) return;
    const email = actionTicket.data?.email;
    if (!email || !email.includes('@')) { setActionError('Insira um e-mail válido.'); return; }
    setTransferringTicket(true);
    setActionError('');
    try {
      const token = await getAccessTokenSafe();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      let ticketIds: string[] = [];
      if (actionTicket.type === 'transfer') {
        ticketIds = [actionTicket.id];
      } else {
        const reservation = reservations.find(r => r.id === actionTicket.reservationId);
        ticketIds = reservation?.ticketsObj?.filter(t => t.tableNumber === actionTicket.id && t.status === 'active').map(t => t.id) ?? [];
      }
      if (ticketIds.length === 0) throw new Error('Nenhum ingresso elegível para transferência.');

      for (const tid of ticketIds) {
        const resp = await fetch(`/api/ticket/${tid}/transfer`, { method: 'POST', headers, body: JSON.stringify({ toEmail: email }) });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? 'Erro ao transferir ingresso');
        }
      }
      setReservations(reservations.map(res => ({
        ...res,
        ticketsObj: res.ticketsObj?.map(t => ticketIds.includes(t.id)
          ? { ...t, status: 'pending_transfer' as const, pendingTransferEmail: email }
          : t),
      })));
      showToast(`Convite de transferência enviado para ${email}.`, 'success');
      setActionTicket(null);
    } catch (err: any) {
      setActionError(err.message ?? 'Erro ao transferir ingresso');
    } finally {
      setTransferringTicket(false);
    }
  };

  const handleResendConfirmationEmail = async (reservationId: string) => {
    if (resendingEmail) return;
    setResendingEmail(true);
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reservationId }),
      });
      if (resp.ok) {
        showToast('E-mail de confirmação reenviado.', 'success');
      } else {
        const body = await resp.json().catch(() => null);
        showToast(body?.error || 'Não foi possível reenviar o e-mail.', 'error');
      }
    } catch {
      showToast('Não foi possível reenviar o e-mail.', 'error');
    } finally {
      setResendingEmail(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-[#d4af37]" />
          </div>
          <h1 className="text-2xl font-serif text-[#d4af37] mb-3">Configuração incompleta</h1>
          <p className="text-sm text-white/60 leading-relaxed mb-6">
            O servidor não está configurado corretamente. Se o problema persistir, entre em contato com o suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#d4af37] text-black rounded-full text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Splash Screen (intro) */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

    <div className={`min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans selection:bg-[#d4af37]/30 overflow-x-hidden ${isAdminLayout ? 'flex' : ''}`}>

      {/* Skip link — acessibilidade para navegação por teclado */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[#d4af37] focus-visible:text-black focus-visible:rounded-lg focus-visible:font-bold focus-visible:text-xs focus-visible:uppercase focus-visible:tracking-widest"
      >
        Pular para conteúdo principal
      </a>

      {developerConfig.featureFlags.maintenanceMode && userRole !== 'developer' && (
        <div className="fixed top-0 inset-x-0 z-[120] bg-amber-500 text-black text-center py-1.5 text-[10px] font-black uppercase tracking-widest">
          ⚠ Site em manutenção — algumas funções podem estar indisponíveis
        </div>
      )}

      {isAdminLayout ? <AdminSidebar /> : (currentView !== 'admin-login' && currentView !== 'staff-portal') && <Navbar />}

      <div
        ref={adminScrollRef}
        data-lenis-prevent
        className={`${isAdminLayout ? 'flex-1 h-screen overflow-y-auto custom-scrollbar relative' : 'w-full'} flex flex-col`}
      >
        <main
          id="main-content"
          className={`${isAdminLayout ? 'pt-14 md:pt-10' : (currentView === 'admin-login' || currentView === 'staff-portal') ? 'pt-0' : 'pt-16 md:pt-20'} pb-24 md:pb-6 px-0 flex-1`}
          style={isAdminLayout ? { paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 16px))' } : undefined}
        >

          {currentView === 'home' && (
            <Home
              events={events}
              loading={loadingEvents}
              onEventClick={event => {
                // Sincroniza o evento selecionado para que activeEvent resolva o
                // evento clicado (e não o último selecionado no dashboard).
                setSelectedDashboardEvent(event.id);
                setIsPreviewingEvent(false);
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
          {currentView === 'cart' && <CartView />}
          {currentView === 'contact' && <ContactView />}
          {currentView === 'admin-login' && <AuthView />}
          {currentView === 'staff-portal' && <AuthView portal />}
          {currentView === 'profile' && userRole !== 'admin' && userRole !== 'developer' && <ProfileView />}
          {currentView === 'profile-privacy' && <PrivacySettingsView />}
          {currentView === 'privacy' && <LegalView initialTab="privacy" />}
          {currentView === 'terms' && <LegalView initialTab="terms" />}
          {currentView === 'dashboard' && (
            (userRole === 'admin' || userRole === 'developer' || userRole === 'staff') ? (
              <ErrorBoundary>
                <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" /></div>}>
                  <DashboardView />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
                <ShieldAlert className="w-16 h-16 text-red-500/70 mb-6" />
                <h2 className="text-2xl font-serif text-[#d4af37] mb-2">Acesso Restrito</h2>
                <p className="text-xs uppercase tracking-widest opacity-40 max-w-sm mb-8">
                  Esta área é exclusiva da administração e da equipe. Faça login pelo acesso restrito.
                </p>
                <button
                  onClick={() => setCurrentView('home')}
                  className="px-6 py-3 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition"
                >
                  Voltar ao início
                </button>
              </div>
            )
          )}

        </main>

        <Footer onNavigate={setCurrentView} showCookies={!!consentData} isAuthenticated={!!userRole} />
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
            <div
              className="px-4 md:px-8 py-3 md:py-4 border-b border-white/10 flex items-center justify-between shrink-0"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
            >
              <h3 className="text-base md:text-xl font-serif text-[#d4af37]">Layout do Local</h3>
              <button
                onClick={() => setIsTableLayoutEditorOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className="flex-1 p-3 md:p-6 overflow-auto"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            >
              <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" /></div>}>
              <TableLayoutEditor
                initialLayout={formEvent.tableLayout || []}
                defaultLayout={generateDefaultLayout(
                  formEvent.tableConfig?.totalTables ?? 30,
                  formEvent.tableConfig?.totalBistros ?? 10,
                  formEvent.tableConfig?.seatsPerTable ?? 4,
                )}
                requiredTables={undefined}
                requiredBistros={undefined}
                initialIconSize={formEvent.tableConfig?.globalIconSize}
                onSave={(layout, iconSize) => {
                  const totalTables = layout.filter(el => el.type === 'rect-table' || el.type === 'round-table').length;
                  const totalBistros = layout.filter(el => el.type === 'bistro-table').length;
                  const defLayout = generateDefaultLayout(
                    formEvent.tableConfig?.totalTables ?? 30,
                    formEvent.tableConfig?.totalBistros ?? 10,
                    formEvent.tableConfig?.seatsPerTable ?? 4,
                  );
                  const isDefault = isDefaultLayout(layout, defLayout);
                  setFormEvent({
                    ...formEvent,
                    tableLayout: layout,
                    tableLayoutIsCustom: !isDefault,
                    tableConfig: formEvent.tableConfig
                      ? { ...formEvent.tableConfig, globalIconSize: iconSize, totalTables, totalBistros }
                      : undefined,
                  });
                  setIsTableLayoutEditorOpen(false);
                  showToast('Layout salvo com sucesso.', 'success');
                }}
              />
              </Suspense>
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
                    {actionTicket.data?.status === 'Pago' && actionTicket.data?.email && (
                      <button
                        onClick={() => handleResendConfirmationEmail(actionTicket.data.id)}
                        disabled={resendingEmail}
                        className="w-full py-3 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#d4af37] rounded-xl text-xs uppercase font-bold tracking-widest transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                      >
                        <Mail className="w-4 h-4" />
                        {resendingEmail ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
                      </button>
                    )}
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
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-4 text-xs text-white/50">
                      {(() => {
                        const res = actionTicket.type === 'cancel'
                          ? reservations.find(r => r.ticketsObj?.some(t => t.id === actionTicket.id))
                          : reservations.find(r => r.id === actionTicket.reservationId);
                        if (res?.paymentMethod === 'pix') {
                          return 'Pagamento via PIX: o estorno é processado automaticamente pelo Mercado Pago para a chave PIX de origem. Prazo: até 10 dias úteis.';
                        }
                        return 'Regras de reembolso: O estorno será processado em até 2 faturas no cartão de crédito, caso o cancelamento ocorra em até 48h antes do evento.';
                      })()}
                    </div>
                    {actionError && <p className="text-red-400 text-xs text-center mb-3">{actionError}</p>}
                    <div className="flex gap-4">
                      <button
                        onClick={() => { setActionTicket(null); setActionError(''); }}
                        disabled={cancellingTicket}
                        className="flex-1 py-3 text-[10px] uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition disabled:opacity-40"
                      >
                        Manter
                      </button>
                      <button
                        onClick={handleCancelConfirm}
                        disabled={cancellingTicket}
                        className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition disabled:opacity-40"
                      >
                        {cancellingTicket ? 'Cancelando...' : 'Confirmar Cancelamento'}
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
                            onClick={handleTransferConfirm}
                            disabled={transferringTicket}
                            className="flex-1 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-xl hover:brightness-110 transition disabled:opacity-50"
                          >
                            {transferringTicket ? 'Enviando...' : 'Confirmar Envio'}
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
                onClick={async () => {
                  if (!messageText.trim()) { showToast('Escreva uma mensagem primeiro', 'warning'); return; }
                  if (!selectedDashboardEvent) { showToast('Nenhum evento selecionado', 'error'); return; }
                  try {
                    showToast('Enviando mensagens...', 'info');
                    const serverUrl = window.location.origin.replace(':5173', ':3000');
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const res = await fetch(`${serverUrl}/api/messages/broadcast`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ eventId: selectedDashboardEvent, message: messageText }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      showToast(`Enviado para ${data.sent} compradores${data.errors > 0 ? ` (${data.errors} falhas)` : ''}`, 'success');
                    } else {
                      showToast(data.error || 'Erro ao enviar', 'error');
                    }
                  } catch {
                    showToast('Erro de conexão com o servidor', 'error');
                  }
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
                {(() => {
                  const evRes = reservations
                    .filter(r => r.eventId === selectedDashboardEvent)
                    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
                  if (evRes.length === 0) {
                    return (
                      <p className="text-center text-xs opacity-30 italic py-10">
                        Nenhum registro para este evento ainda.
                      </p>
                    );
                  }
                  const fmt = (iso?: string) => iso
                    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—';
                  return (
                    <>
                      {evRes.map((r) => {
                        const paid = r.paymentStatus === 'approved';
                        const checkedIn = !!r.checkedIn;
                        return (
                          <div key={r.id} className="flex gap-4 p-4 rounded-xl hover:bg-white/[0.02] transition border border-transparent hover:border-white/5 group">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                              {checkedIn ? <ShieldAlert className="w-3 h-3 text-green-400 opacity-70" /> : paid ? <Tag className="w-3 h-3 text-[#d4af37] opacity-70" /> : <RefreshCcw className="w-3 h-3 text-blue-400 opacity-70" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white mb-1 group-hover:text-[#d4af37] transition-colors">
                                {checkedIn ? 'Check-in realizado' : paid ? 'Compra aprovada' : 'Reserva pendente'}
                                {' — '}{(r.ticketsObj?.length || 0)} ingresso(s)
                              </p>
                              <span className="text-[10px] uppercase tracking-widest opacity-40">
                                {r.buyerName || 'Cliente'} • {fmt(r.createdAt || r.date)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-4 flex justify-center text-xs opacity-30 mt-4 border-t border-white/5 py-4">
                        Fim do histórico.
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <CheckoutModal />
      </Suspense>
      <Toast />
      <InstallPrompt />
      {showOnboarding && <AdminOnboarding />}
      <CompleteProfileModal />
      <EmailCodeModal />

      {/* Confirmação de saída do app (voltar na home) */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-serif text-[#d4af37] mb-2">Sair do aplicativo?</h3>
              <p className="text-sm text-white/60 mb-6">Você está na página inicial. Deseja realmente sair?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
                >
                  Continuar no app
                </button>
                <button
                  onClick={confirmExitApp}
                  className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition"
                >
                  Sair
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aceitação de transferência de ingresso (via link de e-mail) */}
      <AnimatePresence>
        {transferToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#d4af37]/15 flex items-center justify-center">
                <Tag className="w-6 h-6 text-[#d4af37]" />
              </div>
              <h3 className="text-lg font-serif text-[#d4af37] mb-2">Transferência de ingresso</h3>
              {userRole ? (
                <>
                  <p className="text-sm text-white/60 mb-6">Você recebeu um convite de transferência de ingresso. Deseja aceitar?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAcceptTransfer(false)}
                      disabled={transferBusy}
                      className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition disabled:opacity-50"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={() => handleAcceptTransfer(true)}
                      disabled={transferBusy}
                      className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-[#d4af37] text-black rounded-xl hover:brightness-110 transition disabled:opacity-50"
                    >
                      {transferBusy ? 'Processando...' : 'Aceitar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/60 mb-6">Para aceitar o ingresso, entre com a conta do e-mail que recebeu o convite.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTransferToken(null)}
                      className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
                    >
                      Agora não
                    </button>
                    <button
                      onClick={() => setCurrentView('admin-login')}
                      className="flex-1 py-3 text-[10px] uppercase font-bold tracking-widest bg-[#d4af37] text-black rounded-xl hover:brightness-110 transition"
                    >
                      Entrar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner de falha de carregamento de dados (P3) */}
      <AnimatePresence>
        {dataLoadError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 md:bottom-6 inset-x-4 z-[110] max-w-md mx-auto bg-[#1a1a1a] border border-amber-500/40 rounded-2xl p-4 shadow-2xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-white/70 flex-1 leading-snug">
              Não foi possível carregar alguns dados. Verifique sua conexão.
            </p>
            <button
              onClick={retryDataLoad}
              className="shrink-0 px-3 py-2 bg-[#d4af37] text-black rounded-lg text-[9px] font-bold uppercase tracking-widest hover:brightness-110 transition flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3 h-3" /> Tentar novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
