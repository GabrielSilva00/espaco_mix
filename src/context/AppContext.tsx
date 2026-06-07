import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  supabase,
  signIn, signOut, signUp, getMyProfile, resolveUsernameToEmail,
  getEvents, getEventBatches, saveEvent as saveEventToDb, createEvent, deleteEvent, uploadEventImage,
  createReservation as createReservationInDb, getMyReservations, getEventReservations,
  getStaffAccounts, createStaffAccount,
  getSystemConfig, updateSystemConfig,
  getPendingApplications, approveProducer, rejectProducer,
  subscribeToEvents, subscribeToEventReservations, subscribeToPendingApplications,
  subscribeToProfile,
  type Profile,
} from '../lib/supabase';
import { UserRole, usePermissions } from '../hooks/usePermissions';
import { mapDbEventToApp, mapAppEventToDb } from '../shared/utils/eventMapper';
import { validateGuestData as validateGuestDataUtil } from '../shared/utils/validators';
import { type CardData, tokenizeCard, detectCardBrand } from '../lib/cardUtils';
import { mockTables, MOCK_BUYERS, EVENT_TICKET_PRICE, CART_EXPIRATION_MS } from '../shared/constants/app';
import type {
  Event, Buyer, Reservation, StaffAccount, SessionUser, SiteConfig,
  TableDef, TableStatus, TicketItem, Sector, GuestData, PixData,
  CurrentView, DashboardMode, CheckoutStep, PaymentMethod, Toast, ToastType,
  ConsentData,
} from '../types';
import { loadDeveloperConfig, saveDeveloperConfig } from '../services/developerConfig';
import type { DeveloperConfig } from '../types/developer';
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
  formEvent: Event | null;
  setFormEvent: React.Dispatch<React.SetStateAction<Event | null>>;
  releaseValidationFields: string[];
  setReleaseValidationFields: React.Dispatch<React.SetStateAction<string[]>>;

  // Staff
  staffAccounts: StaffAccount[];
  setStaffAccounts: React.Dispatch<React.SetStateAction<StaffAccount[]>>;
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
  registerForm: { name: string; email: string; cpf: string; phone: string; phoneCountry: string; birthDate: string; sex: string; password: string; confirmPassword: string; nationality: string; country: string; passportDoc: string };
  setRegisterForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; cpf: string; phone: string; phoneCountry: string; birthDate: string; sex: string; password: string; confirmPassword: string; nationality: string; country: string; passportDoc: string }>>;
  registerStep: number;
  setRegisterStep: React.Dispatch<React.SetStateAction<number>>;
  verificationCode: string[];
  setVerificationCode: React.Dispatch<React.SetStateAction<string[]>>;
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
  checkInResult: { type: 'success' | 'error' | 'warning'; message: string; data?: Buyer } | null;
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
  handleEditEvent: (evt: Event) => Promise<void>;
  handleCreateEvent: () => void;
  handleSaveEvent: (isDraft?: boolean) => Promise<void>;
  handleUpdateEventStatus: (eventId: number, newStatus: Event['status']) => Promise<void>;
  handleImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddStaff: (e: React.FormEvent) => void;
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
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('list');
  const [isPreviewingEvent, setIsPreviewingEvent] = useState(false);
  const [selectedDashboardEvent, setSelectedDashboardEvent] = useState<number | null>(null);

  // Auth
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isApprovedEventCreator, setIsApprovedEventCreator] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<'buy' | 'create_event'>('buy');

  // Permissions
  const { can, role, isAtLeast } = usePermissions(userRole, { isApprovedEventCreator });

  // Events
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [formEvent, setFormEvent] = useState<Event | null>(null);
  const [releaseValidationFields, setReleaseValidationFields] = useState<string[]>([]);

  // Staff
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', username: '', password: '' });

  // System logs
  const [systemLogs, setSystemLogs] = useState<{ id: string; level: 'error' | 'warn' | 'info'; message: string; time: Date }[]>([]);
  const clearSystemLogs = () => setSystemLogs([]);

  // Buyers / reservations
  const [buyers, setBuyers] = useState<Buyer[]>(import.meta.env.DEV ? MOCK_BUYERS : []);
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
  const [checkInResult, setCheckInResult] = useState<{ type: 'success' | 'error' | 'warning'; message: string; data?: Buyer } | null>(null);
  const [checkinTab, setCheckinTab] = useState<'scanner' | 'list'>('scanner');
  const [checkInHistory, setCheckInHistory] = useState<{ id: string; name: string; type: string; time: Date }[]>([]);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannerConstraints, setScannerConstraints] = useState<MediaTrackConstraints>({ facingMode: { ideal: 'environment' } });
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRetryRef = useRef(0);

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

  const isAdminLayout = (userRole === 'admin' || userRole === 'developer') && !isPreviewingEvent;

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Gerencia sessão do Supabase: admin/developer jamais são auto-logados ao abrir a página
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          try {
            const profile = await getMyProfile();
            // Admin e developer nunca são restaurados automaticamente — devem fazer login manual
            if (profile?.role === 'admin' || profile?.role === 'developer') {
              // NÃO chamar signOut() — dispara SIGNED_OUT e reinicia o loop de 429
              try {
                ['eventix-auth-v2', 'eventix-auth'].forEach(k => localStorage.removeItem(k));
                Object.keys(localStorage)
                  .filter(k => k.startsWith('sb-'))
                  .forEach(k => localStorage.removeItem(k));
              } catch {}
              if (!sessionStorage.getItem('auth-cleared')) {
                sessionStorage.setItem('auth-cleared', '1');
                window.location.reload();
              }
              return;
            }
            // Clientes comuns têm sessão restaurada normalmente
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
              console.error('[Context] Sessão corrompida por erro de RLS — recarregando');
              if (!sessionStorage.getItem('rls-reload')) {
                sessionStorage.setItem('rls-reload', '1');
                setTimeout(() => window.location.reload(), 300);
              }
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
    if (!ev || (ev.batches?.length ?? 0) > 0) return;
    let cancelled = false;
    getEventBatches(ev.id)
      .then(rawBatches => {
        if (cancelled) return;
        const mapped = mapDbEventToApp({ batches: rawBatches });
        setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, batches: mapped.batches } : e));
        setFormEvent(prev => prev && prev.id === ev.id ? { ...prev, batches: mapped.batches } : prev);
      })
      .catch(e => console.error('[Context] Erro ao carregar lotes do evento:', (e as Error)?.message));
    return () => { cancelled = true; };
  }, [currentView, activeEvent?.id]);

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') { setPendingApprovalsCount(0); return; }
    getPendingApplications().then(apps => setPendingApprovalsCount(apps.length)).catch(e => console.error('[Context] Erro ao buscar aprovações:', (e as Error)?.message));
    const unsubscribe = subscribeToPendingApplications(setPendingApprovalsCount);
    return () => { unsubscribe(); };
  }, [userRole]);

  useEffect(() => {
    getSystemConfig()
      .then(cfg => setSiteConfig(prev => ({ ...prev, venueMaxCapacity: cfg.venue_max_capacity ?? null, platformName: cfg.site_name ?? prev.platformName })))
      .catch(e => console.error('[Context] Erro ao carregar config:', (e as Error)?.message));
  }, []);

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
    if (paymentStatus === 'processing' || paymentStatus === 'success') return;
    if (selectedTables.length === 0 && singleTickets === 0) {
      sessionStorage.removeItem('eventix-cart');
      return;
    }
    const { cpf: _cpf, ...guestDataSafe } = guestData;
    sessionStorage.setItem('eventix-cart', JSON.stringify({ selectedTables, singleTickets, guestData: guestDataSafe }));
  }, [selectedTables, singleTickets, guestData, paymentStatus]);

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') return;
    getStaffAccounts().then(data => setStaffAccounts(data)).catch(e => console.error('[Context] Erro ao carregar staff:', (e as Error)?.message));
  }, [userRole]);

  // ─── Reset de estados transientes ────────────────────────────────────────

  const resetAllTransientState = () => {
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
    try {
      await signOut();
    } catch (e) {
      console.warn('[Auth] signOut error (ignorado):', e);
    }
    setUserRole(null);
    setLoggedInUserId(null);
    setIsStaff(false);
    setIsApprovedEventCreator(false);
    setSessionUser(null);
    setCurrentView('home');
    setDashboardMode('list');
    // Limpeza completa das chaves de sessão (evita token inválido travando o reload)
    try {
      ['eventix-session', 'eventix-auth', 'eventix-auth-v2'].forEach(k => localStorage.removeItem(k));
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('auth-cleared');
    } catch {}
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
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          setAdminError((data as any).error ?? 'Erro ao enviar código. Tente novamente.');
          return;
        }
        setVerificationStep(true);
      } catch {
        setAdminError('Erro de conexão. Verifique sua internet.');
      }
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length < 6) { setAdminError('Preencha o código completo (6 dígitos)'); return; }
    setAdminError('');
    try {
      const checkResp = await fetch('/api/auth/check-verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.email, code }),
      });
      const checkData = await checkResp.json().catch(() => ({}));
      if (!checkResp.ok || !(checkData as any).valid) {
        setAdminError((checkData as any).error ?? 'Código inválido.');
        return;
      }
      await signUp(registerForm.email, registerForm.password, registerForm.name, {
        phone: registerForm.phone.replace(/\D/g, ''),
        cpf: registerForm.nationality === 'br' ? registerForm.cpf.replace(/\D/g, '') : undefined,
        birth_date: registerForm.birthDate,
        sex: registerForm.sex,
        nationality: registerForm.nationality,
        country: registerForm.nationality === 'foreign' ? registerForm.country : undefined,
        passport_doc: registerForm.nationality === 'foreign' ? registerForm.passportDoc : undefined,
      } as any);
      setVerificationStep(false);
      setRegisterForm({ name: '', email: '', cpf: '', phone: '', phoneCountry: '+55', birthDate: '', sex: '', password: '', confirmPassword: '', nationality: 'br', country: '', passportDoc: '' });
      setVerificationCode(['', '', '', '', '', '']);
      setAdminForm({ username: '', password: '' });
      setRegisterStep(1);
      showToast('Cadastro concluído! Faça login para continuar.', 'success');
      setAuthTab('login');
    } catch (err: any) {
      setAdminError(err.message ?? 'Erro ao criar conta');
    }
  };

  const handleEditEvent = async (evt: Event) => {
    setFormEvent({ ...evt, batches: [] });
    setSelectedDashboardEvent(evt.id);
    setDashboardMode('edit');
    try {
      const rawBatches = await getEventBatches(evt.id);
      const mapped = mapDbEventToApp({ batches: rawBatches });
      setFormEvent(prev => ({ ...prev, batches: mapped.batches }));
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

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username || !newStaff.password) return;
    const staff: StaffAccount = { id: Math.random().toString(36).substr(2, 9), ...newStaff };
    setStaffAccounts([...staffAccounts, staff]);
    setNewStaff({ name: '', username: '', password: '' });
  };

  const handleCheckIn = async (input: string) => {
    if (!input) return;
    const buyer = buyers.find(b => b.id === input || b.cpf === input);
    setCheckInInput('');
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

    const finalizeSuccess = (resId = `RES-${Date.now()}`) => {
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
        id: resId,
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
            ? { owner_name: guestData.name, owner_cpf: guestData.cpf, owner_email: guestData.email }
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
      try {
        const created = await createReservationInDb({
          event_id: activeEvent?.id ?? 0,
          user_id: sessionUser?.id,
          buyer_name: guestData.name,
          buyer_email: guestData.email,
          buyer_cpf: guestData.cpf,
          tables: selectedTables,
          single_tickets: singleTickets,
          male_tickets: maleTickets,
          female_tickets: femaleTickets,
          total: grandTotal,
          platform_fee: taxAmount,
          net_amount: subTotal,
          payment_status: 'pending',
          payment_method: (selectedPaymentMethod ?? undefined) as any,
        } as any, buildDbTicketItems());
        dbReservationId = created.id;
      } catch (e: any) {
        console.error('[Reserva] Falha ao registrar reserva:', e?.message);
        throw new Error('Não foi possível registrar a reserva. Tente novamente.');
      }

      if (selectedPaymentMethod === 'pix') {
        const res = await fetch('/api/payment/pix', {
          method: 'POST',
          signal,
          headers: authHeaders,
          body: JSON.stringify({ amount: grandTotal, description: activeEvent?.title || 'Ingresso', guestData, selection, reservationId: dbReservationId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX');
        setPixData({ qrCode: data.qrCodeUrl, copyPaste: data.qrCode });
        setCheckoutStep('processing');
        // Mostra QR code; pagamento confirmado via webhook. isProcessingPayment liberado para interação.
        setIsProcessingPayment(false);
      } else {
        if (!cardData) throw new Error('Dados do cartão não informados');
        const cardBrand = detectCardBrand(cardData.number);
        const cardToken = await tokenizeCard({ ...cardData, holderCpf: cardData.holderCpf || guestData.cpf });
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
            guestData,
            selection,
            reservationId: dbReservationId,
          }),
        });
        const paymentTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Servidor não respondeu em 30 segundos. Verifique a conexão.')), 30000)
        );
        const res = await Promise.race([paymentFetch, paymentTimeout]);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento');

        if (data.status === 'approved' || data.status === 'in_process' || data.status === 'pending') {
          finalizeSuccess(dbReservationId);
          fetch('/api/email/send-confirmation', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              buyerName: guestData.name,
              buyerEmail: guestData.email,
              reservationId: dbReservationId,
              eventTitle: activeEvent?.title ?? '',
              eventDate: activeEvent?.date ?? '',
              eventTime: activeEvent?.time ?? '',
              eventLocation: activeEvent?.location ?? '',
              total: grandTotal,
              paymentMethod: selectedPaymentMethod ?? 'credit_card',
            }),
          }).catch(() => {});
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
    loggedInUserId, setLoggedInUserId,
    authIntent, setAuthIntent,
    can, role, isAtLeast,
    events, setEvents,
    loadingEvents,
    formEvent, setFormEvent,
    releaseValidationFields, setReleaseValidationFields,
    staffAccounts, setStaffAccounts,
    newStaff, setNewStaff,
    systemLogs, clearSystemLogs,
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
    handleAdminLogin, handleLogout, handleRegister, handleVerifyCode,
    handleEditEvent, handleCreateEvent, handleSaveEvent, handleUpdateEventStatus, handleImageFileChange,
    handleAddStaff, handleCheckIn, handleUndoCheckIn, handleScannerError,
    toggleTableSelection, getTableStatus, handleCheckout, handleConfirmReservation, handleCreateReservation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
