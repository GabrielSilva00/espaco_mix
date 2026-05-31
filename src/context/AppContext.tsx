import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  supabase,
  signIn, signOut, signUp, getMyProfile,
  getEvents, getEventBatches, saveEvent as saveEventToDb, uploadEventImage,
  createReservation as createReservationInDb,
  getSystemConfig,
  subscribeToEvents,
  type Profile,
} from '../lib/supabase';
import { mapDbEventToApp, mapAppEventToDb } from '../shared/utils/eventMapper';
import { validateGuestData as validateGuestDataUtil } from '../shared/utils/validators';
import { type CardData, tokenizeCard } from '../lib/cardUtils';
import { mockTables, MOCK_BUYERS, EVENT_TICKET_PRICE, CART_EXPIRATION_MS } from '../shared/constants/app';
import type {
  Event, Buyer, Reservation, SessionUser, SiteConfig,
  TableDef, TableStatus, TicketItem, Sector, GuestData, PixData,
  CurrentView, CheckoutStep, PaymentMethod, Toast, ToastType,
  ConsentData, UserRole,
} from '../types';
import Lenis from 'lenis';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  // Site config
  siteConfig: SiteConfig;
  setSiteConfig: React.Dispatch<React.SetStateAction<SiteConfig>>;

  // Tables
  tables: TableDef[];
  setTables: React.Dispatch<React.SetStateAction<TableDef[]>>;

  // Cart
  selectedTables: number[];
  setSelectedTables: React.Dispatch<React.SetStateAction<number[]>>;
  singleTickets: number;
  setSingleTickets: React.Dispatch<React.SetStateAction<number>>;
  maleTickets: number;
  setMaleTickets: React.Dispatch<React.SetStateAction<number>>;
  femaleTickets: number;
  setFemaleTickets: React.Dispatch<React.SetStateAction<number>>;
  cartExpiresAt: number | null;
  setCartExpiresAt: React.Dispatch<React.SetStateAction<number | null>>;
  cartTimeLeft: number | null;
  expandedSectorId: string | null;
  setExpandedSectorId: React.Dispatch<React.SetStateAction<string | null>>;

  // Navigation
  currentView: CurrentView;
  setCurrentView: React.Dispatch<React.SetStateAction<CurrentView>>;

  // Auth
  userRole: UserRole;
  setUserRole: React.Dispatch<React.SetStateAction<UserRole>>;
  sessionUser: SessionUser | null;
  setSessionUser: React.Dispatch<React.SetStateAction<SessionUser | null>>;
  isApprovedEventCreator: boolean;
  setIsApprovedEventCreator: React.Dispatch<React.SetStateAction<boolean>>;
  isStaff: boolean;
  setIsStaff: React.Dispatch<React.SetStateAction<boolean>>;
  loggedInUserId: string | null;
  setLoggedInUserId: React.Dispatch<React.SetStateAction<string | null>>;
  authIntent: 'buy' | 'create_event';
  setAuthIntent: React.Dispatch<React.SetStateAction<'buy' | 'create_event'>>;

  // Permissions (derived)
  role: boolean;

  // Events
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  loadingEvents: boolean;
  formEvent: Event | null;
  setFormEvent: React.Dispatch<React.SetStateAction<Event | null>>;

  // Buyers / reservations
  buyers: Buyer[];
  setBuyers: React.Dispatch<React.SetStateAction<Buyer[]>>;
  reservations: Reservation[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  selectedBuyerForDetails: Buyer | null;
  setSelectedBuyerForDetails: React.Dispatch<React.SetStateAction<Buyer | null>>;

  // Checkout
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkoutStep: CheckoutStep;
  setCheckoutStep: React.Dispatch<React.SetStateAction<CheckoutStep>>;
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethod | null>>;
  paymentStatus: 'idle' | 'processing' | 'success' | 'error';
  setPaymentStatus: React.Dispatch<React.SetStateAction<'idle' | 'processing' | 'success' | 'error'>>;
  pixData: PixData | null;
  setPixData: React.Dispatch<React.SetStateAction<PixData | null>>;
  isProcessingPayment: boolean;
  guestData: GuestData;
  setGuestData: React.Dispatch<React.SetStateAction<GuestData>>;
  identificationOption: 'same_as_buyer' | 'fill_later';
  setIdentificationOption: React.Dispatch<React.SetStateAction<'same_as_buyer' | 'fill_later'>>;

  // Auth form
  adminForm: { username: string; password: string };
  setAdminForm: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;
  registerForm: { name: string; email: string; phone: string; cpf: string; birthDate: string; password: string };
  setRegisterForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string; cpf: string; birthDate: string; password: string }>>;
  registerStep: number;
  setRegisterStep: React.Dispatch<React.SetStateAction<number>>;
  verificationCode: string[];
  setVerificationCode: React.Dispatch<React.SetStateAction<string[]>>;
  verificationStep: boolean;
  setVerificationStep: React.Dispatch<React.SetStateAction<boolean>>;
  authTab: 'login' | 'register';
  setAuthTab: React.Dispatch<React.SetStateAction<'login' | 'register'>>;
  totpPending: boolean;
  setTotpPending: React.Dispatch<React.SetStateAction<boolean>>;
  totpInput: string;
  setTotpInput: React.Dispatch<React.SetStateAction<string>>;
  users: any[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  adminError: string;
  setAdminError: React.Dispatch<React.SetStateAction<string>>;
  forgotPasswordStep: 'none' | 'email' | 'code' | 'new_password';
  setForgotPasswordStep: React.Dispatch<React.SetStateAction<'none' | 'email' | 'code' | 'new_password'>>;
  forgotPasswordData: { email: string; code: string; newPassword: string };
  setForgotPasswordData: React.Dispatch<React.SetStateAction<{ email: string; code: string; newPassword: string }>>;

  // Consentimento / LGPD
  consentData: ConsentData | null;
  saveConsent: (data: ConsentData) => void;

  // UI state
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUserDropdownOpen: boolean;
  setIsUserDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userDropdownRef: React.RefObject<HTMLDivElement | null>;
  actionTicket: any;
  setActionTicket: React.Dispatch<React.SetStateAction<any>>;
  actionError: string;
  setActionError: React.Dispatch<React.SetStateAction<string>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sessionRestored: boolean;
  setSessionRestored: React.Dispatch<React.SetStateAction<boolean>>;
  sessionConflict: string[];
  setSessionConflict: React.Dispatch<React.SetStateAction<string[]>>;

  // Check-in
  checkInResult: { type: 'success' | 'error' | 'warning'; message: string; data?: Buyer } | null;
  checkInHistory: { id: string; name: string; type: string; time: Date }[];
  scannerKey: number;
  setScannerKey: React.Dispatch<React.SetStateAction<number>>;
  scannerConstraints: MediaTrackConstraints;
  setScannerConstraints: React.Dispatch<React.SetStateAction<MediaTrackConstraints>>;
  scannerError: string | null;
  setScannerError: React.Dispatch<React.SetStateAction<string | null>>;
  resetScanner: () => void;

  // Reservations UI
  expandedRes: string | null;
  setExpandedRes: React.Dispatch<React.SetStateAction<string | null>>;
  reservationsTab: 'upcoming' | 'past';
  setReservationsTab: React.Dispatch<React.SetStateAction<'upcoming' | 'past'>>;
  copiedCod: string | null;
  setCopiedCod: React.Dispatch<React.SetStateAction<string | null>>;
  qrFullscreen: { id: string; name: string } | null;
  setQrFullscreen: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>;

  // Toast
  actionToast: Toast | null;
  showToast: (message: string, type?: ToastType) => void;

  // Computed
  activeEvent: Event | undefined;
  derivedTables: TableDef[];
  grandTotal: number;
  subTotal: number;
  taxAmount: number;
  tablesTotal: number;
  ticketsTotal: number;
  totalTicketsSelected: number;
  previewSectors: Sector[];
  expandedSector: Partial<Sector>;
  bookingType: 'selection' | 'mesa' | 'ingresso';
  setBookingType: React.Dispatch<React.SetStateAction<'selection' | 'mesa' | 'ingresso'>>;

  // Handlers
  showToastFn: (message: string, type?: ToastType) => void;
  handleAdminLogin: (e: React.FormEvent) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleRegister: (e: React.FormEvent) => void;
  handleVerifyCode: () => Promise<void>;
  handleCheckIn: (input: string) => Promise<void>;
  handleUndoCheckIn: (id: string) => void;
  handleScannerError: (err: unknown) => void;
  toggleTableSelection: (tableId: number, status: 'available' | 'reserved') => void;
  getTableStatus: (tableId: number, baseStatus: 'available' | 'reserved') => TableStatus;
  handleCheckout: () => void;
  handleConfirmReservation: (cardData?: CardData, selectedPaymentMethod?: PaymentMethod | null) => Promise<void>;
  handleCreateReservation: (
    reservationData: Parameters<typeof createReservationInDb>[0],
    ticketItems: Parameters<typeof createReservationInDb>[1]
  ) => Promise<any>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Site config
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({ venueMaxCapacity: null, platformName: 'Espaço Mix', platformLogo: null });

  // Tables / cart
  const [tables, setTables] = useState<TableDef[]>(mockTables);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [singleTickets, setSingleTickets] = useState(0);
  const [maleTickets, setMaleTickets] = useState(0);
  const [femaleTickets, setFemaleTickets] = useState(0);
  const [cartExpiresAt, setCartExpiresAt] = useState<number | null>(null);
  const [cartTimeLeft, setCartTimeLeft] = useState<number | null>(null);
  const [expandedSectorId, setExpandedSectorId] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<'selection' | 'mesa' | 'ingresso'>('selection');

  // Navigation
  const [currentView, setCurrentView] = useState<CurrentView>('home');

  // Auth
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isApprovedEventCreator, setIsApprovedEventCreator] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<'buy' | 'create_event'>('buy');

  // Permissions (derived: true when user is logged in)
  const role = !!userRole;

  // Events
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [formEvent, setFormEvent] = useState<Event | null>(null);

  // Buyers / reservations
  const [buyers, setBuyers] = useState<Buyer[]>(MOCK_BUYERS);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);

  // Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('selection');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [guestData, setGuestData] = useState<GuestData>({ name: '', email: '', cpf: '' });
  const [identificationOption, setIdentificationOption] = useState<'same_as_buyer' | 'fill_later'>('same_as_buyer');

  // Auth form
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
  const [registerStep, setRegisterStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '']);
  const [verificationStep, setVerificationStep] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [totpPending, setTotpPending] = useState(false);
  const [totpInput, setTotpInput] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [adminError, setAdminError] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'code' | 'new_password'>('none');
  const [forgotPasswordData, setForgotPasswordData] = useState({ email: '', code: '', newPassword: '' });

  // Consentimento / LGPD
  const [consentData, setConsentData] = useState<ConsentData | null>(() => {
    try {
      const stored = localStorage.getItem('lgpd-consent-v2');
      if (stored) return JSON.parse(stored) as ConsentData;
      // Migração do consentimento anterior (simples boolean)
      if (localStorage.getItem('lgpd-consent') === 'true') {
        const migrated: ConsentData = {
          essential: true,
          functional: false,
          analytics: false,
          marketing: false,
          grantedAt: new Date().toISOString(),
          version: 'migrated-v1',
        };
        localStorage.setItem('lgpd-consent-v2', JSON.stringify(migrated));
        return migrated;
      }
      return null;
    } catch {
      return null;
    }
  });

  // UI state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);
  const [actionTicket, setActionTicket] = useState<any>(null);
  const [actionError, setActionError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionRestored, setSessionRestored] = useState(false);
  const [sessionConflict, setSessionConflict] = useState<string[]>([]);

  // Check-in (mantido para compatibilidade com CheckoutModal)
  const [checkInResult, setCheckInResult] = useState<{ type: 'success' | 'error' | 'warning'; message: string; data?: Buyer } | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<{ id: string; name: string; type: string; time: Date }[]>([]);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannerConstraints, setScannerConstraints] = useState<MediaTrackConstraints>({});
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRetryRef = useRef(0);

  // Reservations UI
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [reservationsTab, setReservationsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedCod, setCopiedCod] = useState<string | null>(null);
  const [qrFullscreen, setQrFullscreen] = useState<{ id: string; name: string } | null>(null);

  // Toast
  const [actionToast, setActionToast] = useState<Toast | null>(null);

  const lenisRef = useRef<Lenis | null>(null);

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalTicketsSelected = singleTickets + maleTickets + femaleTickets;

  const activeEvent = formEvent
    || events.find(e => e.status === 'Vendas liberadas')
    || events.find(e => e.status === 'Ativo')
    || events.find(e => e.status === 'Em breve')
    || events[0];

  const activeBatch = activeEvent?.batches?.find(b => b.is_active !== false) ?? activeEvent?.batches?.[0];
  const previewSectors = activeBatch?.sectors || [];

  const layoutTableElements = (activeEvent?.tableLayout || []).filter(
    el => el.type === 'round-table' || el.type === 'rect-table' || el.type === 'bistro-table'
  );

  const derivedTables: TableDef[] = layoutTableElements.length > 0
    ? layoutTableElements.map((el, i) => {
        const existing = tables.find(t => t.id === i + 1);
        const defaultPrice = el.type === 'bistro-table'
          ? (activeEvent?.tableConfig?.bistroPrice ?? 200)
          : (activeEvent?.tableConfig?.tablePrice ?? 300);
        return {
          id: i + 1,
          capacity: el.capacity ?? activeEvent?.tableConfig?.seatsPerTable ?? 4,
          status: existing?.status || 'available',
          price: el.price ?? existing?.price ?? defaultPrice,
        };
      })
    : [
        ...Array.from({ length: activeEvent?.tableConfig?.totalTables || 20 }).map((_, i) => {
          const existing = tables.find(t => t.id === i + 1);
          return {
            id: i + 1,
            capacity: activeEvent?.tableConfig?.seatsPerTable ?? existing?.capacity ?? 4,
            status: (existing?.status || 'available') as 'available' | 'reserved',
            price: existing?.price ?? activeEvent?.tableConfig?.tablePrice ?? 300,
          };
        }),
        ...Array.from({ length: activeEvent?.tableConfig?.totalBistros || 0 }).map((_, i) => {
          const id = (activeEvent?.tableConfig?.totalTables || 20) + i + 1;
          const existing = tables.find(t => t.id === id);
          return {
            id,
            capacity: 2,
            status: (existing?.status || 'available') as 'available' | 'reserved',
            price: existing?.price ?? activeEvent?.tableConfig?.bistroPrice ?? 200,
          };
        }),
      ];

  const selectedTablesData = derivedTables.filter(t => selectedTables.includes(t.id));
  const tablesTotal = selectedTablesData.reduce((acc, curr) => acc + curr.price, 0);
  const expandedSector: Partial<Sector> = previewSectors.find(s => s.id === expandedSectorId) || previewSectors[0] || {};
  const ticketsTotal = activeEvent?.priceType === 'gender'
    ? (maleTickets * (expandedSector.priceMale || 0) + femaleTickets * (expandedSector.priceFemale || 0))
    : (singleTickets * (expandedSector.price || EVENT_TICKET_PRICE));

  const subTotal = tablesTotal + ticketsTotal;
  const taxAmount = subTotal * 0.10;
  const grandTotal = subTotal + taxAmount;

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Gerencia sessão do Supabase: admin/developer jamais são auto-logados ao abrir a página
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          try {
            const profile = await getMyProfile();
            if (profile) {
              const r = profile.role as UserRole;
              setUserRole(r);
              setLoggedInUserId(profile.id);
              setIsApprovedEventCreator(profile.is_approved_event_creator);
              setSessionUser({
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: r,
                isApprovedEventCreator: profile.is_approved_event_creator,
                avatarUrl: profile.avatar_url,
              });
            }
          } catch (err) {
            const errMsg = String(err).toLowerCase();
            if (errMsg.includes('infinite recursion') || errMsg.includes('policies')) {
              console.error('[Context] Erro ao verificar sessão: problema com configuração do banco de dados');
            } else {
              console.error('Erro ao verificar sessão inicial:', err);
            }
          }
        }
      } else if (event === 'SIGNED_IN') {
        // Login explícito pelo formulário — atualiza estado normalmente
        if (session?.user) {
          try {
            const profile = await getMyProfile();
            if (profile) {
              const r = profile.role as UserRole;
              setUserRole(r);
              setLoggedInUserId(profile.id);
              setIsApprovedEventCreator(profile.is_approved_event_creator);
              setSessionUser({
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: r,
                isApprovedEventCreator: profile.is_approved_event_creator,
                avatarUrl: profile.avatar_url,
              });
              // Rebusca eventos com o contexto de auth do usuário logado
              getEvents()
                .then(data => setEvents(data.map(mapDbEventToApp)))
                .catch(e => console.error('[Context] Erro ao buscar eventos:', (e as Error)?.message))
                .finally(() => setLoadingEvents(false));
            }
          } catch (err) {
            const errMsg = String(err).toLowerCase();
            if (errMsg.includes('infinite recursion') || errMsg.includes('policies')) {
              console.error('[Context] Erro ao carregar perfil: problema com configuração do banco de dados');
            } else {
              console.error('[Context] Erro ao carregar perfil após login:', err);
            }
            try {
              await signOut();
            } catch {}
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUserRole(null);
        setLoggedInUserId(null);
        setIsApprovedEventCreator(false);
        setSessionUser(null);
        setIsStaff(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (totalTicketsSelected > 0 || selectedTables.length > 0) {
      if (!cartExpiresAt) setCartExpiresAt(Date.now() + CART_EXPIRATION_MS);
    } else {
      setCartExpiresAt(null);
      setCartTimeLeft(null);
    }
  }, [totalTicketsSelected, selectedTables.length]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (cartExpiresAt) {
      interval = setInterval(() => {
        const remaining = Math.max(0, cartExpiresAt - Date.now());
        setCartTimeLeft(remaining);
        if (remaining <= 0) {
          setSingleTickets(0);
          setMaleTickets(0);
          setFemaleTickets(0);
          setSelectedTables([]);
          setCartExpiresAt(null);
          setIsCheckoutOpen(false);
          showToast('O tempo para concluir a compra expirou e os ingressos foram liberados.', 'warning');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cartExpiresAt]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        infinite: false,
      });
      lenisRef.current = lenis;
      function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      return () => { lenis.destroy(); lenisRef.current = null; };
    }
  }, []);

  useEffect(() => {
    if (isCheckoutOpen) {
      lenisRef.current?.stop();
    } else {
      lenisRef.current?.start();
    }
  }, [isCheckoutOpen]);

  useEffect(() => {
    if (currentView === 'admin-login') {
      setAuthTab('login');
    } else {
      setAdminForm({ username: '', password: '' });
      setRegisterForm({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
      setRegisterStep(1);
      setVerificationStep(false);
      setVerificationCode(['', '', '', '']);
      setAdminError('');
      setForgotPasswordStep('none');
      setForgotPasswordData({ email: '', code: '', newPassword: '' });
      setTotpPending(false);
      setTotpInput('');
    }
  }, [currentView]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let firstLoad = true;
    const unsubscribe = subscribeToEvents(data => {
      setEvents(data.map(mapDbEventToApp).map(e =>
        e.date < today && e.status !== 'Finalizado' ? { ...e, status: 'Finalizado' as const } : e
      ));
      if (firstLoad) { firstLoad = false; setLoadingEvents(false); }
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    getSystemConfig()
      .then(cfg => setSiteConfig(prev => ({ ...prev, venueMaxCapacity: cfg.venue_max_capacity ?? null, platformName: cfg.site_name ?? prev.platformName })))
      .catch(e => console.error('[Context] Erro ao carregar config:', (e as Error)?.message));
  }, []);

  // Session persistence
  useEffect(() => {
    const handleError = (e: any) => {
      const errStr = String(e.reason?.message || e.reason || e.message || '');
      if (errStr.includes('WebSocket') || errStr.includes('websocket')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    const savedSession = localStorage.getItem('eventix-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        let restoredAnything = false;
        const conflictList: string[] = [];
        if (session.singleTickets) { setSingleTickets(session.singleTickets); restoredAnything = true; }
        if (session.guestData) { setGuestData(session.guestData); restoredAnything = true; }
        // Checkout nunca é reaberto automaticamente — apenas o carrinho é restaurado
        if (Array.isArray(session.selectedTables) && session.selectedTables.length > 0) {
          const availableRestored = session.selectedTables.filter((id: number) => {
            const table = tables.find(t => t.id === id);
            const isAvail = table && table.status === 'available';
            if (!isAvail) conflictList.push(`Mesa #${id}`);
            return isAvail;
          });
          if (availableRestored.length > 0) { setSelectedTables(availableRestored); restoredAnything = true; }
          if (conflictList.length > 0) setSessionConflict(conflictList);
        }
        if (restoredAnything) { setSessionRestored(true); setTimeout(() => setSessionRestored(false), 5000); }
      } catch (e) { console.error('Erro ao restaurar sessão:', e); }
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  useEffect(() => {
    // CPF não é persistido no localStorage — dados sensíveis ficam apenas em memória
    const { cpf: _cpf, ...guestDataSafe } = guestData;
    const session = { selectedTables, singleTickets, guestData: guestDataSafe };
    localStorage.setItem('eventix-session', JSON.stringify(session));
  }, [selectedTables, singleTickets, guestData]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const showToast = (message: string, type: ToastType = 'info') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 3500);
  };

  const saveConsent = (data: ConsentData) => {
    localStorage.setItem('lgpd-consent-v2', JSON.stringify(data));
    setConsentData(data);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    const email = adminForm.username.includes('@')
      ? adminForm.username
      : `${adminForm.username}@espacomix.internal`;
    try {
      await signIn(email, adminForm.password);
      const profile: Profile | null = await getMyProfile();
      if (!profile) throw new Error('Perfil não encontrado');
      const r = profile.role as UserRole;
      setUserRole(r);
      setLoggedInUserId(profile.id);
      setIsApprovedEventCreator(profile.is_approved_event_creator);
      setSessionUser({ id: profile.id, email: profile.email, name: profile.name, role: r, isApprovedEventCreator: profile.is_approved_event_creator, avatarUrl: profile.avatar_url });
      setCurrentView('home');
    } catch (err: any) {
      setAdminError(err.message ?? 'Usuário ou senha incorretos');
    }
  };

  const handleLogout = async () => {
    await signOut().catch(e => console.error('[Auth] Erro no logout:', (e as Error)?.message));
    window.location.href = '/';
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep === 1) {
      if (!registerForm.name || !registerForm.email || !registerForm.password) { setAdminError('Preencha nome, e-mail e senha para continuar'); return; }
      setAdminError('');
      setRegisterStep(2);
    } else {
      if (!registerForm.phone || !registerForm.cpf || !registerForm.birthDate) { setAdminError('Preencha celular, CPF e data de nascimento'); return; }
      setAdminError('');
      setVerificationStep(true);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.join('').length < 4) { setAdminError('Preencha o código completo (4 dígitos)'); return; }
    setAdminError('');
    try {
      await signUp(registerForm.email, registerForm.password, registerForm.name, { phone: registerForm.phone, cpf: registerForm.cpf, birth_date: registerForm.birthDate } as any);
      setVerificationStep(false);
      setRegisterForm({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
      setVerificationCode(['', '', '', '']);
      setAdminForm({ username: '', password: '' });
      setRegisterStep(1);
      showToast('Cadastro concluído! Faça login para continuar.', 'success');
      setAuthTab('login');
    } catch (err: any) {
      setAdminError(err.message ?? 'Erro ao criar conta');
    }
  };

  const handleCheckIn = async (input: string) => {
    if (!input) return;
    const buyer = buyers.find(b => b.id === input || b.cpf === input);
    if (!buyer) {
      setCheckInResult({ type: 'error', message: 'TICKET INVÁLIDO OU NÃO ENCONTRADO' });
      setTimeout(() => setCheckInResult(null), 3000);
      if ('vibrate' in navigator) navigator.vibrate([100, 100, 100]);
      return;
    }
    if (buyer.status !== 'Pago') {
      setCheckInResult({ type: 'warning', message: 'PAGAMENTO PENDENTE - NÃO AUTORIZADO', data: buyer });
      setTimeout(() => setCheckInResult(null), 3000);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      return;
    }
    if (buyer.checkedIn) {
      setCheckInResult({ type: 'error', message: 'DUPLICATA - CHECK-IN JÁ FOI REALIZADO TKT#' + buyer.id.substring(0, 6), data: buyer });
      setTimeout(() => setCheckInResult(null), 3000);
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
      return;
    }
    setCheckInResult({ type: 'success', message: '✔ PODE ENTRAR!', data: buyer });
    setBuyers(prev => prev.map(b => b.id === buyer.id ? { ...b, checkedIn: true } : b));
    setCheckInHistory(prev => [{ id: buyer.id, name: buyer.name, type: buyer.type, time: new Date() }, ...prev]);
    if ('vibrate' in navigator) navigator.vibrate(200);
    setTimeout(() => setCheckInResult(null), 2500);
  };

  const handleUndoCheckIn = (id: string) => {
    setBuyers(prev => prev.map(b => b.id === id ? { ...b, checkedIn: false } : b));
    setCheckInHistory(prev => prev.filter(h => h.id !== id));
    showToast('Check-in desfeito com sucesso.', 'info');
  };

  const handleScannerError = (err: unknown) => {
    const error = err as Error;
    console.warn('[Scanner]', error?.name, error?.message);
    if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
      scannerRetryRef.current += 1;
      if (scannerRetryRef.current === 1) {
        setScannerConstraints({ facingMode: { ideal: 'user' } });
        setScannerKey(k => k + 1);
      } else if (scannerRetryRef.current === 2) {
        setScannerConstraints({});
        setScannerKey(k => k + 1);
      } else {
        setScannerError('Câmera não disponível. Use a busca manual abaixo.');
      }
    } else if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      setScannerError('Permissão de câmera negada. Permita o acesso à câmera ou use a busca manual.');
    } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      setScannerError('Câmera não encontrada neste dispositivo.');
    } else {
      setScannerError('Erro ao acessar a câmera. Use a busca manual abaixo.');
    }
  };

  const resetScanner = () => {
    scannerRetryRef.current = 0;
    setScannerError(null);
    setScannerConstraints({});
    setScannerKey(k => k + 1);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setReservations(prev => prev.map(res => ({
        ...res,
        ticketsObj: res.ticketsObj?.map(t => {
          if (t.status === 'pending_transfer' && t.transferExpiresAt && Date.now() > t.transferExpiresAt) {
            return { ...t, status: 'active' as const, pendingTransferEmail: undefined, transferExpiresAt: undefined };
          }
          return t;
        }),
      })));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleTableSelection = (tableId: number, status: 'available' | 'reserved') => {
    if (status === 'reserved') return;
    setSelectedTables(prev => prev.includes(tableId) ? prev.filter(id => id !== tableId) : [...prev, tableId]);
  };

  const getTableStatus = (tableId: number, baseStatus: 'available' | 'reserved'): TableStatus => {
    if (baseStatus === 'reserved') return 'reserved';
    if (selectedTables.includes(tableId)) return 'selected';
    return 'available';
  };

  const handleCheckout = () => {
    if (grandTotal === 0) return;
    setIsCheckoutOpen(true);
    setCheckoutStep('selection');
  };

  const handleConfirmReservation = async (cardData?: CardData, selectedPaymentMethod?: PaymentMethod | null) => {
    if (isProcessingPayment) return;
    if (!role) {
      const errs = validateGuestDataUtil(guestData);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    }
    setIsProcessingPayment(true);
    setPaymentStatus('processing');
    setPixData(null);

    const finalizeSuccess = () => {
      const generatedTickets: TicketItem[] = [];
      const getOwnerData = (isFirst: boolean) => {
        if (identificationOption === 'same_as_buyer') return { ownerName: guestData.name, ownerCpf: guestData.cpf, ownerEmail: guestData.email };
        if (isFirst) return { ownerName: guestData.name, ownerCpf: guestData.cpf, ownerEmail: guestData.email };
        return { ownerName: '', ownerCpf: '', ownerEmail: '' };
      };
      let tIndex = 0;
      selectedTables.forEach((tableId) => {
        const tbl = derivedTables.find(t => t.id === tableId);
        const seats = tbl?.capacity ?? 4;
        for (let i = 0; i < seats; i++) {
          generatedTickets.push({
            id: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            name: `Mesa #${tableId} — Assento ${i + 1}`,
            isTable: true,
            tableNumber: tableId,
            occupantIndex: i,
            status: 'active',
            ...getOwnerData(tIndex === 0),
          });
          tIndex++;
        }
      });
      const ticketCount = singleTickets + maleTickets + femaleTickets;
      for (let i = 0; i < ticketCount; i++) {
        generatedTickets.push({
          id: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          name: `Ingresso Individual`,
          isTable: false,
          status: 'active',
          ...getOwnerData(tIndex === 0),
        });
        tIndex++;
      }
      const newRes: Reservation = {
        id: `RES-${Date.now()}`,
        date: new Date().toISOString(),
        tables: [...selectedTables],
        singleTickets,
        ticketsObj: generatedTickets,
        total: grandTotal,
        eventId: activeEvent?.id ?? 1,
        buyerName: guestData.name,
        paymentStatus: 'approved',
        paymentMethod: selectedPaymentMethod || 'credit_card',
        platformFee: taxAmount,
        netAmount: subTotal,
        createdAt: new Date().toISOString(),
      };
      setReservations([newRes, ...reservations]);
      setPaymentStatus('success');
      setIsProcessingPayment(false);
      setCartExpiresAt(null);
      setSelectedTables([]);
      setSingleTickets(0);
      setMaleTickets(0);
      setFemaleTickets(0);
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (selectedPaymentMethod === 'pix') {
        const res = await fetch('/api/payment/pix', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ amount: grandTotal, description: activeEvent?.title || 'Ingresso', guestData }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX');
        setPixData({ qrCode: data.qrCodeUrl, copyPaste: data.qrCode });
        setCheckoutStep('processing');
        // Mostra QR code; pagamento confirmado via webhook. isProcessingPayment liberado para interação.
        setIsProcessingPayment(false);
      } else {
        if (!cardData) throw new Error('Dados do cartão não informados');
        const cardToken = await tokenizeCard(cardData);
        if (!cardToken) throw new Error('Falha ao tokenizar cartão. Verifique os dados e tente novamente.');
        const res = await fetch('/api/payment/mercadopago', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            cardToken,
            amount: grandTotal,
            description: activeEvent?.title || 'Ingresso',
            paymentMethod: selectedPaymentMethod,
            installments: cardData.installments,
            guestData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento');
        finalizeSuccess();
      }
    } catch (err: any) {
      console.error('[Payment] Erro na transação:', err?.message ?? 'Erro desconhecido');
      setErrors({ payment: err.message || 'Falha na transação de segurança.' });
      setPaymentStatus('idle');
      setIsProcessingPayment(false);
    }
  };

  const handleCreateReservation = async (
    reservationData: Parameters<typeof createReservationInDb>[0],
    ticketItems: Parameters<typeof createReservationInDb>[1]
  ) => {
    const reservation = await createReservationInDb(reservationData, ticketItems);
    setReservations(prev => [reservation as any, ...prev]);
    return reservation;
  };

  // ─── Context value ────────────────────────────────────────────────────────

  const value: AppContextValue = {
    siteConfig, setSiteConfig,
    tables, setTables,
    selectedTables, setSelectedTables,
    singleTickets, setSingleTickets,
    maleTickets, setMaleTickets,
    femaleTickets, setFemaleTickets,
    cartExpiresAt, setCartExpiresAt,
    cartTimeLeft,
    expandedSectorId, setExpandedSectorId,
    bookingType, setBookingType,
    currentView, setCurrentView,
    userRole, setUserRole,
    sessionUser, setSessionUser,
    isApprovedEventCreator, setIsApprovedEventCreator,
    isStaff, setIsStaff,
    loggedInUserId, setLoggedInUserId,
    authIntent, setAuthIntent,
    role,
    events, setEvents,
    loadingEvents,
    formEvent, setFormEvent,
    buyers, setBuyers,
    reservations, setReservations,
    selectedBuyerForDetails, setSelectedBuyerForDetails,
    isCheckoutOpen, setIsCheckoutOpen,
    checkoutStep, setCheckoutStep,
    paymentMethod, setPaymentMethod,
    paymentStatus, setPaymentStatus,
    pixData, setPixData,
    isProcessingPayment,
    guestData, setGuestData,
    identificationOption, setIdentificationOption,
    adminForm, setAdminForm,
    registerForm, setRegisterForm,
    registerStep, setRegisterStep,
    verificationCode, setVerificationCode,
    verificationStep, setVerificationStep,
    authTab, setAuthTab,
    totpPending, setTotpPending,
    totpInput, setTotpInput,
    users, setUsers,
    adminError, setAdminError,
    forgotPasswordStep, setForgotPasswordStep,
    forgotPasswordData, setForgotPasswordData,
    consentData, saveConsent,
    isMobileMenuOpen, setIsMobileMenuOpen,
    isUserDropdownOpen, setIsUserDropdownOpen,
    userDropdownRef,
    actionTicket, setActionTicket,
    actionError, setActionError,
    errors, setErrors,
    sessionRestored, setSessionRestored, sessionConflict, setSessionConflict,
    checkInResult,
    checkInHistory,
    scannerKey, setScannerKey,
    scannerConstraints, setScannerConstraints,
    scannerError, setScannerError,
    resetScanner,
    expandedRes, setExpandedRes,
    reservationsTab, setReservationsTab,
    copiedCod, setCopiedCod,
    qrFullscreen, setQrFullscreen,
    actionToast, showToast,
    activeEvent,
    derivedTables,
    grandTotal, subTotal, taxAmount, tablesTotal, ticketsTotal,
    totalTicketsSelected,
    previewSectors, expandedSector,
    showToastFn: showToast,
    handleAdminLogin, handleLogout, handleRegister, handleVerifyCode,
    handleCheckIn, handleUndoCheckIn, handleScannerError,
    toggleTableSelection, getTableStatus, handleCheckout, handleConfirmReservation, handleCreateReservation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
