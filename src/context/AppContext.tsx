import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
  signIn, signOut, signUp, getMyProfile, resolveUsernameToEmail, updateProfile, getAccessTokenSafe,
  getEvents, getEventBatches, saveEvent as saveEventToDb, createEvent, deleteEvent, uploadEventImage,
  createReservation as createReservationInDb, getMyReservations, getEventReservations, getAllReservations,
  getSystemConfig, getSystemConfigAdmin, updateSystemConfig,
  getRegisteredUsersCount, getAllProfiles,
  getPendingApplications, approveProducer, rejectProducer,
  subscribeToEvents, subscribeToEventReservations, subscribeToPendingApplications,
  subscribeToProfile,
  type Profile,
} from '../lib/supabase';
import { UserRole, usePermissions } from '../hooks/usePermissions';
import { mapDbEventToApp, mapAppEventToDb } from '../shared/utils/eventMapper';
import { validateGuestData as validateGuestDataUtil } from '../shared/utils/validators';
import { type CardData, tokenizeCard, detectCardBrand } from '../lib/cardUtils';
import { EVENT_TICKET_PRICE, CART_EXPIRATION_MS } from '../shared/constants/app';
import type {
  Event, Buyer, Reservation, StaffAccount, SessionUser, SiteConfig,
  TableDef, TableStatus, TicketItem, Sector, GuestData, PixData,
  CurrentView, DashboardMode, CheckoutStep, PaymentMethod, Toast, ToastType,
  ConsentData,
} from '../types';
import { loadDeveloperConfig, saveDeveloperConfig } from '../services/developerConfig';
import type { DeveloperConfig } from '../types/developer';
import Lenis from 'lenis';

// 'in_review': cartão aceito pelo MP mas ainda em análise — os ingressos só
// são liberados quando o webhook/polling confirmar a aprovação.
type PaymentFlowStatus = 'idle' | 'processing' | 'in_review' | 'success' | 'error';

// Converte uma reserva do banco (snake_case + ticket_items) no shape do app
// (camelCase) que as views consomem (dashboard, "Minhas Reservas").
function mapDbReservationToApp(r: any): Reservation {
  const items: any[] = Array.isArray(r.ticket_items) ? r.ticket_items : [];
  return {
    id: r.id,
    date: r.created_at,
    tables: Array.isArray(r.tables) ? r.tables : [],
    singleTickets: r.single_tickets ?? 0,
    ticketsObj: items.map((t) => ({
      id: t.id,
      name: t.name,
      isTable: !!t.is_table,
      tableNumber: t.table_number ?? undefined,
      occupantIndex: t.occupant_index ?? undefined,
      ownerName: t.owner_name ?? '',
      ownerCpf: t.owner_cpf ?? '',
      ownerEmail: t.owner_email ?? '',
      status: (t.status ?? 'active') as TicketItem['status'],
      pendingTransferEmail: t.pending_transfer_email ?? undefined,
      originalBuyerId: t.original_buyer_id ?? undefined,
      checkedIn: !!t.checked_in_at,
    })),
    total: Number(r.total) || 0,
    checkedIn: items.length > 0 && items.some((t) => !!t.checked_in_at),
    eventId: r.event_id,
    buyerName: r.buyer_name,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    platformFee: r.platform_fee,
    netAmount: r.net_amount,
    createdAt: r.created_at,
  };
}

// Converte uma reserva do banco (com ticket_items) em um "Buyer" para os painéis
// do dashboard (vendas/clientes/check-in) — tudo a partir de dados reais.
function mapReservationToBuyer(r: any): Buyer {
  const items: any[] = Array.isArray(r.ticket_items) ? r.ticket_items : [];
  const statusMap: Record<string, Buyer['status']> = {
    approved: 'Pago', pending: 'Pendente', in_process: 'Pendente',
    cancelled: 'Cancelado', refunded: 'Cancelado',
  };
  const hasTables = Array.isArray(r.tables) && r.tables.length > 0;
  return {
    id: r.id,
    name: r.buyer_name || '—',
    email: r.buyer_email || '',
    cpf: r.buyer_cpf || '',
    type: hasTables ? 'Mesa' : 'Ingresso',
    value: Number(r.total) || 0,
    status: statusMap[r.payment_status] ?? 'Pendente',
    checkedIn: items.length > 0 && items.some((t) => !!t.checked_in_at),
    purchaseDate: r.created_at,
    eventId: r.event_id,
    ticketCount: items.length,
  };
}

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
  dashboardMode: DashboardMode;
  setDashboardMode: React.Dispatch<React.SetStateAction<DashboardMode>>;
  isPreviewingEvent: boolean;
  setIsPreviewingEvent: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDashboardEvent: number | null;
  setSelectedDashboardEvent: React.Dispatch<React.SetStateAction<number | null>>;

  // Auth
  userRole: UserRole;
  setUserRole: React.Dispatch<React.SetStateAction<UserRole>>;
  sessionUser: SessionUser | null;
  setSessionUser: React.Dispatch<React.SetStateAction<SessionUser | null>>;
  isApprovedEventCreator: boolean;
  setIsApprovedEventCreator: React.Dispatch<React.SetStateAction<boolean>>;
  isStaff: boolean;
  setIsStaff: React.Dispatch<React.SetStateAction<boolean>>;
  staffEventIds: string[];
  setStaffEventIds: React.Dispatch<React.SetStateAction<string[]>>;
  loggedInUserId: string | null;
  setLoggedInUserId: React.Dispatch<React.SetStateAction<string | null>>;
  authIntent: 'buy' | 'create_event';
  setAuthIntent: React.Dispatch<React.SetStateAction<'buy' | 'create_event'>>;

  // Permissions (derived)
  can: ReturnType<typeof usePermissions>['can'];
  role: ReturnType<typeof usePermissions>['role'];
  isAtLeast: ReturnType<typeof usePermissions>['isAtLeast'];

  // Events
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  loadingEvents: boolean;
  loadingBatches: boolean;
  formEvent: Event | null;
  setFormEvent: React.Dispatch<React.SetStateAction<Event | null>>;
  releaseValidationFields: string[];
  setReleaseValidationFields: React.Dispatch<React.SetStateAction<string[]>>;

  // Staff
  staffAccounts: StaffAccount[];
  setStaffAccounts: React.Dispatch<React.SetStateAction<StaffAccount[]>>;
  registeredUsersCount: number;
  newStaff: { name: string; username: string; password: string };
  setNewStaff: React.Dispatch<React.SetStateAction<{ name: string; username: string; password: string }>>;

  // System logs
  systemLogs: { id: string; level: 'error' | 'warn' | 'info'; message: string; time: Date }[];
  clearSystemLogs: () => void;

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
  paymentStatus: PaymentFlowStatus;
  setPaymentStatus: React.Dispatch<React.SetStateAction<PaymentFlowStatus>>;
  /** Verificação manual do pagamento pendente (botão "Já realizei o pagamento"). */
  verifyPaymentNow: () => Promise<boolean>;
  /** Falha ao carregar dados essenciais do banco (config/reservas) — exibe banner com retry. */
  dataLoadError: boolean;
  retryDataLoad: () => void;
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
  registerForm: { name: string; email: string; cpf: string; phone: string; phoneCountry: string; birthDate: string; sex: string; password: string; confirmPassword: string; nationality: string; country: string; passportDoc: string };
  setRegisterForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; cpf: string; phone: string; phoneCountry: string; birthDate: string; sex: string; password: string; confirmPassword: string; nationality: string; country: string; passportDoc: string }>>;
  registerStep: number;
  setRegisterStep: React.Dispatch<React.SetStateAction<number>>;
  verificationCode: string[];
  setVerificationCode: React.Dispatch<React.SetStateAction<string[]>>;
  verifyTicket: { ticket: string; exp: number } | null;
  verificationStep: boolean;
  setVerificationStep: React.Dispatch<React.SetStateAction<boolean>>;
  authTab: 'login' | 'register' | 'staff';
  setAuthTab: React.Dispatch<React.SetStateAction<'login' | 'register' | 'staff'>>;
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
  isAdminSidebarCollapsed: boolean;
  setIsAdminSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isUserDropdownOpen: boolean;
  setIsUserDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userDropdownRef: React.RefObject<HTMLDivElement | null>;
  isStaffModalOpen: boolean;
  setIsStaffModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isTableLayoutEditorOpen: boolean;
  setIsTableLayoutEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMessageModalOpen: boolean;
  setIsMessageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLogsModalOpen: boolean;
  setIsLogsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingApprovalsCount: number;
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  showDefaultCredentialsWarning: boolean;
  setShowDefaultCredentialsWarning: React.Dispatch<React.SetStateAction<boolean>>;
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
  checkInInput: string;
  setCheckInInput: React.Dispatch<React.SetStateAction<string>>;
  checkInSearch: string;
  setCheckInSearch: React.Dispatch<React.SetStateAction<string>>;
  checkInSearchInput: string;
  setCheckInSearchInput: React.Dispatch<React.SetStateAction<string>>;
  checkInFilter: 'all' | 'pendentes' | 'check-ins';
  setCheckInFilter: React.Dispatch<React.SetStateAction<'all' | 'pendentes' | 'check-ins'>>;
  checkInResult: { type: 'success' | 'error' | 'warning'; message: string; data?: { name?: string; type?: string } } | null;
  checkinTab: 'scanner' | 'list';
  setCheckinTab: React.Dispatch<React.SetStateAction<'scanner' | 'list'>>;
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

  // Dashboard UI
  salesChartPeriod: '7d' | '30d';
  setSalesChartPeriod: React.Dispatch<React.SetStateAction<'7d' | '30d'>>;
  consoleDisplayCount: number;
  setConsoleDisplayCount: React.Dispatch<React.SetStateAction<number>>;
  consoleSearchInput: string;
  setConsoleSearchInput: React.Dispatch<React.SetStateAction<string>>;
  consoleSearch: string;
  setConsoleSearch: React.Dispatch<React.SetStateAction<string>>;
  consoleFilter: 'todos' | 'data' | 'comprador' | 'tipo' | 'status';
  setConsoleFilter: React.Dispatch<React.SetStateAction<'todos' | 'data' | 'comprador' | 'tipo' | 'status'>>;
  consoleFilterOpen: boolean;
  setConsoleFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Developer config
  developerConfig: DeveloperConfig;
  setDeveloperConfig: React.Dispatch<React.SetStateAction<DeveloperConfig>>;

  // Toast
  actionToast: Toast | null;
  showToast: (message: string, type?: ToastType) => void;

  // Refs
  adminScrollRef: React.RefObject<HTMLDivElement | null>;
  imageFileInputRef: React.RefObject<HTMLInputElement | null>;

  // Computed
  isAdminLayout: boolean;
  showOnboarding: boolean;
  setShowOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
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
  handleResendCode: () => Promise<void>;
  handleCheckoutVerifyAndRegister: () => Promise<boolean>;
  handleEditEvent: (evt: Event) => Promise<void>;
  handleCreateEvent: () => void;
  handleSaveEvent: (isDraft?: boolean) => Promise<void>;
  handleUpdateEventStatus: (eventId: number, newStatus: Event['status']) => Promise<void>;
  handleImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddStaff: (e: React.FormEvent) => void;
  handleDeleteStaff: (id: string) => Promise<void>;
  handleEditStaff: (id: string, updates: { name?: string; username?: string; password?: string }) => Promise<void>;
  handleStaffLogin: (e: React.FormEvent) => Promise<void>;
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
  const [registeredUsersCount, setRegisteredUsersCount] = useState(0);

  // Tables / cart
  const [tables, setTables] = useState<TableDef[]>([]);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  // Números de mesa já ocupados (reservas pagas/pendentes) do evento ativo —
  // vindos do servidor (RLS impede o cliente de ler reservas alheias direto).
  const [occupiedTableIds, setOccupiedTableIds] = useState<number[]>([]);
  const [singleTickets, setSingleTickets] = useState(0);
  const [maleTickets, setMaleTickets] = useState(0);
  const [femaleTickets, setFemaleTickets] = useState(0);
  const [cartExpiresAt, setCartExpiresAt] = useState<number | null>(null);
  const [cartTimeLeft, setCartTimeLeft] = useState<number | null>(null);
  const [expandedSectorId, setExpandedSectorId] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<'selection' | 'mesa' | 'ingresso'>('selection');

  // Navigation
  const [currentView, setCurrentView] = useState<CurrentView>('home');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('list');
  const [isPreviewingEvent, setIsPreviewingEvent] = useState(false);
  const [selectedDashboardEvent, setSelectedDashboardEvent] = useState<number | null>(null);

  // Auth
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isApprovedEventCreator, setIsApprovedEventCreator] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffEventIds, setStaffEventIds] = useState<string[]>([]);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<'buy' | 'create_event'>('buy');

  // Permissions
  const { can, role, isAtLeast } = usePermissions(userRole, { isApprovedEventCreator });

  // Events
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [formEvent, setFormEvent] = useState<Event | null>(null);
  const [releaseValidationFields, setReleaseValidationFields] = useState<string[]>([]);

  // Staff
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newStaff, setNewStaff] = useState<{ name: string; username: string; password: string }>({ name: '', username: '', password: '' });

  // System logs
  const [systemLogs, setSystemLogs] = useState<{ id: string; level: 'error' | 'warn' | 'info'; message: string; time: Date }[]>([]);
  const clearSystemLogs = () => setSystemLogs([]);

  // Buyers / reservations
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);

  // Falha de carregamento de dados essenciais: banner com "Tentar novamente".
  // `reloadKey` reexecuta os effects de fetch sem recarregar a página.
  const [dataLoadError, setDataLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retryDataLoad = useCallback(() => {
    setDataLoadError(false);
    setReloadKey(k => k + 1);
  }, []);

  // Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('selection');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentFlowStatus>('idle');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [guestData, setGuestData] = useState<GuestData>({ name: '', email: '', cpf: '' });
  const [identificationOption, setIdentificationOption] = useState<'same_as_buyer' | 'fill_later'>('same_as_buyer');

  // Auth form
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    phoneCountry: '+55',
    birthDate: '',
    sex: '',
    password: '',
    confirmPassword: '',
    nationality: 'br',
    country: '',
    passportDoc: '',
  });
  const [registerStep, setRegisterStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [verificationStep, setVerificationStep] = useState(false);
  // Ticket assinado (HMAC) do OTP — devolvido pelo servidor no envio e reenviado na verificação
  const [verifyTicket, setVerifyTicket] = useState<{ ticket: string; exp: number } | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'staff'>('login');
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
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isTableLayoutEditorOpen, setIsTableLayoutEditorOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [showDefaultCredentialsWarning, setShowDefaultCredentialsWarning] = useState(
    () => localStorage.getItem('eventix-default-admin-warning') === 'true'
  );
  const [actionTicket, setActionTicket] = useState<any>(null);
  const [actionError, setActionError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionRestored, setSessionRestored] = useState(false);
  const [sessionConflict, setSessionConflict] = useState<string[]>([]);

  // Check-in
  const [checkInInput, setCheckInInput] = useState('');
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInSearchInput, setCheckInSearchInput] = useState('');
  const [checkInFilter, setCheckInFilter] = useState<'all' | 'pendentes' | 'check-ins'>('pendentes');
  const [checkInResult, setCheckInResult] = useState<{ type: 'success' | 'error' | 'warning'; message: string; data?: { name?: string; type?: string } } | null>(null);
  const [checkinTab, setCheckinTab] = useState<'scanner' | 'list'>('scanner');
  const [checkInHistory, setCheckInHistory] = useState<{ id: string; name: string; type: string; time: Date }[]>([]);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannerConstraints, setScannerConstraints] = useState<MediaTrackConstraints>({ facingMode: { ideal: 'environment' } });
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRetryRef = useRef(0);
  // Deduplicação do scanner: evita reprocessar o MESMO QR em sequência enquanto
  // a câmera segue lendo continuamente (allowMultiple). Guarda o último valor +
  // timestamp e um "lock" enquanto uma validação está em andamento.
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const checkinBusyRef = useRef(false);

  // Reservations UI
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [reservationsTab, setReservationsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedCod, setCopiedCod] = useState<string | null>(null);
  const [qrFullscreen, setQrFullscreen] = useState<{ id: string; name: string } | null>(null);

  // Dashboard UI
  const [salesChartPeriod, setSalesChartPeriod] = useState<'7d' | '30d'>('7d');
  const [consoleDisplayCount, setConsoleDisplayCount] = useState(4);
  const [consoleSearchInput, setConsoleSearchInput] = useState('');
  const [consoleSearch, setConsoleSearch] = useState('');
  const [consoleFilter, setConsoleFilter] = useState<'todos' | 'data' | 'comprador' | 'tipo' | 'status'>('todos');
  const [consoleFilterOpen, setConsoleFilterOpen] = useState(false);

  // Developer config
  const [developerConfig, setDeveloperConfig] = useState<DeveloperConfig>(loadDeveloperConfig);

  // Toast
  const [actionToast, setActionToast] = useState<Toast | null>(null);

  // Refs
  const adminScrollRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const paymentAbortRef = useRef<AbortController | null>(null);

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalTicketsSelected = singleTickets + maleTickets + femaleTickets;

  const activeEvent = (currentView === 'booking' && isPreviewingEvent && formEvent)
    ? formEvent
    : (currentView === 'booking' && !isPreviewingEvent
        ? (events.find(e => e.id === Number(selectedDashboardEvent)) || events.find(e => e.status === 'Vendas liberadas') || events.find(e => e.status === 'Ativo') || events.find(e => e.status === 'Em breve') || events[0])
        : (events.find(e => e.id === Number(selectedDashboardEvent)) || events.find(e => e.status === 'Vendas liberadas') || events.find(e => e.status === 'Ativo') || events[0]));

  const activeBatch = activeEvent?.batches?.find(b => b.is_active !== false) ?? activeEvent?.batches?.[0];
  const previewSectors = activeBatch?.sectors || [];

  const layoutTableElements = (activeEvent?.tableLayout || []).filter(
    el => el.type === 'round-table' || el.type === 'rect-table' || el.type === 'bistro-table'
  );

  const isOccupied = (id: number) => occupiedTableIds.includes(id);
  const derivedTables: TableDef[] = layoutTableElements.length > 0
    ? layoutTableElements.map((el, i) => {
        const existing = tables.find(t => t.id === i + 1);
        const defaultPrice = el.type === 'bistro-table'
          ? (activeEvent?.tableConfig?.bistroPrice ?? 200)
          : (activeEvent?.tableConfig?.tablePrice ?? 300);
        return {
          id: i + 1,
          capacity: el.capacity ?? activeEvent?.tableConfig?.seatsPerTable ?? 4,
          status: (isOccupied(i + 1) ? 'reserved' : (existing?.status || 'available')) as 'available' | 'reserved',
          price: el.price ?? existing?.price ?? defaultPrice,
        };
      })
    : [
        ...Array.from({ length: activeEvent?.tableConfig?.totalTables || 20 }).map((_, i) => {
          const existing = tables.find(t => t.id === i + 1);
          return {
            id: i + 1,
            capacity: activeEvent?.tableConfig?.seatsPerTable ?? existing?.capacity ?? 4,
            status: (isOccupied(i + 1) ? 'reserved' : (existing?.status || 'available')) as 'available' | 'reserved',
            price: existing?.price ?? activeEvent?.tableConfig?.tablePrice ?? 300,
          };
        }),
        ...Array.from({ length: activeEvent?.tableConfig?.totalBistros || 0 }).map((_, i) => {
          const id = (activeEvent?.tableConfig?.totalTables || 20) + i + 1;
          const existing = tables.find(t => t.id === id);
          return {
            id,
            capacity: 2,
            status: (isOccupied(id) ? 'reserved' : (existing?.status || 'available')) as 'available' | 'reserved',
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
  const grandTotal = subTotal;

  const isAdminLayout = (userRole === 'admin' || userRole === 'developer' || userRole === 'staff') && !isPreviewingEvent;

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Gerencia sessão do Supabase: admin/developer jamais são auto-logados ao abrir a página
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          try {
            const profile = await getMyProfile();
            // Todos os papéis (cliente, admin e developer) têm a sessão restaurada
            // ao recarregar a página — o usuário permanece logado.
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
              // Rebusca eventos com sessão restaurada (subscribeToEvents pode ter rodado sem auth)
              getEvents()
                .then(data => setEvents(data.map(mapDbEventToApp)))
                .catch(e => console.error('[Context] Erro ao buscar eventos (INITIAL_SESSION):', (e as Error)?.message))
                .finally(() => setLoadingEvents(false));
            }
          } catch (err) {
            const errMsg = String(err).toLowerCase();
            console.error('[Context] Erro ao verificar sessão inicial:', err);
            // Limpar sessão corrompida em todos os casos de erro
            try {
              ['eventix-auth-v2', 'eventix-auth'].forEach(k => localStorage.removeItem(k));
              Object.keys(localStorage)
                .filter(k => k.startsWith('sb-') || k.includes('supabase'))
                .forEach(k => localStorage.removeItem(k));
              sessionStorage.clear();
            } catch {}
            if (errMsg.includes('infinite recursion') || errMsg.includes('policies')) {
              console.error('[Context] Erro de RLS ao restaurar a sessão:', err);
              showToast('Não foi possível restaurar sua sessão (erro de permissão no banco). Faça login novamente.', 'error');
            }
          }
        }
      } else if (event === 'SIGNED_IN') {
        // Login explícito pelo formulário — atualiza estado normalmente
        if (session?.user) {
          try {
            const profile = await getMyProfile();
            // Acesso de admin/dev SÓ é permitido pelo Acesso Master (portal). Se
            // este login fresco não veio de lá (ex.: Google ou Acesso Simples),
            // encerra a sessão. (Reload usa INITIAL_SESSION e não passa aqui.)
            const fromMaster = (() => { try { return sessionStorage.getItem('eventix-master-login') === '1'; } catch { return false; } })();
            if (profile && (profile.role === 'admin' || profile.role === 'developer') && !fromMaster) {
              try { sessionStorage.removeItem('eventix-master-login'); } catch { /* ignore */ }
              await signOut().catch(() => {});
              showToast('Contas administrativas entram pelo Acesso Master (link no rodapé do site).', 'error');
              return;
            }
            try { sessionStorage.removeItem('eventix-master-login'); } catch { /* ignore */ }
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
        // Limpar token inválido do localStorage (previne loop de refresh_token 400)
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('sb-') || k === 'eventix-auth' || k === 'eventix-auth-v2') localStorage.removeItem(k);
          });
        } catch {}
        setUserRole(null);
        setLoggedInUserId(null);
        setIsApprovedEventCreator(false);
        setSessionUser(null);
        setIsStaff(false);
        sessionStorage.removeItem('auth-cleared');
        // Recarregar eventos para a visão pública (não limpar — usuário anônimo ainda vê eventos)
        if (!loadingEvents) {
          getEvents()
            .then(data => setEvents(data.map(mapDbEventToApp)))
            .catch(() => setEvents([]));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Browser back button ─────────────────────────────────────────────────
  const _historyInitialized = useRef(false);
  const _isPopState = useRef(false);

  useEffect(() => {
    if (!_historyInitialized.current) {
      _historyInitialized.current = true;
      window.history.replaceState({ view: currentView }, '');
      return;
    }
    if (_isPopState.current) {
      _isPopState.current = false;
      return;
    }
    window.history.pushState({ view: currentView }, '');
  }, [currentView]);

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const view = e.state?.view as CurrentView | undefined;
      if (view) {
        _isPopState.current = true;
        setCurrentView(view);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    adminScrollRef.current?.scrollTo(0, 0);
  }, [currentView, dashboardMode]);

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
      setRegisterForm({ name: '', email: '', cpf: '', phone: '', phoneCountry: '+55', birthDate: '', sex: '', password: '', confirmPassword: '', nationality: 'br', country: '', passportDoc: '' });
      setRegisterStep(1);
      setVerificationStep(false);
      setVerificationCode(['', '', '', '', '', '']);
      setAdminError('');
      setForgotPasswordStep('none');
      setForgotPasswordData({ email: '', code: '', newPassword: '' });
      setTotpPending(false);
      setTotpInput('');
    }

    if (currentView === 'home') {
      setIsCheckoutOpen(false);
      setCheckoutStep('selection');
      setPaymentStatus('idle');
      setErrors({});
    }

    if (currentView === 'dashboard') {
      if (!formEvent?.id) setFormEvent(null);
      setMessageText('');
      setIsMessageModalOpen(false);
    }

    if (currentView !== 'booking' && currentView !== 'admin-login') {
      setGuestData({ name: '', email: '', cpf: '' });
    }
  }, [currentView]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let firstLoad = true;

    const safetyTimeout = setTimeout(() => {
      if (firstLoad) {
        firstLoad = false;
        setLoadingEvents(false);
        console.warn('[Context] Timeout ao carregar eventos — liberando loading');
      }
    }, 8000);

    const unsubscribe = subscribeToEvents(data => {
      setEvents(data.map(mapDbEventToApp).map(e =>
        e.date < today && e.status !== 'Finalizado' ? { ...e, status: 'Finalizado' as const } : e
      ));
      if (firstLoad) {
        firstLoad = false;
        clearTimeout(safetyTimeout);
        setLoadingEvents(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Carrega lotes/setores do evento ao entrar na página de compra.
  // getEvents() não traz batches (carregados sob demanda); sem isto o card de
  // Ingressos nunca aparece no fluxo público e a compra fica impossível.
  useEffect(() => {
    if (currentView !== 'booking') return;
    const ev = activeEvent;
    if (!ev) return;
    if ((ev.batches?.length ?? 0) > 0) { setLoadingBatches(false); return; }
    let cancelled = false;
    let attempts = 0;
    setLoadingBatches(true);
    // Retry com backoff: rede instável fazia o card de ingressos nunca aparecer
    // (a falha era engolida no .catch sem nova tentativa nem indicador de loading).
    const run = () => {
      attempts++;
      getEventBatches(ev.id)
        .then(rawBatches => {
          if (cancelled) return;
          const mapped = mapDbEventToApp({ batches: rawBatches });
          setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, batches: mapped.batches } : e));
          setFormEvent(prev => prev && prev.id === ev.id ? { ...prev, batches: mapped.batches } : prev);
          setLoadingBatches(false);
        })
        .catch(e => {
          console.error(`[Context] Erro ao carregar lotes do evento (tentativa ${attempts}):`, (e as Error)?.message);
          if (cancelled) return;
          if (attempts < 3) setTimeout(run, 1200 * attempts);
          else { setLoadingBatches(false); setDataLoadError(true); }
        });
    };
    run();
    return () => { cancelled = true; };
  }, [currentView, activeEvent?.id, reloadKey]);

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') { setPendingApprovalsCount(0); return; }
    getPendingApplications().then(apps => setPendingApprovalsCount(apps.length)).catch(e => console.error('[Context] Erro ao buscar aprovações:', (e as Error)?.message));
    const unsubscribe = subscribeToPendingApplications(setPendingApprovalsCount);
    return () => { unsubscribe(); };
  }, [userRole]);

  useEffect(() => {
    getSystemConfig()
      .then(cfg => {
        try { sessionStorage.removeItem('eventix-config-reload'); } catch {}
        setDataLoadError(false);
        setSiteConfig(prev => ({
          ...prev,
          venueMaxCapacity: cfg.venue_max_capacity ?? null,
          platformName: cfg.site_name ?? prev.platformName,
          platformFeePercent: cfg.platform_fee_percent ?? 10,
          gatewayFeePercent: cfg.gateway_fee_percent ?? 0,
        }));
      })
      .catch(() => {
        // Autocorreção (1x por sessão): limpa tokens Supabase possivelmente
        // corrompidos e recarrega. Em recidiva, mostra banner com retry em vez
        // de entrar em loop de reload.
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem('eventix-config-reload') === '1'; } catch {}
        if (!alreadyReloaded) {
          try { sessionStorage.setItem('eventix-config-reload', '1'); } catch {}
          try {
            Object.keys(localStorage)
              .filter(k => k.startsWith('sb-') || k.includes('supabase'))
              .forEach(k => localStorage.removeItem(k));
          } catch {}
          window.location.reload();
          return;
        }
        setDataLoadError(true);
      });
  }, [reloadKey]);

  // Carrega a contagem de usuários cadastrados para o dashboard
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') return;
    getRegisteredUsersCount().then(setRegisteredUsersCount).catch(() => {});
  }, [userRole]);

  // Detecta o PRIMEIRO acesso do administrador: se o onboarding ainda não foi
  // concluído (flag no system_config) e não foi marcado neste navegador, abre o
  // fluxo guiado de configuração inicial.
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') { setShowOnboarding(false); return; }
    let done = false;
    try { done = localStorage.getItem('eventix-onboarding-done') === '1'; } catch { /* ignore */ }
    if (done) return;
    getSystemConfigAdmin()
      .then(cfg => { if (cfg.onboarding_completed !== true) setShowOnboarding(true); })
      .catch(() => {});
  }, [userRole]);

  // Realtime: sincroniza mudanças no perfil do usuário logado sem precisar recarregar
  useEffect(() => {
    if (!loggedInUserId) return;
    const unsubscribe = subscribeToProfile(loggedInUserId, (profile) => {
      const r = profile.role as UserRole;
      setUserRole(r);
      setIsApprovedEventCreator(profile.is_approved_event_creator);
      setSessionUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: r,
        isApprovedEventCreator: profile.is_approved_event_creator,
        avatarUrl: profile.avatar_url,
      });
    });
    return () => { unsubscribe(); };
  }, [loggedInUserId]);

  // Auto-sincroniza credenciais MP com o servidor sempre que admin/developer faz login
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') return;
    const token = localStorage.getItem('mp_access_token');
    const key = localStorage.getItem('mp_public_key');
    if (!token || !key) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch('/api/admin/set-mp-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accessToken: token, publicKey: key }),
      }).catch(() => {});
    });
  }, [userRole, loggedInUserId]);

  // Carrega RESERVAS REAIS do banco para o dashboard / "Minhas Reservas".
  // admin/developer/organizador veem todas as visíveis (RLS escopa); cliente vê
  // as suas. Também deriva a lista de `buyers` (vendas/clientes/check-in) dos
  // dados reais — nada de mock.
  useEffect(() => {
    if (!loggedInUserId) { setReservations([]); setBuyers([]); return; }
    let cancelled = false;
    const apply = (rows: any[]) => {
      if (cancelled) return;
      setReservations(rows.map(mapDbReservationToApp));
      setBuyers(rows.map(mapReservationToBuyer));
    };
    if (userRole === 'staff') {
      // Equipe de portaria: sem sessão Supabase — busca pelo token de staff.
      (async () => {
        try {
          const token = (() => { try { return localStorage.getItem('eventix-staff-token'); } catch { return null; } })();
          const resp = await fetch('/api/staff/event-tickets', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const data = await resp.json().catch(() => ({ reservations: [] }));
          apply((data.reservations ?? []) as any[]);
        } catch (e) {
          console.error('[Reservas] Falha ao carregar (staff):', (e as Error)?.message);
          if (!cancelled) setDataLoadError(true);
        }
      })();
      return () => { cancelled = true; };
    }
    const isStaffRole = userRole === 'admin' || userRole === 'developer' || isApprovedEventCreator;
    const load = isStaffRole ? getAllReservations() : getMyReservations(loggedInUserId);
    load
      .then(rows => apply(rows as any[]))
      .catch(e => {
        console.error('[Reservas] Falha ao carregar do banco:', (e as Error)?.message);
        if (!cancelled) setDataLoadError(true);
      });
    return () => { cancelled = true; };
  }, [loggedInUserId, userRole, isApprovedEventCreator, reloadKey]);

  // Mesas ocupadas do evento ativo (bloqueia mesa já vendida no mapa).
  useEffect(() => {
    const eventId = activeEvent?.id;
    if (!eventId) { setOccupiedTableIds([]); return; }
    let cancelled = false;
    fetch(`/api/events/${eventId}/occupied-tables`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setOccupiedTableIds(Array.isArray(d?.tables) ? d.tables.map(Number) : []); })
      .catch(() => { if (!cancelled) setOccupiedTableIds([]); });
    return () => { cancelled = true; };
  }, [activeEvent?.id, paymentStatus, reloadKey]);

  // Session persistence
  useEffect(() => {
    const handleError = (e: any) => {
      const errStr = String(e.reason?.message || e.reason || e.message || '');
      if (errStr.includes('WebSocket') || errStr.includes('websocket')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    const addLog = (level: 'error' | 'warn' | 'info', args: any[]) => {
      const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      setSystemLogs(prev => [{ id: crypto.randomUUID(), level, message, time: new Date() }, ...prev].slice(0, 100));
    };
    const origError = console.error;
    const origWarn = console.warn;
    const origInfo = console.info;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('[vite] failed to connect to websocket')) return;
      addLog('error', args);
      origError.apply(console, args);
    };
    console.warn = (...args) => { addLog('warn', args); origWarn.apply(console, args); };
    console.info = (...args) => { addLog('info', args); origInfo.apply(console, args); };

    // Limpar dados transientes do localStorage legado
    localStorage.removeItem('eventix-session');

    const savedCart = sessionStorage.getItem('eventix-cart');
    if (savedCart) {
      try {
        const session = JSON.parse(savedCart);
        let restoredAnything = false;
        const conflictList: string[] = [];
        if (session.singleTickets) { setSingleTickets(session.singleTickets); restoredAnything = true; }
        if (session.guestData?.name) { setGuestData(prev => ({ ...prev, ...session.guestData })); restoredAnything = true; }
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
      } catch { sessionStorage.removeItem('eventix-cart'); }
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
      console.error = origError;
      console.warn = origWarn;
      console.info = origInfo;
    };
  }, []);

  useEffect(() => {
    // Não persistir estados de pagamento em andamento ou finalizado
    if (paymentStatus === 'processing' || paymentStatus === 'in_review' || paymentStatus === 'success') return;
    if (selectedTables.length === 0 && singleTickets === 0) {
      sessionStorage.removeItem('eventix-cart');
      return;
    }
    const { cpf: _cpf, ...guestDataSafe } = guestData;
    sessionStorage.setItem('eventix-cart', JSON.stringify({ selectedTables, singleTickets, guestData: guestDataSafe }));
  }, [selectedTables, singleTickets, guestData, paymentStatus]);

  // Carrega a equipe de portaria do servidor (service role bypassa RLS).
  const loadStaffAccounts = async () => {
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch('/api/staff', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({ staff: [] }));
      setStaffAccounts((data.staff ?? []) as StaffAccount[]);
    } catch (e) {
      console.error('[Context] Erro ao carregar staff:', (e as Error)?.message);
    }
  };
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') return;
    loadStaffAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // ─── Reset de estados transientes ────────────────────────────────────────

  const resetAllTransientState = () => {
    stopPaymentPolling();
    pendingPaymentRef.current = null;
    setIsCheckoutOpen(false);
    setCheckoutStep('selection');
    setPaymentStatus('idle');
    setPixData(null);
    setIsProcessingPayment(false);
    setCartExpiresAt(null);
    setCartTimeLeft(null);
    setAdminError('');
    setAdminForm({ username: '', password: '' });
    setRegisterForm({ name: '', email: '', cpf: '', phone: '', phoneCountry: '+55', birthDate: '', sex: '', password: '', confirmPassword: '', nationality: 'br', country: '', passportDoc: '' });
    setRegisterStep(1);
    setVerificationStep(false);
    setVerificationCode(['', '', '', '', '', '']);
    setTotpPending(false);
    setTotpInput('');
    setForgotPasswordStep('none');
    setForgotPasswordData({ email: '', code: '', newPassword: '' });
    setMessageText('');
    setIsMessageModalOpen(false);
    setIsStaffModalOpen(false);
    setErrors({});
  };

  // Garantir estado limpo em cada carregamento de página
  useEffect(() => {
    resetAllTransientState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpar sessionStorage e abortar fetch se pagamento em andamento ao recarregar
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isProcessingPayment || paymentStatus === 'processing') {
        sessionStorage.removeItem('eventix-cart');
        paymentAbortRef.current?.abort();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessingPayment, paymentStatus]);

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
    const input = adminForm.username.trim();
    // Marca se este login veio do Acesso Master (portal). O handler SIGNED_IN usa
    // isso para barrar admin/dev que tentem entrar por fora (Google/Acesso Simples).
    try {
      if (currentView === 'staff-portal') sessionStorage.setItem('eventix-master-login', '1');
      else sessionStorage.removeItem('eventix-master-login');
    } catch { /* ignore */ }
    try {
      // Aceita e-mail direto ou nome de usuário (resolvido para e-mail no servidor)
      let email = input;
      if (!input.includes('@')) {
        const resolved = await resolveUsernameToEmail(input);
        if (!resolved) { setAdminError('Usuário não encontrado'); return; }
        email = resolved;
      }
      await signIn(email, adminForm.password);
      const profile: Profile | null = await getMyProfile();
      if (!profile) throw new Error('Perfil não encontrado');
      const r = profile.role as UserRole;
      // Acesso Simples (página normal do cliente) NÃO autentica admin/dev — eles
      // entram pelo Acesso Master (rodapé). Bloqueia e encerra a sessão.
      if (currentView === 'admin-login' && (r === 'admin' || r === 'developer')) {
        await signOut().catch(() => {});
        setAdminError('Contas administrativas entram pelo Acesso Master (link no rodapé do site).');
        return;
      }
      setUserRole(r);
      setLoggedInUserId(profile.id);
      setIsApprovedEventCreator(profile.is_approved_event_creator);
      setSessionUser({ id: profile.id, email: profile.email, name: profile.name, role: r, isApprovedEventCreator: profile.is_approved_event_creator, avatarUrl: profile.avatar_url });
      if (r === 'admin' || r === 'developer') { setCurrentView('dashboard'); setDashboardMode('admin-overview'); }
      else if (profile.is_approved_event_creator) { setCurrentView('dashboard'); setDashboardMode('producer-dashboard'); }
      else setCurrentView('booking');
    } catch (err: any) {
      setAdminError(err.message ?? 'Usuário ou senha incorretos');
    }
  };

  const handleLogout = async () => {
    // Limpa o estado e o storage PRIMEIRO — não depende do signOut remoto, que
    // pode TRAVAR no lock de sessão do supabase-js (navigator.locks) após as
    // operações de auth da compra. Era isso que impedia o logout.
    setUserRole(null);
    setLoggedInUserId(null);
    setIsStaff(false);
    setIsApprovedEventCreator(false);
    setSessionUser(null);
    setCurrentView('home');
    setDashboardMode('list');
    try {
      ['eventix-session', 'eventix-auth', 'eventix-auth-v2', 'eventix-staff-token'].forEach(k => localStorage.removeItem(k));
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('auth-cleared');
    } catch {}
    // signOut com timeout: se o lock estiver preso, não trava o logout.
    try {
      await Promise.race([signOut(), new Promise(res => setTimeout(res, 1200))]);
    } catch (e) {
      console.warn('[Auth] signOut error (ignorado):', e);
    }
    setTimeout(() => { window.location.href = '/'; }, 80);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep === 1) {
      if (!registerForm.name.trim()) { setAdminError('Informe seu nome completo'); return; }
      if (!registerForm.email.trim()) { setAdminError('Informe seu e-mail'); return; }
      if (registerForm.nationality === 'br') {
        const cpf = registerForm.cpf.replace(/\D/g, '');
        if (cpf.length !== 11) { setAdminError('CPF inválido — informe os 11 dígitos'); return; }
      } else {
        if (!registerForm.country) { setAdminError('Selecione seu país'); return; }
        if (!registerForm.passportDoc.trim()) { setAdminError('Informe o número do documento/passaporte'); return; }
      }
      const phone = registerForm.phone.replace(/\D/g, '');
      if (phone.length < 8) { setAdminError('Informe um número de celular válido'); return; }
      if (!registerForm.birthDate) { setAdminError('Informe sua data de nascimento'); return; }
      if (!registerForm.sex) { setAdminError('Selecione seu sexo'); return; }
      setAdminError('');
      setRegisterStep(2);
      return;
    } else {
      if (!registerForm.password || registerForm.password.length < 6) { setAdminError('A senha deve ter no mínimo 6 caracteres'); return; }
      if (registerForm.password !== registerForm.confirmPassword) { setAdminError('As senhas não coincidem'); return; }
      setAdminError('');
      try {
        const resp = await fetch('/api/auth/send-verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: registerForm.email }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setAdminError((data as any).error ?? 'Erro ao enviar código. Tente novamente.');
          return;
        }
        setVerifyTicket({ ticket: (data as any).ticket, exp: (data as any).exp });
        setVerificationCode(['', '', '', '', '', '']);
        setVerificationStep(true);
      } catch {
        setAdminError('Erro de conexão. Verifique sua internet.');
      }
    }
  };

  const handleResendCode = async () => {
    if (!registerForm.email) { setAdminError('E-mail não informado.'); return; }
    try {
      const resp = await fetch('/api/auth/send-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.email }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setAdminError((data as any).error ?? 'Erro ao reenviar código.');
        return;
      }
      setVerifyTicket({ ticket: (data as any).ticket, exp: (data as any).exp });
      setVerificationCode(['', '', '', '', '', '']);
      setAdminError('');
      showToast('Novo código enviado para o seu e-mail.', 'success');
    } catch {
      setAdminError('Erro de conexão ao reenviar código.');
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length < 6) { setAdminError('Preencha o código completo (6 dígitos)'); return; }
    if (!verifyTicket) { setAdminError('Sessão de verificação expirada. Reenvie o código.'); return; }
    setAdminError('');
    try {
      const checkResp = await fetch('/api/auth/check-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.email, code, ticket: verifyTicket.ticket, exp: verifyTicket.exp }),
      });
      const checkData = await checkResp.json().catch(() => ({}));
      if (!checkResp.ok || !(checkData as any).valid) {
        setAdminError((checkData as any).error ?? 'Código inválido.');
        return;
      }
      // Campos NÃO-sensíveis vão no user_metadata → gravados pelo trigger handle_new_user.
      await signUp(registerForm.email, registerForm.password, registerForm.name, {
        sex: registerForm.sex || undefined,
        nationality: registerForm.nationality || undefined,
        country: registerForm.nationality === 'foreign' ? registerForm.country : undefined,
        passport_doc: registerForm.nationality === 'foreign' ? registerForm.passportDoc : undefined,
        phone_country: registerForm.phoneCountry || undefined,
      } as any);

      // Inicia sessão para (a) manter o usuário logado e (b) gravar os dados sensíveis
      // (cpf/phone/birth_date) criptografados pelo servidor em /api/profile/sensitive.
      let sessUserId: string | null = null;
      try {
        const signInRes = await signIn(registerForm.email, registerForm.password);
        sessUserId = (signInRes as any)?.user?.id ?? null;
      } catch { /* confirmação de e-mail pode estar ativa — cai no fluxo de login manual */ }

      if (sessUserId) {
        const sensitive: { cpf?: string; phone?: string; birth_date?: string } = {};
        const phone = registerForm.phone.replace(/\D/g, '');
        if (phone) sensitive.phone = phone;
        if (registerForm.nationality === 'br') {
          const cpf = registerForm.cpf.replace(/\D/g, '');
          if (cpf) sensitive.cpf = cpf;
        }
        if (registerForm.birthDate) sensitive.birth_date = registerForm.birthDate;
        if (Object.keys(sensitive).length > 0) {
          try { await updateProfile(sessUserId, sensitive); }
          catch (e) {
            console.error('[Cadastro] Falha ao gravar dados sensíveis:', (e as Error)?.message);
            showToast('Conta criada, mas não foi possível salvar CPF/telefone/nascimento. Atualize no seu perfil.', 'error');
          }
        }
      }

      setVerificationStep(false);
      setVerifyTicket(null);
      setRegisterForm({ name: '', email: '', cpf: '', phone: '', phoneCountry: '+55', birthDate: '', sex: '', password: '', confirmPassword: '', nationality: 'br', country: '', passportDoc: '' });
      setVerificationCode(['', '', '', '', '', '']);
      setAdminForm({ username: '', password: '' });
      setRegisterStep(1);
      if (sessUserId) {
        showToast('Cadastro concluído!', 'success');
        setCurrentView('home');
      } else {
        showToast('Cadastro concluído! Faça login para continuar.', 'success');
        setAuthTab('login');
      }
    } catch (err: any) {
      setAdminError(err.message ?? 'Erro ao criar conta');
    }
  };

  // Cadastro durante o checkout: valida OTP, cria a conta REAL no Supabase e já
  // deixa o usuário logado (sessão ativa exigida para pagar). Retorna true em sucesso.
  const handleCheckoutVerifyAndRegister = async (): Promise<boolean> => {
    const code = verificationCode.join('');
    if (code.length < 6) { setAdminError('Preencha o código completo (6 dígitos)'); return false; }
    if (!verifyTicket) { setAdminError('Sessão de verificação expirada. Reenvie o código.'); return false; }
    setAdminError('');
    try {
      // 1. Valida o OTP no servidor
      const checkResp = await fetch('/api/auth/check-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.email, code, ticket: verifyTicket.ticket, exp: verifyTicket.exp }),
      });
      const checkData = await checkResp.json().catch(() => ({}));
      if (!checkResp.ok || !(checkData as any).valid) {
        setAdminError((checkData as any).error ?? 'Código inválido.');
        return false;
      }

      // 2. Cria a conta real no Supabase (campos não-sensíveis via user_metadata → trigger)
      const result = await signUp(registerForm.email, registerForm.password, registerForm.name, {
        sex: registerForm.sex || undefined,
        nationality: registerForm.nationality || undefined,
        country: registerForm.nationality === 'foreign' ? registerForm.country : undefined,
        passport_doc: registerForm.nationality === 'foreign' ? registerForm.passportDoc : undefined,
        phone_country: registerForm.phoneCountry || undefined,
      } as any);

      // 3. Garante sessão ativa (se a confirmação de e-mail do Supabase estiver
      //    desabilitada, o signUp já loga; senão, faz signIn explícito).
      let user = (result as any)?.user ?? null;
      let session = (result as any)?.session ?? null;
      if (!session) {
        const signInRes = await signIn(registerForm.email, registerForm.password);
        user = (signInRes as any)?.user ?? user;
        session = (signInRes as any)?.session ?? null;
      }
      if (!user || !session) {
        setAdminError('Conta criada, mas não foi possível iniciar a sessão. Faça login para continuar.');
        return false;
      }

      // 3b. Grava os dados sensíveis (cpf/phone/birth_date) criptografados no servidor.
      const sensitive: { cpf?: string; phone?: string; birth_date?: string } = {};
      const phoneDigits = registerForm.phone.replace(/\D/g, '');
      if (phoneDigits) sensitive.phone = phoneDigits;
      if (registerForm.nationality === 'br') {
        const cpfDigits = registerForm.cpf.replace(/\D/g, '');
        if (cpfDigits) sensitive.cpf = cpfDigits;
      }
      if (registerForm.birthDate) sensitive.birth_date = registerForm.birthDate;
      if (Object.keys(sensitive).length > 0) {
        try { await updateProfile(user.id, sensitive); }
        catch (e) {
          console.error('[Checkout] Falha ao gravar dados sensíveis:', (e as Error)?.message);
          showToast('Não foi possível salvar CPF/telefone. Você pode completar no seu perfil depois.', 'error');
        }
      }

      // 4. Reflete a sessão no app
      const buyerName = registerForm.name || 'Usuário';
      const buyerEmail = registerForm.email;
      const buyerCpf = registerForm.cpf || '000.000.000-00';
      setUserRole('client');
      setIsApprovedEventCreator(false);
      setSessionUser({
        id: user.id,
        email: user.email ?? buyerEmail,
        name: buyerName,
        role: 'client',
        isApprovedEventCreator: false,
      });
      setLoggedInUserId(user.id);
      setGuestData({ name: buyerName, email: buyerEmail, cpf: buyerCpf });

      // 5. Limpa estado de verificação/cadastro
      setVerificationStep(false);
      setVerifyTicket(null);
      setVerificationCode(['', '', '', '', '', '']);
      setRegisterForm({ name: '', email: '', cpf: '', phone: '', phoneCountry: '+55', birthDate: '', sex: '', password: '', confirmPassword: '', nationality: 'br', country: '', passportDoc: '' });
      setAdminForm({ username: '', password: '' });
      showToast(`Bem-vindo(a), ${buyerName.split(' ')[0]}!`, 'success');
      return true;
    } catch (err: any) {
      setAdminError(err?.message ?? 'Erro ao criar conta.');
      return false;
    }
  };

  const handleEditEvent = async (evt: Event) => {
    setFormEvent({ ...evt, batches: [] });
    setSelectedDashboardEvent(evt.id);
    setDashboardMode('edit');
    try {
      const rawBatches = await getEventBatches(evt.id);
      const mapped = mapDbEventToApp({ batches: rawBatches });
      setFormEvent(prev => prev ? { ...prev, batches: mapped.batches } : prev);
    } catch (e) {
      console.error('[handleEditEvent] Erro ao carregar batches:', e);
    }
  };

  const handleCreateEvent = () => {
    const newEvt: Event = {
      id: Math.max(0, ...events.map(e => e.id)) + 1,
      title: '', description: '', date: new Date().toISOString().split('T')[0], time: '20:00',
      location: '', status: 'Rascunho', img: '', assignedStaffIds: [], priceType: 'unique',
      batches: [], hasTables: false, capacity: siteConfig.venueMaxCapacity ?? 0,
    };
    setFormEvent(newEvt);
    setSelectedDashboardEvent(newEvt.id);
    setDashboardMode('edit');
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formEvent) return;
    const localPreviewUrl = URL.createObjectURL(file);
    setFormEvent(prev => prev ? { ...prev, img: localPreviewUrl } : prev);
    setReleaseValidationFields(prev => prev.filter(f => f !== 'Imagem de Capa'));
    try {
      showToast('Fazendo upload da imagem...', 'info');
      const url = await uploadEventImage(file, formEvent.id);
      URL.revokeObjectURL(localPreviewUrl);
      setFormEvent(prev => prev ? { ...prev, img: url } : prev);
      showToast('Imagem atualizada com sucesso!', 'success');
    } catch (err: any) {
      showToast(`Erro no upload: ${err?.message || String(err)}. A pré-visualização está ativa, mas salve também via URL.`, 'error');
    }
    e.target.value = '';
  };

  const handleSaveEvent = async (isDraft = false) => {
    if (!formEvent) return;
    if (!formEvent.title || !formEvent.date) {
      setErrors({ form: 'Por favor, preencha os campos obrigatórios (Nome e Data).' });
      return;
    }
    const location = formEvent.location || siteConfig.address || '';
    const cap = formEvent.capacity ?? 0;
    if (cap > 0) {
      const totalQty = (formEvent.batches ?? []).reduce((sum, b) => sum + (b.sectors ?? []).reduce((s2, sec) => s2 + (sec.quantity ?? 0), 0), 0);
      if (totalQty > cap) { showToast(`Total de ingressos (${totalQty}) excede a capacidade máxima (${cap}).`, 'error'); return; }
    }
    try {
      const isNew = !events.some(e => e.id === formEvent.id);
      const statusToSave = isNew ? 'Rascunho' : (isDraft ? 'Rascunho' : formEvent.status);
      const eventToSave = { ...mapAppEventToDb({ ...formEvent, status: statusToSave, location }), batches: formEvent.batches, created_by: loggedInUserId || undefined };
      const saved = await saveEventToDb(eventToSave as any);
      const mappedSaved = mapDbEventToApp(saved);
      const savedWithBatches = {
        ...mappedSaved,
        batches: (saved as any).batches?.length ? (saved as any).batches.map((b: any) => ({
          id: b.id, name: b.name ?? '', startDate: b.start_date ?? '', endDate: b.end_date ?? '',
          is_active: b.is_active ?? true, sort_order: b.sort_order,
          sectors: (b.sectors ?? []).map((s: any) => ({
            id: s.id, name: s.name ?? '', quantity: s.quantity ?? 0, price: s.price ?? 0,
            priceMale: s.price_male, priceFemale: s.price_female, convenienceFee: s.convenience_fee,
            limitPerUser: s.limit_per_user, visibility: s.visibility ?? 'public', description: s.description,
          })),
        })) : formEvent.batches,
      };
      setEvents(prev => {
        const exists = prev.some(e => e.id === savedWithBatches.id);
        return exists ? prev.map(e => e.id === savedWithBatches.id ? savedWithBatches : e) : [...prev, savedWithBatches];
      });
      setFormEvent(null);
      setDashboardMode('list');
      setReleaseValidationFields([]);
      showToast(isNew ? 'Rascunho salvo! Acesse o painel do evento para publicar.' : 'Evento atualizado com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar evento: ' + (err?.message || String(err)), 'error');
    }
  };

  const handleUpdateEventStatus = async (eventId: number, newStatus: Event['status']) => {
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;
    if (newStatus === 'Vendas liberadas') {
      const missing: string[] = [];
      if (!evt.title?.trim()) missing.push('Nome do Evento');
      if (!evt.date) missing.push('Data');
      if (!evt.time) missing.push('Horário');
      if (!evt.location?.trim()) missing.push('Local');
      if (!evt.img) missing.push('Imagem de Capa');
      if (!evt.hasTables && (!evt.batches || evt.batches.length === 0)) missing.push('Pelo menos 1 Lote de Ingressos ou Apoio & Mesas ativo');
      if (missing.length > 0) {
        setReleaseValidationFields(missing);
        showToast(`Campos obrigatórios: ${missing.join(' • ')}`, 'error');
        handleEditEvent(evt);
        return;
      }
    }
    setReleaseValidationFields([]);
    try {
      const eventToSave = { ...mapAppEventToDb({ ...evt, status: newStatus }), created_by: loggedInUserId || undefined };
      const saved = await saveEventToDb(eventToSave as any);
      const mappedSaved = mapDbEventToApp(saved);
      setEvents(prev => prev.map(e => e.id === eventId ? mappedSaved : e));
      showToast(`Status alterado para "${newStatus}"`, 'success');
    } catch (err: any) {
      showToast('Erro ao alterar status: ' + (err?.message || String(err)), 'error');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username || !newStaff.password) return;
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: newStaff.name, username: newStaff.username, password: newStaff.password, eventIds: [] }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) { showToast(data.error || 'Falha ao cadastrar colaborador.', 'error'); return; }
      // Atualização otimista — sem esperar o reload para refletir na lista
      if (data.staff) setStaffAccounts(prev => [...prev, data.staff]);
      setNewStaff({ name: '', username: '', password: '' });
      showToast('Colaborador cadastrado com sucesso.', 'success');
    } catch {
      showToast('Erro de conexão ao cadastrar.', 'error');
    }
  };

  const handleEditStaff = async (id: string, updates: { name?: string; username?: string; password?: string }) => {
    // Atualização otimista imediata
    setStaffAccounts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(updates),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        showToast(data.error || 'Falha ao editar colaborador.', 'error');
        // Reverte a atualização otimista buscando dados reais
        await loadStaffAccounts();
      } else {
        showToast('Colaborador atualizado.', 'success');
      }
    } catch {
      showToast('Erro de conexão ao editar.', 'error');
      await loadStaffAccounts();
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) { showToast('Falha ao remover colaborador.', 'error'); return; }
      setStaffAccounts(prev => prev.filter(s => s.id !== id));
    } catch {
      showToast('Erro de conexão ao remover.', 'error');
    }
  };

  // Login da equipe de portaria: autentica em /api/staff/login (sem Supabase
  // Auth), guarda o token de staff e leva direto ao Controle de Portaria do
  // evento vinculado. O acesso fica restrito a esse evento e a essa página.
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    try {
      const resp = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminForm.username.trim(), password: adminForm.password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) { setAdminError(data.error || 'Usuário ou senha incorretos'); return; }
      try { localStorage.setItem('eventix-staff-token', data.token); } catch {}
      const eventIds: string[] = data.staff?.eventIds ?? [];
      setUserRole('staff');
      setIsStaff(true);
      setIsApprovedEventCreator(false);
      setStaffEventIds(eventIds);
      setLoggedInUserId(data.staff?.id ?? 'staff');
      setSessionUser({ id: data.staff?.id ?? 'staff', email: '', name: data.staff?.name ?? 'Colaborador', role: 'staff', isApprovedEventCreator: false });
      // Mostra a lista de eventos vinculados; o ajudante escolhe e cai na portaria.
      setSelectedDashboardEvent(null);
      setCurrentView('dashboard');
      setDashboardMode('list');
      setAdminForm({ username: '', password: '' });
    } catch {
      setAdminError('Erro de conexão. Tente novamente.');
    }
  };

  // Normaliza o conteúdo lido do QR. O ingresso codifica o id do ticket_items
  // (UUID), mas blindamos contra QRs que venham como URL, JSON ou com espaços.
  const extractTicketId = (raw: string): string => {
    let v = (raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) {
      try {
        const u = new URL(v);
        v = u.searchParams.get('t') || u.searchParams.get('id')
          || u.pathname.split('/').filter(Boolean).pop() || v;
      } catch { /* mantém valor original */ }
    } else if (v.startsWith('{')) {
      try { const o = JSON.parse(v); v = o.id || o.ticketId || o.t || v; } catch { /* idem */ }
    }
    return v.trim();
  };

  const handleCheckIn = async (input: string) => {
    const ticketId = extractTicketId(input);
    if (!ticketId) return;
    const now = Date.now();
    // Dedup: enquanto uma validação está em andamento (lock) OU o MESMO código foi
    // lido há menos de 3,5s, ignora — assim a leitura contínua (allowMultiple) não
    // dispara o mesmo ingresso várias vezes. Códigos diferentes passam na hora.
    if (checkinBusyRef.current) return;
    if (ticketId === lastScanRef.current.value && now - lastScanRef.current.at < 3500) return;
    lastScanRef.current = { value: ticketId, at: now };
    checkinBusyRef.current = true;
    setCheckInInput('');
    const vibrate = (p: number | number[]) => { if ('vibrate' in navigator) navigator.vibrate(p as any); };
    try {
      // Valida o ingresso REAL no banco (o QR carrega o id do ticket_items).
      // Operador admin/organizador usa o token Supabase; equipe de portaria usa o
      // token de staff emitido em /api/staff/login (guardado no localStorage).
      const token = await getAccessTokenSafe();
      const staffToken = (() => { try { return localStorage.getItem('eventix-staff-token'); } catch { return null; } })();
      const bearer = token || staffToken;
      const resp = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify({ ticketId }),
      });
      // Falhas de autenticação NÃO são "ticket inválido" — antes isso fazia um
      // ingresso válido aparecer como inválido quando a sessão não tinha token.
      if (resp.status === 401) {
        setCheckInResult({ type: 'error', message: 'SESSÃO EXPIRADA — FAÇA LOGIN NOVAMENTE' });
        vibrate([100, 100, 100]);
        return;
      }
      if (resp.status === 403) {
        setCheckInResult({ type: 'error', message: 'SEM PERMISSÃO PARA ESTE EVENTO' });
        vibrate([100, 100, 100]);
        return;
      }
      const d = await resp.json().catch(() => ({} as any));
      const data = { name: (d as any).name, type: (d as any).ticketName };
      switch ((d as any).result) {
        case 'ok':
          setCheckInResult({ type: 'success', message: '✔ PODE ENTRAR!', data });
          setCheckInHistory(prev => [{ id: ticketId, name: data.name || '', type: data.type || '', time: new Date() }, ...prev]);
          vibrate(200);
          break;
        case 'duplicate':
          setCheckInResult({ type: 'error', message: 'DUPLICATA - CHECK-IN JÁ REALIZADO', data });
          vibrate([300, 100, 300]);
          break;
        case 'unpaid':
          setCheckInResult({ type: 'warning', message: 'PAGAMENTO PENDENTE - NÃO AUTORIZADO', data });
          vibrate([200, 100, 200]);
          break;
        case 'forbidden':
          setCheckInResult({ type: 'error', message: 'SEM PERMISSÃO PARA CHECK-IN' });
          vibrate([100, 100, 100]);
          break;
        case 'error':
          setCheckInResult({ type: 'error', message: 'ERRO AO VALIDAR — TENTE NOVAMENTE' });
          vibrate([100, 100, 100]);
          break;
        default:
          setCheckInResult({ type: 'error', message: 'TICKET INVÁLIDO OU NÃO ENCONTRADO' });
          vibrate([100, 100, 100]);
      }
    } catch {
      setCheckInResult({ type: 'error', message: 'ERRO DE CONEXÃO AO VALIDAR INGRESSO' });
      vibrate([100, 100, 100]);
    } finally {
      checkinBusyRef.current = false;
      setTimeout(() => setCheckInResult(null), 3000);
    }
  };

  const handleUndoCheckIn = (id: string) => {
    setCheckInHistory(prev => prev.filter(h => h.id !== id));
    showToast('Check-in removido do histórico local.', 'info');
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
    setScannerConstraints({ facingMode: { ideal: 'environment' } });
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

  // ─── Confirmação de pagamento (PIX/cartão pendente) ───────────────────────
  // O banco é a fonte da verdade: o frontend NUNCA marca uma compra como paga
  // sozinho — ele consulta /api/payment/status até o webhook (ou o ?refresh=1,
  // que re-consulta o MP) confirmar a aprovação.

  const paymentPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPaymentRef = useRef<{ reservationId: string; dbTickets: any[]; method: PaymentMethod } | null>(null);

  const stopPaymentPolling = () => {
    if (paymentPollTimerRef.current) {
      clearInterval(paymentPollTimerRef.current);
      paymentPollTimerRef.current = null;
    }
  };

  const fetchPaymentStatus = async (reservationId: string, refresh: boolean): Promise<string | null> => {
    try {
      const token = await getAccessTokenSafe();
      const resp = await fetch(`/api/payment/status/${reservationId}${refresh ? '?refresh=1' : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => ({} as any));
      return typeof data.paymentStatus === 'string' ? data.paymentStatus : null;
    } catch {
      return null;
    }
  };

  // Constrói a reserva local com os ingressos REAIS do banco e mostra o sucesso.
  // Só é chamada quando o pagamento está 'approved' no banco.
  const finalizePaidReservation = (resId: string, dbTickets: any[] = [], method?: PaymentMethod | null) => {
    const buyer = {
      name: guestData.name || sessionUser?.name || '',
      email: guestData.email || sessionUser?.email || '',
      cpf: guestData.cpf || '',
    };
    const generatedTickets: TicketItem[] = [];
    const getOwnerData = (isFirst: boolean) => {
      if (identificationOption === 'same_as_buyer') return { ownerName: buyer.name, ownerCpf: buyer.cpf, ownerEmail: buyer.email };
      if (isFirst) return { ownerName: buyer.name, ownerCpf: buyer.cpf, ownerEmail: buyer.email };
      return { ownerName: '', ownerCpf: '', ownerEmail: '' };
    };
    // Usa SOMENTE o id real do ticket no banco (o QR Code precisa casar no
    // check-in). Sem id real, a UI não renderiza QR — o ingresso fica em
    // "Minhas Reservas"/e-mail, que recarregam do banco.
    const ticketIdAt = (idx: number) => dbTickets[idx]?.id ?? '';
    let tIndex = 0;
    selectedTables.forEach((tableId) => {
      const tbl = derivedTables.find(t => t.id === tableId);
      const seats = tbl?.capacity ?? 4;
      for (let i = 0; i < seats; i++) {
        generatedTickets.push({
          id: ticketIdAt(tIndex),
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
        id: ticketIdAt(tIndex),
        name: `Ingresso Individual`,
        isTable: false,
        status: 'active',
        ...getOwnerData(tIndex === 0),
      });
      tIndex++;
    }
    const newRes: Reservation = {
      id: resId,
      date: new Date().toISOString(),
      tables: [...selectedTables],
      singleTickets,
      ticketsObj: generatedTickets,
      total: grandTotal,
      eventId: activeEvent?.id ?? 1,
      buyerName: buyer.name,
      paymentStatus: 'approved',
      paymentMethod: method || 'credit_card',
      platformFee: taxAmount,
      netAmount: subTotal,
      createdAt: new Date().toISOString(),
    };
    setReservations(prev => [newRes, ...prev.filter(r => r.id !== resId)]);
    setPaymentStatus('success');
    setIsProcessingPayment(false);
    setCartExpiresAt(null);
    setSelectedTables([]);
    setSingleTickets(0);
    setMaleTickets(0);
    setFemaleTickets(0);
  };

  const startPaymentPolling = (reservationId: string, dbTickets: any[], method: PaymentMethod) => {
    stopPaymentPolling();
    pendingPaymentRef.current = { reservationId, dbTickets, method };
    const startedAt = Date.now();
    let tick = 0;
    let busy = false;
    paymentPollTimerRef.current = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        tick++;
        const info = pendingPaymentRef.current;
        if (!info) { stopPaymentPolling(); return; }
        // A cada 5ª checagem pede ?refresh=1 (re-consulta o MP no servidor) —
        // rede de segurança caso o webhook não esteja chegando.
        const status = await fetchPaymentStatus(info.reservationId, tick % 5 === 0);
        if (!pendingPaymentRef.current) return;
        if (status === 'approved') {
          stopPaymentPolling();
          pendingPaymentRef.current = null;
          finalizePaidReservation(info.reservationId, info.dbTickets, info.method);
          showToast('Pagamento confirmado! Seus ingressos foram liberados.', 'success');
        } else if (status === 'cancelled' || status === 'refunded') {
          stopPaymentPolling();
          pendingPaymentRef.current = null;
          setErrors({ payment: 'O pagamento foi recusado ou cancelado.' });
          setPaymentStatus('error');
          setIsProcessingPayment(false);
        } else if (Date.now() - startedAt > 31 * 60 * 1000) {
          // O PIX expira em 30 minutos — encerra o acompanhamento.
          stopPaymentPolling();
          pendingPaymentRef.current = null;
          setErrors({ payment: 'Não identificamos o pagamento. Se você já pagou, confira em "Minhas Reservas" ou contate o suporte.' });
          setPaymentStatus('error');
          setIsProcessingPayment(false);
        }
      } finally {
        busy = false;
      }
    }, 5000);
  };

  // Botão "Já realizei o pagamento": força uma verificação real no MP agora.
  const verifyPaymentNow = async (): Promise<boolean> => {
    const info = pendingPaymentRef.current;
    if (!info) return false;
    const status = await fetchPaymentStatus(info.reservationId, true);
    if (status === 'approved' && pendingPaymentRef.current) {
      stopPaymentPolling();
      pendingPaymentRef.current = null;
      finalizePaidReservation(info.reservationId, info.dbTickets, info.method);
      return true;
    }
    return false;
  };

  useEffect(() => () => stopPaymentPolling(), []);

  const handleConfirmReservation = async (cardData?: CardData, selectedPaymentMethod?: PaymentMethod | null) => {
    if (isProcessingPayment) return;
    if (!role) {
      const errs = validateGuestDataUtil(guestData);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    }
    // Cancelar qualquer requisição de pagamento anterior pendente
    if (paymentAbortRef.current) paymentAbortRef.current.abort();
    paymentAbortRef.current = new AbortController();
    const { signal } = paymentAbortRef.current;

    setIsProcessingPayment(true);
    setPaymentStatus('processing');
    setPixData(null);

    // Dados do comprador: convidado usa o formulário; logado usa o próprio
    // perfil (sessionUser) como fallback — senão o servidor recusa a reserva
    // por "nome e e-mail obrigatórios".
    const buyer = {
      name: guestData.name || sessionUser?.name || '',
      email: guestData.email || sessionUser?.email || '',
      cpf: guestData.cpf || '',
    };

    try {
      // getAccessTokenSafe evita o travamento do getSession() (lock preso),
      // que fazia o checkout girar para sempre sem nunca chamar a API.
      const token = await getAccessTokenSafe();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Seleção enviada ao servidor para recálculo autoritativo do preço (anti-fraude).
      // O servidor ignora `amount` e recalcula a partir dos preços do banco.
      const selection = {
        eventId: activeEvent?.id,
        tables: selectedTables,
        singleTickets,
        maleTickets,
        femaleTickets,
        sectorId: expandedSectorId,
      };

      // Persiste a reserva como 'pending' no banco ANTES de cobrar (fonte da verdade).
      // O trigger de RLS força payment_status='pending'; o webhook/servidor confirmam
      // o pagamento depois. O id retornado vai como external_reference ao Mercado Pago.
      const buildDbTicketItems = (): any[] => {
        const items: any[] = [];
        const ownerFor = (isFirst: boolean) =>
          (identificationOption === 'same_as_buyer' || isFirst)
            ? { owner_name: buyer.name, owner_cpf: buyer.cpf, owner_email: buyer.email }
            : { owner_name: '', owner_cpf: '', owner_email: '' };
        let idx = 0;
        selectedTables.forEach((tableId) => {
          const tbl = derivedTables.find(t => t.id === tableId);
          const seats = tbl?.capacity ?? 4;
          for (let i = 0; i < seats; i++) {
            items.push({
              reservation_id: '', event_id: activeEvent?.id ?? 0,
              name: `Mesa #${tableId} — Assento ${i + 1}`,
              is_table: true, table_number: tableId, occupant_index: i,
              status: 'active', ...ownerFor(idx === 0),
            });
            idx++;
          }
        });
        const ticketCount = singleTickets + maleTickets + femaleTickets;
        for (let i = 0; i < ticketCount; i++) {
          items.push({
            reservation_id: '', event_id: activeEvent?.id ?? 0,
            name: 'Ingresso Individual', is_table: false,
            status: 'active', ...ownerFor(idx === 0),
          });
          idx++;
        }
        return items;
      };

      let dbReservationId: string;
      let dbTicketItems: any[] = [];
      try {
        const created = await createReservationInDb({
          event_id: activeEvent?.id ?? 0,
          user_id: sessionUser?.id,
          buyer_name: buyer.name,
          buyer_email: buyer.email,
          buyer_cpf: buyer.cpf,
          tables: selectedTables,
          single_tickets: singleTickets,
          male_tickets: maleTickets,
          female_tickets: femaleTickets,
          total: grandTotal,
          platform_fee: taxAmount,
          net_amount: subTotal,
          payment_status: 'pending',
          payment_method: (selectedPaymentMethod ?? undefined) as any,
          // Usado pelo servidor para recalcular o preço de ingressos por setor.
          sector_id: expandedSectorId ?? undefined,
        } as any, buildDbTicketItems());
        dbReservationId = created.id;
        dbTicketItems = (created as any).ticket_items ?? [];
      } catch (e: any) {
        console.error('[Reserva] Falha ao registrar reserva:', e?.message);
        throw new Error('Não foi possível registrar a reserva. Tente novamente.');
      }

      if (selectedPaymentMethod === 'pix') {
        const res = await fetch('/api/payment/pix', {
          method: 'POST',
          signal,
          headers: authHeaders,
          body: JSON.stringify({ amount: grandTotal, description: activeEvent?.title || 'Ingresso', guestData: buyer, selection, reservationId: dbReservationId }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data.error || `Erro ao gerar PIX (HTTP ${res.status})`);
        setPixData({ qrCode: data.qrCodeUrl, copyPaste: data.qrCode });
        setCheckoutStep('processing');
        // Mostra o QR e acompanha o status no banco até o webhook (ou o
        // ?refresh=1) confirmar — só então a compra vira "sucesso".
        setIsProcessingPayment(false);
        startPaymentPolling(dbReservationId, dbTicketItems, 'pix');
      } else {
        if (!cardData) throw new Error('Dados do cartão não informados');
        const cardBrand = detectCardBrand(cardData.number);
        const cardToken = await tokenizeCard({ ...cardData, holderCpf: cardData.holderCpf || buyer.cpf });
        if (!cardToken) throw new Error('Falha ao tokenizar cartão. Verifique os dados e tente novamente.');
        const paymentFetch = fetch('/api/payment/mercadopago', {
          method: 'POST',
          signal,
          headers: authHeaders,
          body: JSON.stringify({
            cardToken,
            cardBrand,
            amount: grandTotal,
            description: activeEvent?.title || 'Ingresso',
            paymentMethod: selectedPaymentMethod,
            installments: cardData.installments,
            guestData: buyer,
            selection,
            reservationId: dbReservationId,
          }),
        });
        const paymentTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Servidor não respondeu em 30 segundos. Verifique a conexão.')), 30000)
        );
        const res = await Promise.race([paymentFetch, paymentTimeout]);
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data.error || `Erro ao processar pagamento (HTTP ${res.status})`);

        if (data.status === 'approved') {
          // O e-mail de confirmação é enviado pelo SERVIDOR (rota de pagamento
          // e webhook), com os dados do banco — nada parte do cliente.
          finalizePaidReservation(dbReservationId, dbTicketItems, selectedPaymentMethod);
        } else if (data.status === 'in_process' || data.status === 'pending') {
          // Pagamento em análise: NÃO libera ingressos — acompanha o status
          // até o MP decidir (webhook ou re-consulta).
          setPaymentStatus('in_review');
          setIsProcessingPayment(false);
          startPaymentPolling(dbReservationId, dbTicketItems, selectedPaymentMethod ?? 'credit_card');
        } else if (data.status === 'rejected') {
          throw new Error(`Pagamento recusado: ${data.statusDetail || 'tente outro cartão'}`);
        } else {
          setPaymentStatus('idle');
          setIsProcessingPayment(false);
          setErrors({ payment: `Status inesperado: ${data.status ?? 'desconhecido'}` });
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[Payment] Requisição cancelada');
        setPaymentStatus('idle');
        setIsProcessingPayment(false);
        return;
      }
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
    dashboardMode, setDashboardMode,
    isPreviewingEvent, setIsPreviewingEvent,
    selectedDashboardEvent, setSelectedDashboardEvent,
    userRole, setUserRole,
    sessionUser, setSessionUser,
    isApprovedEventCreator, setIsApprovedEventCreator,
    isStaff, setIsStaff,
    staffEventIds, setStaffEventIds,
    loggedInUserId, setLoggedInUserId,
    authIntent, setAuthIntent,
    can, role, isAtLeast,
    events, setEvents,
    loadingEvents,
    loadingBatches,
    formEvent, setFormEvent,
    releaseValidationFields, setReleaseValidationFields,
    staffAccounts, setStaffAccounts,
    registeredUsersCount,
    showOnboarding, setShowOnboarding,
    newStaff, setNewStaff,
    systemLogs, clearSystemLogs,
    buyers, setBuyers,
    reservations, setReservations,
    selectedBuyerForDetails, setSelectedBuyerForDetails,
    isCheckoutOpen, setIsCheckoutOpen,
    checkoutStep, setCheckoutStep,
    paymentMethod, setPaymentMethod,
    paymentStatus, setPaymentStatus,
    verifyPaymentNow,
    dataLoadError, retryDataLoad,
    pixData, setPixData,
    isProcessingPayment,
    guestData, setGuestData,
    identificationOption, setIdentificationOption,
    adminForm, setAdminForm,
    registerForm, setRegisterForm,
    registerStep, setRegisterStep,
    verificationCode, setVerificationCode,
    verifyTicket,
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
    isAdminSidebarCollapsed, setIsAdminSidebarCollapsed,
    isUserDropdownOpen, setIsUserDropdownOpen,
    userDropdownRef,
    isStaffModalOpen, setIsStaffModalOpen,
    isTableLayoutEditorOpen, setIsTableLayoutEditorOpen,
    isMessageModalOpen, setIsMessageModalOpen,
    isLogsModalOpen, setIsLogsModalOpen,
    pendingApprovalsCount,
    messageText, setMessageText,
    showDefaultCredentialsWarning, setShowDefaultCredentialsWarning,
    actionTicket, setActionTicket,
    actionError, setActionError,
    errors, setErrors,
    sessionRestored, setSessionRestored, sessionConflict, setSessionConflict,
    checkInInput, setCheckInInput,
    checkInSearch, setCheckInSearch,
    checkInSearchInput, setCheckInSearchInput,
    checkInFilter, setCheckInFilter,
    checkInResult,
    checkinTab, setCheckinTab,
    checkInHistory,
    scannerKey, setScannerKey,
    scannerConstraints, setScannerConstraints,
    scannerError, setScannerError,
    resetScanner,
    expandedRes, setExpandedRes,
    reservationsTab, setReservationsTab,
    copiedCod, setCopiedCod,
    qrFullscreen, setQrFullscreen,
    salesChartPeriod, setSalesChartPeriod,
    consoleDisplayCount, setConsoleDisplayCount,
    consoleSearchInput, setConsoleSearchInput,
    consoleSearch, setConsoleSearch,
    consoleFilter, setConsoleFilter,
    consoleFilterOpen, setConsoleFilterOpen,
    developerConfig, setDeveloperConfig,
    actionToast, showToast,
    adminScrollRef, imageFileInputRef,
    isAdminLayout,
    activeEvent,
    derivedTables,
    grandTotal, subTotal, taxAmount, tablesTotal, ticketsTotal,
    totalTicketsSelected,
    previewSectors, expandedSector,
    showToastFn: showToast,
    handleAdminLogin, handleLogout, handleRegister, handleVerifyCode, handleResendCode, handleCheckoutVerifyAndRegister,
    handleEditEvent, handleCreateEvent, handleSaveEvent, handleUpdateEventStatus, handleImageFileChange,
    handleAddStaff, handleDeleteStaff, handleEditStaff, handleStaffLogin, handleCheckIn, handleUndoCheckIn, handleScannerError,
    toggleTableSelection, getTableStatus, handleCheckout, handleConfirmReservation, handleCreateReservation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
