import React, { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'motion/react'
import { Scanner } from '@yudiel/react-qr-scanner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  supabase,
  signIn, signOut, signUp, getMyProfile,
  getEvents, saveEvent as saveEventToDb, createEvent, deleteEvent, uploadEventImage,
  createReservation as createReservationInDb, getMyReservations, getEventReservations,
  getStaffAccounts, createStaffAccount,
  getSystemConfig, updateSystemConfig,
  getPendingApplications, approveProducer, rejectProducer,
  subscribeToEvents, subscribeToEventReservations, subscribeToPendingApplications,
  type Profile,
} from './lib/supabase';
import { 
  Ticket, 
  MapPin, 
  Calendar, 
  Clock, 
  Check, 
  X,
  CreditCard, 
  Minus, 
  Plus, 
  Users,
  Armchair,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowLeft,
  User,
  QrCode,
  ShieldCheck,
  Download,
  MessageCircle,
  LayoutDashboard,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Eye,
  LogOut,
  Search,
  Filter,
  UserCog,
  Smartphone,
  Mail,
  Phone,
  FileText,
  Receipt,
  Info,
  ScanLine,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  Image as ImageIcon,
  Tag,
  Layers,
  Map as MapIcon,
  PlusCircle,
  Menu,
  AlertCircle,
  Settings,
  Building2,
  Calendar as CalendarIcon,
  TrendingUp,
  StopCircle,
  UploadCloud,
  Link as LinkIcon,
  Square,
  Bell,
  ChevronLeft,
  Copy,
  CalendarDays,
  LifeBuoy,
  AlertTriangle,
  Expand,
  Edit2
} from 'lucide-react';

import { AdminSettings } from './components/AdminSettings';
import { Home } from './components/Home';
import { GoogleIcon } from './components/GoogleIcon';
import { ProducerOnboardingFlow } from './components/ProducerOnboardingFlow';
import { ApprovalQueue } from './components/ApprovalQueue';
import { ProducerDashboard } from './components/ProducerDashboard';
import { TableLayoutEditor, TableLayoutElement } from './components/TableLayoutEditor';
import { UserRole, usePermissions } from './hooks/usePermissions';
import { RoleGuard } from './components/RoleGuard';
import Lenis from 'lenis';

const WHATSAPP_NUMBER = "5511999999999";
const WHATSAPP_MESSAGE = encodeURIComponent("Olá! Gostaria de mais informações sobre o evento.");
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

// Tipos de dados
type TableStatus = 'available' | 'reserved' | 'selected';

interface TableDef {
  id: number;
  capacity: number;
  status: 'available' | 'reserved';
  price: number;
}

interface TicketOwner {
  name: string;
  cpf: string;
  email?: string;
}

interface TicketItem {
  id: string; // QR code identifier
  name: string; // Ticket type/name
  isTable?: boolean;
  tableNumber?: number;
  occupantIndex?: number; // Only for table occupants
  ownerName: string;
  ownerCpf: string;
  ownerEmail?: string;
  status: 'active' | 'transferred' | 'cancelled' | 'pending_transfer';
  pendingTransferEmail?: string;
  originalBuyerId?: string; // ID of the user who bought it
}

interface Reservation {
  id: string;
  date: string;
  tables: number[];
  singleTickets: number;
  ticketsObj?: TicketItem[];
  total: number;
  checkedIn?: boolean;
  eventId?: number;
  buyerName?: string;
  paymentStatus?: 'pending' | 'approved' | 'cancelled' | 'refunded';
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card' | 'boleto';
  platformFee?: number;
  netAmount?: number;
  createdAt?: string;
}


interface StaffAccount {
  id: string;
  name: string;
  username: string;
  password: string;
}

interface ProducerProfile {
  [key: string]: unknown;
}

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isApprovedEventCreator: boolean;
  producerProfile?: ProducerProfile;
}

interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sectors: Sector[];
}

interface Sector {
  id: string;
  name: string;
  quantity: number;
  price: number;
  priceMale?: number;
  priceFemale?: number;
  convenienceFee?: number;
  limitPerUser?: number;
  visibility?: 'public' | 'private' | 'code';
  description?: string;
}

interface TableConfig {
  totalTables: number;
  seatsPerTable: number;
  gridRows: number;
  gridCols: number;
}

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  location: string;
  status: 'Ativo' | 'Em breve' | 'Vendas liberadas' | 'Rascunho' | 'Finalizado' | 'Pausado';
  img: string;
  assignedStaffIds: string[];
  priceType: 'unique' | 'gender';
  batches: Batch[];
  hasTables: boolean;
  tableConfig?: TableConfig;
  tableLayout?: TableLayoutElement[];
  ageRating?: string;
  importantNotes?: string;
  entryRules?: string;
  additionalInfo?: string;
  posLocations?: string;
  category?: string;
  capacity?: number;
  isRecurring?: boolean;
  customUrl?: string;
  refundPolicy?: string;
  socialLinks?: {
    instagram?: string;
    spotify?: string;
  };
}

interface Buyer {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  type: string;
  value: number;
  status: 'Pago' | 'Pendente' | 'Cancelado';
  checkedIn?: boolean;
}

// Dados simulados
const EVENT_TICKET_PRICE = 50;
const mockTables: TableDef[] = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  capacity: 4,
  status: [3, 5, 8, 12, 15, 18].includes(i + 1) ? 'reserved' : 'available',
  price: 300,
}));

const STATUS_TO_DB: Record<Event['status'], string> = {
  'Rascunho':          'draft',
  'Em breve':          'upcoming',
  'Ativo':             'active',
  'Vendas liberadas':  'sales_open',
  'Finalizado':        'ended',
  'Pausado':           'paused',
};

const STATUS_FROM_DB: Record<string, Event['status']> = {
  draft:       'Rascunho',
  upcoming:    'Em breve',
  active:      'Ativo',
  sales_open:  'Vendas liberadas',
  ended:       'Finalizado',
  paused:      'Pausado',
  // compatibilidade: valores em pt já salvos anteriormente
  'Rascunho':          'Rascunho',
  'Em breve':          'Em breve',
  'Ativo':             'Ativo',
  'Vendas liberadas':  'Vendas liberadas',
  'Finalizado':        'Finalizado',
  'Pausado':           'Pausado',
};

function mapDbEventToApp(db: any): Event {
  return {
    id: db.id,
    title: db.title ?? '',
    description: db.description ?? '',
    date: db.date ?? '',
    endDate: db.end_date ?? db.endDate,
    time: db.time,
    endTime: db.end_time ?? db.endTime,
    location: db.location ?? '',
    status: STATUS_FROM_DB[db.status] ?? 'Em breve',
    img: db.img ?? '',
    assignedStaffIds: db.assigned_staff ?? db.assignedStaffIds ?? [],
    priceType: db.price_type ?? db.priceType ?? 'unique',
    batches: (db.batches ?? []).map((b: any) => ({
      id: b.id,
      name: b.name ?? '',
      startDate: b.start_date ?? b.startDate ?? '',
      endDate: b.end_date ?? b.endDate ?? '',
      sectors: (b.sectors ?? []).map((s: any) => ({
        id: s.id,
        name: s.name ?? '',
        quantity: s.quantity ?? 0,
        price: s.price ?? 0,
        priceMale: s.price_male ?? s.priceMale,
        priceFemale: s.price_female ?? s.priceFemale,
        convenienceFee: s.convenience_fee ?? s.convenienceFee,
        limitPerUser: s.limit_per_user ?? s.limitPerUser,
        visibility: s.visibility ?? 'public',
        description: s.description,
      })),
    })),
    hasTables: db.has_tables ?? db.hasTables ?? false,
    tableConfig: (db.has_tables ?? db.hasTables) && (db.table_total || db.tableConfig) ? {
      totalTables: db.table_total ?? db.tableConfig?.totalTables ?? 0,
      seatsPerTable: db.table_seats ?? db.tableConfig?.seatsPerTable ?? 4,
      gridRows: db.table_rows ?? db.tableConfig?.gridRows ?? 0,
      gridCols: db.table_cols ?? db.tableConfig?.gridCols ?? 0,
    } : undefined,
    tableLayout: db.table_layout ?? db.tableLayout,
    ageRating: db.age_rating ?? db.ageRating,
    importantNotes: db.important_notes ?? db.importantNotes,
    entryRules: db.entry_rules ?? db.entryRules,
    additionalInfo: db.additional_info ?? db.additionalInfo,
    posLocations: db.pos_locations ?? db.posLocations,
    category: db.category,
    capacity: db.capacity,
    isRecurring: db.is_recurring ?? db.isRecurring,
    customUrl: db.custom_url ?? db.customUrl,
    refundPolicy: db.refund_policy ?? db.refundPolicy,
    socialLinks: (db.social_instagram || db.social_spotify || db.socialLinks) ? {
      instagram: db.social_instagram ?? db.socialLinks?.instagram,
      spotify: db.social_spotify ?? db.socialLinks?.spotify,
    } : undefined,
  };
}

function mapAppEventToDb(evt: Event): any {
  return {
    id: evt.id,
    title: evt.title,
    description: evt.description,
    date: evt.date,
    end_date: evt.endDate,
    time: evt.time,
    end_time: evt.endTime,
    location: evt.location,
    status: STATUS_TO_DB[evt.status] ?? evt.status,
    img: evt.img,
    assigned_staff: evt.assignedStaffIds,
    price_type: evt.priceType,
    has_tables: evt.hasTables,
    table_total: evt.tableConfig?.totalTables,
    table_seats: evt.tableConfig?.seatsPerTable,
    table_rows: evt.tableConfig?.gridRows,
    table_cols: evt.tableConfig?.gridCols,
    table_layout: evt.tableLayout,
    age_rating: evt.ageRating,
    important_notes: evt.importantNotes,
    entry_rules: evt.entryRules,
    additional_info: evt.additionalInfo,
    pos_locations: evt.posLocations,
    category: evt.category,
    is_recurring: evt.isRecurring,
    custom_url: evt.customUrl,
    refund_policy: evt.refundPolicy,
    social_instagram: evt.socialLinks?.instagram,
    social_spotify: evt.socialLinks?.spotify,
  };
}

export default function App() {
  const [siteConfig, setSiteConfig] = useState<{ venueMaxCapacity: number | null }>({ venueMaxCapacity: null });
  const [tables, setTables] = useState<TableDef[]>(mockTables);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [singleTickets, setSingleTickets] = useState<number>(0);
  const [maleTickets, setMaleTickets] = useState<number>(0);
  const [femaleTickets, setFemaleTickets] = useState<number>(0);
  const [cartExpiresAt, setCartExpiresAt] = useState<number | null>(null);
  const [cartTimeLeft, setCartTimeLeft] = useState<number | null>(null);
  const [expandedSectorId, setExpandedSectorId] = useState<string | null>(null);

  const MAX_TICKETS_PER_ORDER = 10;
  const CART_EXPIRATION_MS = 10 * 60 * 1000;

  const totalTicketsSelected = singleTickets + maleTickets + femaleTickets;

  useEffect(() => {
    if ((totalTicketsSelected > 0 || selectedTables.length > 0)) {
      if (!cartExpiresAt) {
        setCartExpiresAt(Date.now() + CART_EXPIRATION_MS);
      }
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
  const [bookingType, setBookingType] = useState<'selection' | 'mesa' | 'ingresso'>('selection');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'booking' | 'reservations' | 'contact' | 'admin-login' | 'dashboard' | 'profile'>('home');
  const [isPreviewingEvent, setIsPreviewingEvent] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isApprovedEventCreator, setIsApprovedEventCreator] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const adminScrollRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const { can, role, isAtLeast } = usePermissions(userRole, { isApprovedEventCreator });
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'list' | 'details' | 'staff' | 'check-in' | 'edit' | 'settings' | 'approval-queue' | 'producer-onboarding' | 'producer-dashboard'>('list');
  const [authIntent, setAuthIntent] = useState<'buy' | 'create_event'>('buy');
  const [selectedDashboardEvent, setSelectedDashboardEvent] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([
    { id: '1', name: 'Gabriel Silva', email: 'gab@email.com', cpf: '123.456.789-00', phone: '(11) 98765-4321', type: 'Mesa #12', value: 300, status: 'Pago', checkedIn: false },
    { id: '2', name: 'Ana Oliveira', email: 'ana@email.com', cpf: '234.567.890-11', phone: '(11) 97654-3210', type: '2x Ingressos', value: 100, status: 'Pago', checkedIn: false },
    { id: '3', name: 'Marcos Costa', email: 'marcos@email.com', cpf: '345.678.901-22', phone: '(11) 96543-2109', type: 'Mesa #05', value: 300, status: 'Pendente', checkedIn: false },
    { id: '4', name: 'Juliana Lima', email: 'ju@email.com', cpf: '456.789.012-33', phone: '(11) 95432-1098', type: '1x Ingresso', value: 50, status: 'Cancelado', checkedIn: false },
    { id: '5', name: 'Ricardo Dias', email: 'ric@email.com', cpf: '567.890.123-44', phone: '(11) 94321-0987', type: 'Mesa #18', value: 300, status: 'Pago', checkedIn: false },
  ]);
  const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showLgpdBanner, setShowLgpdBanner] = useState(() => !localStorage.getItem('lgpd-consent'));
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
  const [registerStep, setRegisterStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '']);
  const [verificationStep, setVerificationStep] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'staff'>('login');
  const [totpPending, setTotpPending] = useState(false);
  const [totpInput, setTotpInput] = useState('');
  const [showDefaultCredentialsWarning, setShowDefaultCredentialsWarning] = useState(
    () => localStorage.getItem('eventix-default-admin-warning') === 'true'
  );

  const acceptLgpd = () => {
    localStorage.setItem('lgpd-consent', 'true');
    setLgpdConsent(true);
    setShowLgpdBanner(false);
  };
  const [adminError, setAdminError] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'code' | 'new_password'>('none');
  const [forgotPasswordData, setForgotPasswordData] = useState({ email: '', code: '', newPassword: '' });
  const [checkInInput, setCheckInInput] = useState('');
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInFilter, setCheckInFilter] = useState<'all'|'pendentes'|'check-ins'>('pendentes');
  const [checkInResult, setCheckInResult] = useState<{ type: 'success' | 'error' | 'warning', message: string, data?: Buyer } | null>(null);
  const [checkinTab, setCheckinTab] = useState<'scanner' | 'list'>('scanner');
  const [checkInHistory, setCheckInHistory] = useState<{id: string, name: string, type: string, time: Date}[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', username: '', password: '' });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [reservationsTab, setReservationsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedCod, setCopiedCod] = useState<string | null>(null);
  const [qrFullscreen, setQrFullscreen] = useState<{id: string, name: string} | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [checkoutStep, setCheckoutStep] = useState<'selection' | 'identification' | 'guest-form' | 'login-form' | 'payment-method' | 'processing' | 'success'>('selection');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'debit_card' | 'boleto' | null>(null);
  const [pixData, setPixData] = useState<{ qrCode: string, copyPaste: string } | null>(null);
  const [guestData, setGuestData] = useState({ name: '', email: '', cpf: '' });
  const [identificationOption, setIdentificationOption] = useState<'same_as_buyer' | 'fill_later'>('same_as_buyer');
  const [actionTicket, setActionTicket] = useState<{ id: string | number, reservationId?: string, type: 'edit' | 'transfer' | 'cancel' | 'transfer_table' | 'cancel_table' | 'view', data?: any } | null>(null);
  const [actionError, setActionError] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formEvent, setFormEvent] = useState<Event | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [sessionConflict, setSessionConflict] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isTableLayoutEditorOpen, setIsTableLayoutEditorOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [actionToast, setActionToast] = useState<{message: string, type?: 'success' | 'warning' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    adminScrollRef.current?.scrollTo(0, 0);
  }, [currentView, dashboardMode]);

  const downloadPDFList = () => {
    const csvContent = "data:text/csv;charset=utf-8,Nome,Email,Tipo,Status\n" 
      + buyers.map(b => `${b.name},${b.email},${b.type},${b.checkedIn ? 'Presente' : 'Aguardando'}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lista_participantes_${selectedDashboardEvent}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Download da lista iniciado (CSV)", "success");
  };

  const downloadTicketPDF = (ticket: { id: string; name: string; ownerName?: string }) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket.id)}`;
    win.document.write(`<!DOCTYPE html><html><head><title>Ingresso</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Georgia,serif;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:24px}
      .ticket{background:linear-gradient(135deg,#111,#1a1a1a);border:1px solid #d4af37;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center}
      .brand{color:#d4af37;font-size:10px;letter-spacing:.35em;text-transform:uppercase;margin-bottom:20px}
      .event{color:#d4af37;font-size:22px;margin-bottom:4px}
      .type{color:rgba(255,255,255,.5);font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:24px}
      .qr-wrap{background:#fff;padding:12px;border-radius:12px;display:inline-block;margin-bottom:16px}
      .qr-wrap img{display:block;width:200px;height:200px}
      .tid{font-family:monospace;font-size:9px;color:rgba(255,255,255,.4);letter-spacing:.15em;margin-bottom:20px}
      hr{border:none;border-top:1px solid rgba(212,175,55,.3);margin:20px 0}
      .lbl{font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px}
      .owner{font-size:16px;color:#fff}
      @media print{body{background:#fff}.ticket{background:#fff;color:#000;border-color:#000}.event,.brand{color:#000}.tid,.lbl{color:#666}.owner{color:#000}hr{border-color:#ccc}}
    </style></head><body><div class="ticket">
      <p class="brand">Espaço Mix</p>
      <h1 class="event">Midnight Soirée</h1>
      <p class="type">${ticket.name}</p>
      <div class="qr-wrap"><img src="${qrUrl}" alt="QR"/></div>
      <p class="tid">${ticket.id}</p>
      ${ticket.ownerName ? `<hr><p class="lbl">Portador</p><p class="owner">${ticket.ownerName}</p>` : ''}
    </div><script>window.onload=function(){setTimeout(function(){window.print();window.close();},600);};</script></body></html>`);
    win.document.close();
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setActionToast({message, type});
    setTimeout(() => setActionToast(null), 3500);
  };

  // Lenis Smooth Scroll Initialization
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Only initialize Lenis if the user hasn't requested reduced motion
    if (!prefersReducedMotion) {
      const lenis = new Lenis({
        duration: 1.2, // Control tempo do scroll (mais alto = mais suave)
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Curva de easing premium (outExpo)
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        infinite: false,
      });

      // Integrate with requestAnimationFrame
      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);

      // Clean up on component unmount
      return () => {
        lenis.destroy();
      };
    }
  }, []);

  // Auto finish past events
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let changed = false;
    const updatedEvents = events.map((e: Event) => {
      if (e.date < today && e.status !== 'Finalizado') {
        changed = true;
        return { ...e, status: 'Finalizado' as const };
      }
      return e;
    });
    if (changed) {
      setEvents(updatedEvents);
    }
  }, [events]);

  // Carrega eventos do Supabase ao montar + ouve mudanças em tempo real
  useEffect(() => {
    getEvents()
      .then(data => setEvents(data.map(mapDbEventToApp)))
      .catch(console.error)
      .finally(() => setLoadingEvents(false));

    const unsubscribe = subscribeToEvents(data => setEvents(data.map(mapDbEventToApp)));
    return () => { unsubscribe(); };
  }, []);

  // Conta candidaturas pendentes (admin)
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') {
      setPendingApprovalsCount(0);
      return;
    }

    getPendingApplications()
      .then(apps => setPendingApprovalsCount(apps.length))
      .catch(console.error);

    const unsubscribe = subscribeToPendingApplications(setPendingApprovalsCount);
    return () => { unsubscribe(); };
  }, [userRole]);

  // Carrega configurações do sistema
  useEffect(() => {
    getSystemConfig()
      .then(cfg => setSiteConfig({ venueMaxCapacity: cfg.venue_max_capacity ?? null }))
      .catch(console.error);
  }, []);

  // Session Persistence
  useEffect(() => {
    // Add event listener to suppress benign WebSocket errors in this environment
    const handleError = (e: any) => {
      const errStr = String(e.reason?.message || e.reason || e.message || '');
      const isWSError = errStr.includes('WebSocket') || errStr.includes('websocket');
      if (isWSError) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    
    // Intercept console.error to hide vite websocket errors from showing up in dev overlays
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('[vite] failed to connect to websocket')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const savedSession = localStorage.getItem('eventix-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        let restoredAnything = false;
        let conflictList: string[] = [];
        
        // Restore non-sensitive and relevant states
        if (session.singleTickets) {
          setSingleTickets(session.singleTickets);
          restoredAnything = true;
        }
        if (session.guestData) {
          setGuestData(session.guestData);
          restoredAnything = true;
        }
        if (session.paymentMethod) {
          setPaymentMethod(session.paymentMethod);
          restoredAnything = true;
        }
        
        // Restore checkout flow if it was open
        if (session.isCheckoutOpen) {
          setIsCheckoutOpen(true);
          restoredAnything = true;
          // Only restore safe steps
          if (['selection', 'identification', 'guest-form', 'payment-method'].includes(session.checkoutStep)) {
            setCheckoutStep(session.checkoutStep);
          }
        }

        // Restore selected tables but VALIDATE availability
        if (Array.isArray(session.selectedTables) && session.selectedTables.length > 0) {
          const availableRestored = session.selectedTables.filter((id: number) => {
            const table = tables.find(t => t.id === id);
            const isAvail = table && table.status === 'available';
            if (!isAvail) conflictList.push(`Mesa #${id}`);
            return isAvail;
          });

          if (availableRestored.length > 0) {
            setSelectedTables(availableRestored);
            restoredAnything = true;
          }
          
          if (conflictList.length > 0) {
            setSessionConflict(conflictList);
          }
        }

        if (restoredAnything) {
          setSessionRestored(true);
          setTimeout(() => setSessionRestored(false), 5000);
        }
      } catch (e) {
        console.error("Erro ao restaurar sessão:", e);
      }
    }
  }, []); // Only on mount

  // Auto-save session
  useEffect(() => {
    const session = {
      selectedTables,
      singleTickets,
      maleTickets,
      femaleTickets,
      guestData,
      checkoutStep,
      isCheckoutOpen,
      paymentMethod,
      timestamp: Date.now()
    };
    
    // Don't save if in terminal states
    if (paymentStatus === 'success') {
      localStorage.removeItem('eventix-session');
    } else {
      localStorage.setItem('eventix-session', JSON.stringify(session));
    }
  }, [selectedTables, singleTickets, maleTickets, femaleTickets, guestData, checkoutStep, isCheckoutOpen, paymentMethod, paymentStatus]);

  // Carrega reservas do usuário logado em tempo real (8.7)
  useEffect(() => {
    if (!loggedInUserId) return;

    getMyReservations(loggedInUserId)
      .then(data => setReservations(data as any))
      .catch(console.error);

    const channel = supabase
      .channel(`user-reservations-${loggedInUserId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `user_id=eq.${loggedInUserId}` },
        async () => {
          const res = await getMyReservations(loggedInUserId);
          setReservations(res as any);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loggedInUserId]);

  // Carrega contas de staff para admin (8.8)
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'developer') return;
    getStaffAccounts().then(data => setStaffAccounts(data)).catch(console.error);
  }, [userRole]);

  const validateGuestData = () => {
    const newErrors: { [key: string]: string } = {};
    if (!guestData.name.trim()) newErrors.name = 'Nome obrigatório';
    if (!guestData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = 'E-mail inválido';
    if (!guestData.cpf.match(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/)) newErrors.cpf = 'CPF inválido (11 dígitos)';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep === 1) {
      if (!registerForm.name || !registerForm.email || !registerForm.password) {
        setAdminError('Preencha nome, e-mail e senha para continuar');
        return;
      }
      setAdminError('');
      setRegisterStep(2);
    } else {
      if (!registerForm.phone || !registerForm.cpf || !registerForm.birthDate) {
        setAdminError('Preencha celular, CPF e data de nascimento');
        return;
      }
      setAdminError('');
      setVerificationStep(true);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.join('').length < 4) {
      setAdminError('Preencha o código completo (4 dígitos)');
      return;
    }
    setAdminError('');
    try {
      await signUp(registerForm.email, registerForm.password, registerForm.name, {
        phone: registerForm.phone,
        cpf: registerForm.cpf,
        birth_date: registerForm.birthDate,
      } as any);
      setVerificationStep(false);
      showToast('Cadastro concluído! Verifique seu e-mail e faça login.', 'success');
      setAuthTab('login');
      setRegisterForm({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
      setVerificationCode(['', '', '', '']);
    } catch (err: any) {
      setAdminError(err.message ?? 'Erro ao criar conta');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    try {
      const email = adminForm.username.includes('@')
        ? adminForm.username
        : `${adminForm.username}@espacomix.internal`;

      await signIn(email, adminForm.password);
      const profile: Profile | null = await getMyProfile();

      if (!profile) throw new Error('Perfil não encontrado');

      const role = profile.role as UserRole;
      setUserRole(role);
      setLoggedInUserId(profile.id);
      setIsApprovedEventCreator(profile.is_approved_event_creator);
      setSessionUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: role,
        isApprovedEventCreator: profile.is_approved_event_creator,
      });

      if (role === 'admin' || role === 'developer') {
        setCurrentView('dashboard');
        setDashboardMode('list');
      } else if (profile.is_approved_event_creator) {
        setCurrentView('dashboard');
        setDashboardMode('producer-dashboard');
      } else {
        setCurrentView('booking');
      }
    } catch (err: any) {
      setAdminError(err.message ?? 'Usuário ou senha incorretos');
    }
  };

  const handleLogout = async () => {
    await signOut().catch(console.error);
    setUserRole(null);
    setIsApprovedEventCreator(false);
    setSessionUser(null);
    setIsStaff(false);
    setLoggedInUserId(null);
    setCurrentView('booking');
  };

  const handleEditEvent = (evt: Event) => {
    setFormEvent({ ...evt });
    setSelectedDashboardEvent(evt.id);
    setDashboardMode('edit');
  };

  const handleCreateEvent = () => {
    const newEvt: Event = {
      id: Math.max(0, ...events.map(e => e.id)) + 1,
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      time: '20:00',
      location: '',
      status: 'Rascunho',
      img: '',
      assignedStaffIds: [],
      priceType: 'unique',
      batches: [],
      hasTables: false,
      capacity: siteConfig.venueMaxCapacity ?? 0
    };
    setFormEvent(newEvt);
    setSelectedDashboardEvent(newEvt.id);
    setDashboardMode('edit');
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formEvent) return;
    try {
      showToast('Fazendo upload da imagem...', 'info');
      const url = await uploadEventImage(file, formEvent.id);
      setFormEvent({ ...formEvent, img: url });
      showToast('Imagem atualizada com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro no upload: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleSaveEvent = async (isDraft = false) => {
    if (!formEvent) return;
    if (!formEvent.title || !formEvent.date || !formEvent.location) {
      setErrors({ form: 'Por favor, preencha os campos obrigatórios (Nome, Data, Local).' });
      return;
    }
    try {
      const isNew = !events.some(e => e.id === formEvent.id);
      const statusToSave = isNew ? 'Rascunho' : (isDraft ? 'Rascunho' : formEvent.status);
      const eventToSave = {
        ...mapAppEventToDb({ ...formEvent, status: statusToSave }),
        created_by: loggedInUserId || undefined,
      };
      const saved = await saveEventToDb(eventToSave as any);
      const mappedSaved = mapDbEventToApp(saved);
      setEvents(prev =>
        prev.some(e => e.id === mappedSaved.id)
          ? prev.map(e => e.id === mappedSaved.id ? mappedSaved : e)
          : [...prev, mappedSaved]
      );
      setFormEvent(null);
      setDashboardMode('list');
      showToast(isNew ? 'Rascunho salvo! Acesse o painel do evento para publicar.' : 'Evento atualizado com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar evento: ' + err.message, 'error');
    }
  };

  const handleUpdateEventStatus = async (eventId: number, newStatus: Event['status']) => {
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;
    try {
      const eventToSave = {
        ...mapAppEventToDb({ ...evt, status: newStatus }),
        created_by: loggedInUserId || undefined,
      };
      const saved = await saveEventToDb(eventToSave as any);
      const mappedSaved = mapDbEventToApp(saved);
      setEvents(prev => prev.map(e => e.id === eventId ? mappedSaved : e));
      showToast(`Status alterado para "${newStatus}"`, 'success');
    } catch (err: any) {
      console.error('[handleUpdateEventStatus]', err);
      showToast('Erro ao alterar status: ' + (err?.message || String(err)), 'error');
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username || !newStaff.password) return;
    const staff: StaffAccount = {
      id: Math.random().toString(36).substr(2, 9),
      ...newStaff
    };
    setStaffAccounts([...staffAccounts, staff]);
    setNewStaff({ name: '', username: '', password: '' });
  };

  const handleCheckIn = async (input: string) => {
    try {
      if(!input) return;
      const buyer = buyers.find(b => b.id === input || b.cpf === input);
      setCheckInInput(''); // clear input automatically
      
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
        setCheckInResult({ type: 'error', message: 'DUPLICATA - CHECK-IN JÁ FOI REALIZADO TKT#' + buyer.id.substring(0,6), data: buyer });
        setTimeout(() => setCheckInResult(null), 3000);
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
        return;
      }

      // Success
      setCheckInResult({ type: 'success', message: '✔ PODE ENTRAR!', data: buyer });
      setBuyers(prev => prev.map(b => b.id === buyer.id ? { ...b, checkedIn: true } : b));
      setCheckInHistory(prev => [{id: buyer.id, name: buyer.name, type: buyer.type, time: new Date()}, ...prev]);
      
      if ('vibrate' in navigator) navigator.vibrate(200);
      setTimeout(() => setCheckInResult(null), 2500);

    } catch (error: any) {
      console.error('Erro no check-in:', error);
    }
  };

  const handleUndoCheckIn = (id: string) => {
     setBuyers(prev => prev.map(b => b.id === id ? { ...b, checkedIn: false } : b));
     setCheckInHistory(prev => prev.filter(h => h.id !== id));
     showToast("Check-in desfeito com sucesso.", "info");
  };

  const toggleTableSelection = (tableId: number, status: 'available' | 'reserved') => {
    if (status === 'reserved') return;
    
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    );
  };

  const getTableStatus = (tableId: number, baseStatus: 'available' | 'reserved'): TableStatus => {
    if (baseStatus === 'reserved') return 'reserved';
    if (selectedTables.includes(tableId)) return 'selected';
    return 'available';
  };

  const activeEvent = (currentView === 'booking' && isPreviewingEvent && formEvent)
    ? formEvent
    : (currentView === 'booking' && !isPreviewingEvent
        ? (events.find(e => e.id === Number(selectedDashboardEvent)) || events.find(e => e.status === 'Vendas liberadas') || events.find(e => e.status === 'Ativo') || events.find(e => e.status === 'Em breve') || events[0])
        : (events.find(e => e.id === Number(selectedDashboardEvent)) || events.find(e => e.status === 'Vendas liberadas') || events.find(e => e.status === 'Ativo') || events[0]));

  const activeBatch = activeEvent?.batches?.[0];
  const previewSectors = activeBatch?.sectors || [];
  
  const derivedTables = Array.from({ length: activeEvent?.tableConfig?.totalTables || 20 }).map((_, i) => {
    const existing = tables.find(t => t.id === i + 1);
    return {
      id: i + 1,
      capacity: activeEvent?.tableConfig?.seatsPerTable ?? existing?.capacity ?? 4,
      status: existing?.status || 'available',
      price: existing?.price || 300
    } as TableDef;
  });

  const selectedTablesData = derivedTables.filter(t => selectedTables.includes(t.id));
  const tablesTotal = selectedTablesData.reduce((acc, curr) => acc + curr.price, 0);

  const expandedSector: Partial<Sector> = previewSectors.find(s => s.id === expandedSectorId) || previewSectors[0] || {};
  const ticketsTotal = activeEvent?.priceType === 'gender' 
    ? (maleTickets * (expandedSector.priceMale || 0) + femaleTickets * (expandedSector.priceFemale || 0))
    : (singleTickets * (expandedSector.price || EVENT_TICKET_PRICE));

  const subTotal = tablesTotal + ticketsTotal;
  const taxAmount = subTotal * 0.10;
  const grandTotal = subTotal + taxAmount;

  const handleCheckout = () => {
    if (grandTotal === 0) return;
    setIsCheckoutOpen(true);
    setCheckoutStep('selection');
  };

  const handleConfirmReservation = async () => {
    if (isProcessingPayment) return;
    if (!role && !validateGuestData()) return;

    setIsProcessingPayment(true);
    setPaymentStatus('processing');
    setPixData(null);

    try {
      if (paymentMethod === 'pix') {
        setPixData({
          qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021226850014br.gov.bcb.pix0123yourkeyhere520400005303986540510.005802BR5913EVENTIX_PIX6009SAO_PAULO62070503***6304ABCD',
          copyPaste: '00020101021226850014br.gov.bcb.pix0123yourkeyhere520400005303986540510.005802BR5913EVENTIX_PIX6009SAO_PAULO62070503***6304ABCD'
        });
        setCheckoutStep('processing');
      }

      setTimeout(() => {
        
        const generatedTickets: TicketItem[] = [];
        
        const getOwnerData = (isFirst: boolean) => {
          if (identificationOption === 'same_as_buyer') {
            return {
              ownerName: guestData.name,
              ownerCpf: guestData.cpf,
              ownerEmail: guestData.email
            };
          } else {
            // Fill later
            if (isFirst) {
              return {
                ownerName: guestData.name,
                ownerCpf: guestData.cpf,
                ownerEmail: guestData.email
              };
            }
            return {
              ownerName: '',
              ownerCpf: '',
              ownerEmail: ''
            };
          }
        };

        let tIndex = 0;

        // Generate tickets for tables (capacity occupants)
        if (selectedTables.length > 0) {
          selectedTables.forEach((tableId) => {
            const capacity = 4; // Assuming capacity 4 for mock
            for(let i=0; i<capacity; i++) {
              generatedTickets.push({
                id: `TKT-TBL${tableId}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                name: `Mesa ${tableId} - Ocupante ${i+1}`,
                isTable: true,
                tableNumber: tableId,
                occupantIndex: i,
                status: 'active',
                originalBuyerId: loggedInUserId || undefined,
                ...getOwnerData(tIndex === 0)
              });
              tIndex++;
            }
          });
        }

        if (activeEvent?.priceType === 'gender') {
          for(let i=0; i<maleTickets; i++) {
            generatedTickets.push({ 
              id: 'TKTM-' + Math.random().toString(36).substr(2, 8).toUpperCase(), 
              name: 'Masculino',
              status: 'active',
              originalBuyerId: loggedInUserId || undefined,
              ...getOwnerData(tIndex === 0)
            });
            tIndex++;
          }
          for(let i=0; i<femaleTickets; i++) {
            generatedTickets.push({ 
              id: 'TKTF-' + Math.random().toString(36).substr(2, 8).toUpperCase(), 
              name: 'Feminino',
              status: 'active',
              originalBuyerId: loggedInUserId || undefined,
              ...getOwnerData(tIndex === 0)
            });
            tIndex++;
          }
        } else {
          for(let i=0; i<singleTickets; i++) {
            generatedTickets.push({ 
              id: 'TKT-' + Math.random().toString(36).substr(2, 8).toUpperCase(), 
              name: previewSectors[0]?.name || 'Pista',
              status: 'active',
              originalBuyerId: loggedInUserId || undefined,
              ...getOwnerData(tIndex === 0)
            });
            tIndex++;
          }
        }

        const newRes: Reservation = {
          id: 'RES-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          date: '15 Nov, 2026',
          tables: selectedTables,
          singleTickets,
          ticketsObj: generatedTickets,
          total: grandTotal,
          eventId: 1, // Mocked for now, assuming currently viewed event
          buyerName: guestData.name,
          paymentStatus: 'approved',
          paymentMethod: paymentMethod || 'credit_card',
          platformFee: taxAmount,
          netAmount: subTotal,
          createdAt: new Date().toISOString()
        };
        setReservations([newRes, ...reservations]);
        setPaymentStatus('success');
        setIsProcessingPayment(false);
        setCartExpiresAt(null);
        
        // Reset selection
        setSelectedTables([]);
        setSingleTickets(0);
        setMaleTickets(0);
        setFemaleTickets(0);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setErrors({ payment: err.message || 'Falha na transação de segurança.' });
      setPaymentStatus('idle');
      setIsProcessingPayment(false);
    }
  };

  const handleCreateReservation = async (
    reservationData: Parameters<typeof createReservationInDb>[0],
    ticketItems: Parameters<typeof createReservationInDb>[1]
  ) => {
    try {
      const reservation = await createReservationInDb(reservationData, ticketItems);
      setReservations(prev => [reservation as any, ...prev]);
      return reservation;
    } catch (err) {
      console.error('Erro ao criar reserva:', err);
      throw err;
    }
  };

  const isAdminLayout = userRole === 'admin' && !isPreviewingEvent;

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans selection:bg-[#d4af37]/30 ${isAdminLayout ? 'flex' : ''}`}>
      
      {isAdminLayout ? (
        <>
          {/* Mobile Drawer Overlay */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
              />
            )}
          </AnimatePresence>

          {/* Admin Sidebar */}
          <aside 
            className={`fixed md:relative top-0 left-0 h-screen bg-[#0d0d0d] border-r border-[#ffffff0a] z-50 flex flex-col transition-all duration-300 ${isAdminSidebarCollapsed ? 'w-[80px] md:w-[80px]' : 'w-[280px]'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          >
            {/* Header */}
            <div className={`h-20 flex items-center ${isAdminSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-[#ffffff0a]`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 bg-[#d4af37] rotate-45 flex items-center justify-center shrink-0">
                  <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-base">E</span>
                </div>
                {!isAdminSidebarCollapsed && <span className="text-lg font-display tracking-widest text-[#d4af37] uppercase whitespace-nowrap animate-in fade-in">Espaço Mix</span>}
              </div>
              <button 
                onClick={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)} 
                className={`hidden md:flex text-white/40 hover:text-white transition ${isAdminSidebarCollapsed ? 'absolute right-[-14px] top-6 bg-[#0d0d0d] border border-white/10 rounded-full p-1' : ''}`}
              >
                {isAdminSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/40 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isAdminSidebarCollapsed ? 'py-6 px-3' : 'py-6 px-4'} space-y-8`}>
              
              <div className="mb-4">
                <button 
                  onClick={() => setCurrentView('booking')}
                  className={`w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group border border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/10`}
                  title={isAdminSidebarCollapsed ? "Visualizar Site" : ""}
                >
                  <Eye className={`w-5 h-5 shrink-0 text-[#d4af37]`} />
                  {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Ver Site (Público)</span>}
                </button>
              </div>

              {/* Section: Eventos */}
              <div>
                {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] items-center font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Eventos</h4>}
                <div className="space-y-1">
                  <button 
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('list'); setIsMobileMenuOpen(false); }}
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'list' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    title={isAdminSidebarCollapsed ? "Eventos Ativos" : ""}
                  >
                    <CalendarIcon className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'list' ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Meus Eventos</span>}
                  </button>
                  <button 
                    onClick={() => { setCurrentView('dashboard'); handleCreateEvent(); setIsMobileMenuOpen(false); }}
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    title={isAdminSidebarCollapsed ? "Criar Evento" : ""}
                  >
                    <PlusCircle className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'edit' && !formEvent?.id ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Criar Novo</span>}
                  </button>
                </div>
              </div>

              {/* Section: Operação */}
              <div>
                {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] items-center font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Operação</h4>}
                <div className="space-y-1">
                  {selectedDashboardEvent && (
                    <button 
                      onClick={() => { setCurrentView('dashboard'); setDashboardMode('check-in'); setIsMobileMenuOpen(false); }}
                      className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'check-in' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                      title={isAdminSidebarCollapsed ? "Controle de Acesso / Check-in" : ""}
                    >
                      <ScanLine className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'check-in' ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                      {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Controle de Portaria</span>}
                    </button>
                  )}
                  <button 
                    onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); setIsMobileMenuOpen(false); }}
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    title={isAdminSidebarCollapsed ? "Equipe e Colaboradores" : ""}
                  >
                    <Users className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Equipe (Staff)</span>}
                  </button>
                  {userRole === 'admin' && (
                    <button 
                      onClick={() => { setCurrentView('dashboard'); setDashboardMode('approval-queue'); setIsMobileMenuOpen(false); }}
                      className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'approval-queue' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                      title={isAdminSidebarCollapsed ? "Aprovações KYC" : ""}
                    >
                      <ShieldCheck className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'approval-queue' ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                      {!isAdminSidebarCollapsed && (
                        <span className="text-sm font-medium whitespace-nowrap flex items-center gap-2">
                          Aprovações KYC
                          {pendingApprovalsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-black text-[10px] font-black">
                              {pendingApprovalsCount}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Section: Vendas & Insight (Placeholder) */}
              <div>
                {!isAdminSidebarCollapsed && <h4 className="px-2 text-[10px] items-center font-bold tracking-[0.2em] uppercase text-white/30 mb-3">Gestão</h4>}
                <div className="space-y-1">
                  <button 
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                    title={isAdminSidebarCollapsed ? "Relatórios Financeiros" : ""}
                  >
                    <BarChart3 className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">Relatórios Financeiros</span>}
                  </button>
                  <button 
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                    title={isAdminSidebarCollapsed ? "Integrações" : ""}
                  >
                    <LinkIcon className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">Integrações</span>}
                  </button>
                  <button 
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                    title={isAdminSidebarCollapsed ? "Central de Notificações" : ""}
                  >
                    <Bell className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">Notificações</span>}
                  </button>
                  <button 
                    className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group text-white/40 hover:bg-white/5 cursor-not-allowed`}
                    title={isAdminSidebarCollapsed ? "Suporte" : ""}
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 text-white/20 group-hover:text-white/40" />
                    {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap opacity-60">Suporte ao Produtor</span>}
                  </button>
                </div>
              </div>

            </div>

            {/* Config & Profile Footer */}
            <div className={`border-t border-[#ffffff0a] space-y-2 ${isAdminSidebarCollapsed ? 'p-3' : 'p-4'}`}>
              <button 
                onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); setIsMobileMenuOpen(false); }}
                className={`nav-item w-full flex items-center ${isAdminSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all group ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                title={isAdminSidebarCollapsed ? "Configurações Globais" : ""}
              >
                <Settings className={`w-5 h-5 shrink-0 ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37]' : 'text-white/40 group-hover:text-white'}`} />
                {!isAdminSidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Configurações</span>}
              </button>

              <div className={`mt-2 rounded-xl flex items-center group transition ${isAdminSidebarCollapsed ? 'justify-center' : 'justify-between bg-gradient-to-br from-white/5 to-transparent border border-white/5 p-3'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex flex-col items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-[#d4af37]" />
                  </div>
                  {!isAdminSidebarCollapsed && (
                    <div className="flex flex-col min-w-0">
                      <p className="text-xs font-bold text-white truncate">{userRole === 'admin' ? 'Admin Central' : userRole === 'developer' ? 'Admin / Dev' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}</p>
                      <p className="text-[9px] uppercase tracking-[1px] text-[#d4af37] font-semibold mt-0.5">{userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Produtor'}</p>
                    </div>
                  )}
                </div>
                {!isAdminSidebarCollapsed && (
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition"
                    title="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
              {isAdminSidebarCollapsed && (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center p-3 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </aside>

          {/* Admin Mobile Header */}
          <div className="md:hidden fixed top-0 w-full h-16 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#ffffff0a] z-30 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#d4af37] rotate-45 flex items-center justify-center shrink-0">
                <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-xs">E</span>
              </div>
              <span className="text-sm font-serif tracking-widest text-[#d4af37] uppercase">Espaço Mix Admin</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white/70 hover:text-white transition">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </>
      ) : (
        /* Navbar */
        <nav className="fixed top-0 w-full z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#ffffff0a]">
        <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-[#d4af37] rotate-45 flex items-center justify-center">
              <span className="text-[#0a0a0a] font-bold -rotate-45 leading-none mt-1 text-xs md:text-base">E</span>
            </div>
            <span className="text-base md:text-lg font-serif tracking-widest text-[#d4af37] uppercase">Espaço Mix</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.2em] uppercase opacity-70">
            {!isPreviewingEvent && (
              <>
                <button 
                   onClick={() => setCurrentView('home')} 
                   className={`hover:text-[#d4af37] transition-colors ${currentView === 'home' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}
                 >
                   Início
                 </button>
                {userRole === 'admin' && (
                  <>
                    <button onClick={() => { setCurrentView('dashboard'); setDashboardMode('approval-queue'); }} className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'approval-queue' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}>
                      Aprovações
                      {pendingApprovalsCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#d4af37] text-black text-[9px] font-black">
                          {pendingApprovalsCount}
                        </span>
                      )}
                    </button>
                    <button onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); }} className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}>Colaboradores</button>
                    <button onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); }} className={`hover:text-[#d4af37] transition-colors ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}>Configurações</button>
                  </>
                )}
              </>
            )}
            {role && (
              <button onClick={() => setCurrentView('reservations')} className={`hover:text-[#d4af37] transition-colors ${currentView === 'reservations' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}>Minhas Reservas</button>
            )}
            {!isPreviewingEvent && !isStaff && (
              <button onClick={() => setCurrentView('contact')} className={`hover:text-[#d4af37] transition-colors ${currentView === 'contact' ? 'text-[#d4af37] opacity-100 font-bold' : ''}`}>Contato </button>
            )}
          </div>
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => {
                if (isAtLeast('admin')) {
                  setCurrentView('dashboard');
                  handleCreateEvent();
                } else if (userRole === 'client' && isApprovedEventCreator) {
                  setCurrentView('dashboard');
                  handleCreateEvent();
                } else if (userRole === 'client' && !isApprovedEventCreator) {
                  if ((sessionUser?.producerProfile as Record<string, unknown>)?.status === 'pending') {
                    showToast('Seu cadastro de produtor está em análise. Aguarde a aprovação.', 'info');
                  } else {
                    setCurrentView('dashboard');
                    setDashboardMode('producer-onboarding');
                  }
                } else {
                  setAuthIntent('create_event');
                  setAuthTab('register');
                  setCurrentView('admin-login');
                }
              }}
              className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#d4af37] border border-[#d4af37]/30 px-4 py-2 rounded-lg hover:bg-[#d4af37]/10 transition-colors"
            >
              Criar Evento
            </button>
            {role ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <p className="text-[8px] uppercase tracking-[2px] opacity-30 font-bold leading-none mb-1">{userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Perfil'}</p>
                  <p className="text-[10px] font-bold text-white/80">{userRole === 'developer' ? 'Admin / Dev' : userRole === 'admin' ? 'Admin Central' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500 transition duration-300 hover:text-white"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthIntent('buy');
                  setAuthTab('login');
                  setCurrentView('admin-login');
                }}
                className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#d4af37] border border-[#d4af37] px-4 py-2 rounded-lg hover:bg-[#d4af37] hover:text-[#0a0a0a] transition-colors"
              >
                Entrar
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-[#0d0d0d] border-b border-white/5"
            >
              <div className="flex flex-col p-2 bg-gradient-to-b from-transparent to-[#d4af37]/5">
                {!isPreviewingEvent && (
                  <button 
                    onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }}
                    className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'home' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                  >Início</button>
                )}
                {!isPreviewingEvent && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (isAtLeast('admin')) {
                        setCurrentView('dashboard');
                        handleCreateEvent();
                      } else if (userRole === 'client' && isApprovedEventCreator) {
                        setCurrentView('dashboard');
                        handleCreateEvent();
                      } else if (userRole === 'client' && !isApprovedEventCreator) {
                        if ((sessionUser?.producerProfile as Record<string, unknown>)?.status === 'pending') {
                          showToast('Seu cadastro de produtor está em análise. Aguarde a aprovação.', 'info');
                        } else {
                          setCurrentView('dashboard');
                          setDashboardMode('producer-onboarding');
                        }
                      } else {
                        setAuthIntent('create_event');
                        setAuthTab('register');
                        setCurrentView('admin-login');
                      }
                    }}
                    className="py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 text-[#d4af37] font-bold"
                  >Criar Evento</button>
                )}
                {role && (
                  <button 
                    onClick={() => { setCurrentView('reservations'); setIsMobileMenuOpen(false); }}
                    className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'reservations' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                  >Minhas Reservas</button>
                )}
                {!isPreviewingEvent && !isStaff && (
                  <button 
                    onClick={() => { setCurrentView('contact'); setIsMobileMenuOpen(false); }}
                    className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'contact' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                  >Contato</button>
                )}
                
                {(isStaff || isApprovedEventCreator || isAtLeast('admin')) && !isPreviewingEvent && (
                  <>
                    {userRole === 'admin' && (
                      <>
                        <button 
                          onClick={() => { setCurrentView('dashboard'); setDashboardMode('approval-queue'); setIsMobileMenuOpen(false); }}
                          className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'dashboard' && dashboardMode === 'approval-queue' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                        >
                          Aprovações KYC {pendingApprovalsCount > 0 ? `(${pendingApprovalsCount})` : ''}
                        </button>
                        <button 
                          onClick={() => { setCurrentView('dashboard'); setDashboardMode('staff'); setIsMobileMenuOpen(false); }}
                          className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'dashboard' && dashboardMode === 'staff' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                        >Gerenciar Equipe</button>
                        <button 
                          onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); setIsMobileMenuOpen(false); }}
                          className={`py-4 px-6 text-left text-xs tracking-widest uppercase transition-colors border-b border-white/5 ${currentView === 'dashboard' && dashboardMode === 'settings' ? 'text-[#d4af37] font-bold' : 'text-white/60 hover:text-[#d4af37]'}`}
                        >Configurações</button>
                      </>
                    )}
                  </>
                )}

                <div className="p-6">
                  {role ? (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-[9px] uppercase tracking-[2px] opacity-40 font-bold leading-none mb-1">
                          {userRole === 'admin' ? 'Administrador' : userRole === 'developer' ? 'Desenvolvedor' : isStaff ? 'Colaborador' : 'Perfil'}
                        </p>
                        <p className="text-xs font-bold text-white">{userRole === 'developer' ? 'Admin / Dev' : userRole === 'admin' ? 'Admin Central' : isStaff ? staffAccounts.find(s => s.id === loggedInUserId)?.name || 'Equipe' : users.find(u => u.id === loggedInUserId)?.name || 'Sua Conta'}</p>
                      </div>
                      <button 
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition duration-300"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setCurrentView('admin-login'); setIsMobileMenuOpen(false); }}
                      className="w-full py-4 text-xs font-bold tracking-[0.1em] uppercase text-[#0a0a0a] bg-[#d4af37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:brightness-110 active:scale-95 transition-all"
                    >
                      Entrar na Conta
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      )}

      {/* Main Content Area */}
      <div ref={adminScrollRef} data-lenis-prevent className={`${isAdminLayout ? 'flex-1 h-screen overflow-y-auto custom-scrollbar relative' : 'w-full'} flex flex-col`}>
        <main className={`${isAdminLayout ? 'pt-20 md:pt-10' : 'pt-16 md:pt-20'} pb-24 px-0 md:px-0 flex-1`}>
          {currentView === 'home' && <Home events={events} onEventClick={event => {
            setSelectedDashboardEvent(event.id);
            setCurrentView('booking');
          }} />}
          {isPreviewingEvent && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-500">
            <button 
              onClick={() => {
                // Ensure we return to the correct event if needed
                setCurrentView('dashboard');
                setDashboardMode('edit');
                setIsPreviewingEvent(false);
                // Restore formEvent if it was cleared by saveEvent
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
        {currentView === 'booking' ? (() => {
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
        
        {/* Camadas de Máscara (Overlays) */}
        {/* 1. Gradiente radial suave para focar o centro e escurecer as bordas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(10,10,10,0.5)_100%)] pointer-events-none" />
        
        {/* 2. Gradiente linear do fundo para os textos com transição suave */}
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
                        <Calendar className="w-4 h-4 text-[#d4af37]"/> 
                        {activeEvent?.date ? new Date(activeEvent.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Sáb, 15 Nov, 2026'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#d4af37]"/> 
                        {activeEvent?.time || '22:00'}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#d4af37]"/> 
                        {activeEvent?.location || 'Villa dEste, S.P.'}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </section>

        {/* Main Selection & Booking Area */}
        <div className="max-w-7xl mx-auto px-4 lg:px-10 mt-6 md:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500 mb-24">
          <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12">
            
            {/* Left Column: Events, Tables & Details */}
            <div className="lg:col-span-8 flex flex-col gap-10 md:gap-16">
              
              {/* Aviso de "Em breve" */}
              {activeEvent?.status === 'Em breve' && !isPreviewingEvent && (
                <section className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-7 h-7 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-serif text-blue-300 mb-2">Em breve</h3>
                  <p className="text-sm text-white/50">As vendas ainda não foram abertas. Fique de olho para não perder os ingressos!</p>
                </section>
              )}

              {/* Espaço Avulso & Selection Area */}
              {activeEvent?.batches && activeEvent.batches.length > 0 && (activeEvent?.status === 'Vendas liberadas' || activeEvent?.status === 'Ativo' || isPreviewingEvent) && (
                <section>
                  <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                    <Ticket className="w-5 h-5 text-[#d4af37]" />
                    <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Ingressos</h2>
                  </div>
                  
                  <div className="bg-[#111] border border-white/5 rounded-3xl p-6">
                    <div className="mb-6 flex justify-between items-center bg-[#1a1a1a] p-4 rounded-xl border border-white/10">
                      <div>
                        <h3 className="text-[#d4af37] font-bold text-lg">{activeEvent.batches[0].name}</h3>
                        <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">Lote Atual - Inscrições Abertas</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {previewSectors.map((sector) => {
                        const isExpanded = expandedSectorId === sector.id;
                        const sectorMinPrice = activeEvent.priceType === 'gender' 
                          ? Math.min(sector.priceMale || Infinity, sector.priceFemale || Infinity)
                          : sector.price;
                        
                        // Fake availability logic for UX
                        const mockRemaining = Math.floor(Math.random() * 50) + 1;
                        const isEndingSoon = mockRemaining < 20;

                        return (
                          <div key={sector.id} className={`bg-[#0a0a0a] border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-[#d4af37]/50 shadow-[0_0_20px_rgba(212,175,55,0.05)]' : 'border-white/5 hover:border-white/20 cursor-pointer'}`}>
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
                                 <p className="text-xs text-white/40 line-clamp-1">{isExpanded ? 'Inclui acesso à área selecionada.' : 'Selecione para ver opções'}</p>
                              </div>
                              <div className="text-right flex items-center gap-4 shrink-0">
                                 <div>
                                   <span className="text-[10px] uppercase tracking-widest text-white/50 block mb-0.5">A partir de</span>
                                   <span className="text-lg font-display text-[#d4af37]">R$ {sectorMinPrice !== Infinity ? sectorMinPrice.toFixed(2) : '0.00'}</span>
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
                                        <div className="text-[#d4af37] font-display text-base mt-0.5">R$ {(sector.priceMale || 0).toFixed(2)} <span className="text-[10px] text-white/40 font-sans tracking-widest">+ taxa</span></div>
                                      </div>
                                      <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                        <button onClick={(e) => { e.stopPropagation(); setMaleTickets(Math.max(0, maleTickets - 1)); }} disabled={maleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4"/></button>
                                        <span className="w-5 text-center text-sm font-bold text-white">{maleTickets}</span>
                                        <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setMaleTickets(maleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4"/></button>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-t border-white/5">
                                      <div>
                                        <span className="text-sm font-semibold text-white">Ingresso Feminino</span>
                                        <div className="text-[#d4af37] font-display text-base mt-0.5">R$ {(sector.priceFemale || 0).toFixed(2)} <span className="text-[10px] text-white/40 font-sans tracking-widest">+ taxa</span></div>
                                      </div>
                                      <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                        <button onClick={(e) => { e.stopPropagation(); setFemaleTickets(Math.max(0, femaleTickets - 1)); }} disabled={femaleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4"/></button>
                                        <span className="w-5 text-center text-sm font-bold text-white">{femaleTickets}</span>
                                        <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setFemaleTickets(femaleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4"/></button>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex justify-between items-center py-3">
                                    <div>
                                      <span className="text-sm font-semibold text-white">Ingresso {sector.name}</span>
                                      <div className="text-[#d4af37] font-display text-base mt-0.5">R$ {(sector.price || 0).toFixed(2)} <span className="text-[10px] text-white/40 font-sans tracking-widest">+ taxa</span></div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10">
                                      <button onClick={(e) => { e.stopPropagation(); setSingleTickets(Math.max(0, singleTickets - 1)); }} disabled={singleTickets === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white disabled:opacity-30 disabled:hover:bg-transparent"><Minus className="w-4 h-4"/></button>
                                      <span className="w-5 text-center text-sm font-bold text-white">{singleTickets}</span>
                                      <button onClick={(e) => { e.stopPropagation(); if (totalTicketsSelected >= MAX_TICKETS_PER_ORDER) { showToast(`Limite máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra.`, 'warning'); return; } setSingleTickets(singleTickets + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#d4af37]/20 transition-colors text-[#d4af37]"><Plus className="w-4 h-4"/></button>
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
                </section>
              )}

              {activeEvent?.hasTables && (activeEvent?.status === 'Vendas liberadas' || activeEvent?.status === 'Ativo' || isPreviewingEvent) && (
                <section>
                  <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                    <Armchair className="w-5 h-5 text-[#d4af37]" />
                    <h2 className="text-sm md:text-base tracking-[0.2em] uppercase text-white font-bold">Reserva de Mesas</h2>
                  </div>
                  <div className="space-y-6 flex flex-col p-1 border border-[#ffffff1a] bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] rounded-[1.5rem]">
                  <div className="pt-8 pb-8 pr-8 pl-[17px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-serif text-[#d4af37] mb-2">Mapa do Evento</h2>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest">Grand Ballroom • Selecione sua mesa</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] uppercase opacity-60 tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-[#d4af37]"></div> Livre</div>
                  <div className="flex items-center gap-2"><Lock className="w-3 h-3 text-[#555]"/> Reservada</div>
                </div>
              </div>

              {/* Stage Decor */}
              <div className="relative w-full max-w-3xl mx-auto bg-[#0d0d0d] rounded-2xl border border-[#ffffff0a] flex flex-col text-center">
                <div className="w-full flex-1 flex flex-col items-center justify-center pt-8 pb-6 px-1 md:px-4 min-h-[350px]">
                  <div className="w-[120px] md:w-[200px] h-4 bg-[#d4af37] rounded-b-lg opacity-20 text-[8px] flex items-center justify-center tracking-[1em] uppercase absolute top-0 text-[#0a0a0a] font-bold">
                    Palco
                  </div>

              {/* Grid de Mesas */}
              {(() => {
                const gridCols = activeEvent?.tableConfig?.gridCols || 5;
                const totalTables = derivedTables.length;
                const isVeryDense = totalTables > 40 || gridCols >= 7;
                const isDense = !isVeryDense && (totalTables > 20 || gridCols >= 5);
                
                // Base sizes based on density
                const tableBaseSize = isVeryDense ? 'w-[22px] h-[22px] md:w-9 md:h-9' : isDense ? 'w-7 h-7 md:w-11 md:h-11' : 'w-9 h-9 md:w-14 md:h-14';
                
                // Chairs dimensions
                const chairHBaseSizeX = isVeryDense ? 'w-2 h-1 md:w-3 md:h-1.5' : isDense ? 'w-[10px] h-1 md:w-4 md:h-2' : 'w-3 h-1.5 md:w-5 md:h-2.5';
                const chairVBaseSizeY = isVeryDense ? 'w-1 h-2 md:w-1.5 md:h-3' : isDense ? 'w-1 h-[10px] md:w-2 md:h-4' : 'w-1.5 h-3 md:w-2.5 md:h-5';
                
                // Chair offsets - MUST BE SMALLER THAN HALF OF GAP X/Y
                const offsetY = isVeryDense ? '-top-[3px] md:-top-[6px]' : isDense ? '-top-[4px] md:-top-[8px]' : '-top-[6px] md:-top-[10px]';
                const offsetB = isVeryDense ? '-bottom-[3px] md:-bottom-[6px]' : isDense ? '-bottom-[4px] md:-bottom-[8px]' : '-bottom-[6px] md:-bottom-[10px]';
                const offsetL = isVeryDense ? '-left-[3px] md:-left-[6px]' : isDense ? '-left-[4px] md:-left-[8px]' : '-left-[6px] md:-left-[10px]';
                const offsetR = isVeryDense ? '-right-[3px] md:-right-[6px]' : isDense ? '-right-[4px] md:-right-[8px]' : '-right-[6px] md:-right-[10px]';

                // Gap between tables
                const gaps = isVeryDense ? 'gap-x-3 gap-y-4 md:gap-x-5 md:gap-y-6' : isDense ? 'gap-x-4 gap-y-5 md:gap-x-6 md:gap-y-8' : 'gap-x-5 gap-y-7 md:gap-x-8 md:gap-y-10';

                const labelSize = isVeryDense ? 'text-[5px] md:text-[8px]' : isDense ? 'text-[7px] md:text-[10px]' : 'text-[9px] md:text-[11px]';
                const labelIconSize = isVeryDense ? 'w-[8px] h-[8px] md:w-[12px] md:h-[12px]' : isDense ? 'w-[10px] h-[10px] md:w-[14px] md:h-[14px]' : 'w-3 h-3 md:w-4 md:h-4';
                const txtSize = isVeryDense ? 'text-[6px] md:text-[10px]' : isDense ? 'text-[8px] md:text-[10px]' : 'text-[10px] md:text-[12px]';
                
                return (
                  <div 
                    className={`grid w-full px-8 md:px-12 justify-items-center mt-20 mb-10 ${gaps}`}
                    style={{ 
                      gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` 
                    }}
                  >
                    {derivedTables.map((table, index) => {
                      const status = getTableStatus(table.id, table.status);
                      
                      // Mock category: half VIP, half standard based on index (just for UX)
                      const category = index < totalTables / 2 ? 'VIP' : 'Standard';
                      const categoryColor = category === 'VIP' ? 'bg-[#d4af37] text-black' : 'bg-white/20 text-white';
                      
                      const isFirstInRow = index % gridCols === 0;
                      const isLastInRow = index % gridCols === gridCols - 1;
                      
                      const tooltipPos = isFirstInRow 
                        ? "-left-2" 
                        : isLastInRow 
                        ? "-right-2" 
                        : "left-1/2 -translate-x-1/2";
                      
                      const arrowPos = isFirstInRow
                        ? "ml-6"
                        : isLastInRow
                        ? "mr-6 ml-auto"
                        : "mx-auto";

                      const chairBaseColor = 
                        status === 'available' ? (category === 'VIP' ? 'bg-[#d4af37]/40 group-hover:bg-[#d4af37]/80' : 'bg-[#e5e5e5]/40 group-hover:bg-[#e5e5e5]/80') :
                        status === 'selected' ? 'bg-[#d4af37]/60 group-hover:bg-[#d4af37] shadow-[0_0_5px_rgba(212,175,55,0.3)]' :
                        'bg-[#222]';

                      return (
                        <div key={table.id} className="flex flex-col items-center gap-2 md:gap-4 relative group">
                          
                          {/* Tooltip */}
                          <div className={`absolute -top-16 ${tooltipPos} opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50`}>
                            <div className="bg-[#111] border border-[#ffffff1a] rounded-lg p-2.5 shadow-2xl flex flex-col items-center gap-1 w-[120px]">
                               <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${categoryColor}`}>{category}</div>
                               <div className="text-white text-xs font-bold leading-none mt-1">Mesa {table.id < 10 ? `0${table.id}` : table.id}</div>
                               <div className="text-[10px] text-[#d4af37] font-display">R$ {table.price.toFixed(2)}</div>
                            </div>
                            <div className={`w-2 h-2 bg-[#111] border-b border-r border-[#ffffff1a] rotate-45 -mt-[5px] ${arrowPos}`}></div>
                          </div>

                          <motion.button
                            whileHover={status === 'available' ? { scale: 1.12 } : {}}
                            whileTap={status === 'available' ? { scale: 0.95 } : {}}
                            onClick={() => toggleTableSelection(table.id, table.status)}
                            disabled={table.status === 'reserved'}
                            className={`
                              relative flex items-center justify-center
                              ${tableBaseSize}
                              transition-colors duration-300
                              ${status === 'selected' ? 'scale-110' : ''}
                              ${status === 'reserved' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            `}
                          >
                            {/* Cadeiras (Topo, Baixo, Esquerda, Direita) */}
                            <div className={`absolute ${offsetY} left-1/2 -translate-x-1/2 ${chairHBaseSizeX} rounded-t-full transition-all duration-300 ${chairBaseColor}`} />
                            <div className={`absolute ${offsetB} left-1/2 -translate-x-1/2 ${chairHBaseSizeX} rounded-b-full transition-all duration-300 ${chairBaseColor}`} />
                            <div className={`absolute top-1/2 ${offsetL} -translate-y-1/2 ${chairVBaseSizeY} rounded-l-full transition-all duration-300 ${chairBaseColor}`} />
                            <div className={`absolute top-1/2 ${offsetR} -translate-y-1/2 ${chairVBaseSizeY} rounded-r-full transition-all duration-300 ${chairBaseColor}`} />

                            {/* Mesa (Corpo Central) */}
                            <div className={`
                              relative z-10 w-full h-full rounded-full flex items-center justify-center border-2 transition-all duration-300
                              ${status === 'available' ? (category === 'VIP' ? 'border-[#d4af37]/50 bg-[#d4af3708] shadow-[0_0_10px_rgba(212,175,55,0.1)] group-hover:bg-[#d4af371a] group-hover:border-[#d4af37]' : 'border-white/20 bg-white/5 group-hover:border-white/50 group-hover:bg-white/10') : ''}
                              ${status === 'selected' ? 'border-[#d4af37]/60 bg-[#d4af37]/80 shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:border-white group-hover:bg-[#d4af37] group-hover:shadow-[0_0_30px_rgba(212,175,55,0.9)]' : ''}
                              ${status === 'reserved' ? 'border-[#333] bg-[#1a1a1a]' : ''}
                            `}>
                              {status === 'reserved' ? (
                                <Lock className={`${labelIconSize} text-[#555]`} />
                              ) : (
                                <span className={`font-serif ${txtSize} font-bold transition-colors duration-300 ${status === 'selected' ? 'text-[#0a0a0a]/60 group-hover:text-[#0a0a0a]' : (category === 'VIP' ? 'text-[#d4af37] group-hover:text-[#fde68a]' : 'text-neutral-400 group-hover:text-white')}`}>
                                  {table.id < 10 ? `0${table.id}` : table.id}
                                </span>
                              )}
                            </div>
                          </motion.button>

                          {/* Capacidade Label */}
                          <div className={`flex items-center gap-1 md:gap-1.5 ${labelSize} uppercase tracking-[0.2em] transition-opacity duration-300
                            ${status === 'available' ? (category === 'VIP' ? 'text-[#d4af37] opacity-60' : 'text-neutral-400 opacity-60') : 
                              status === 'selected' ? 'text-white opacity-100 font-bold' : 
                              'text-neutral-500 opacity-40'}`}
                          >
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
              </div>
              </div>
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
                          <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Data e Hora</h3>
                          <p className="text-sm text-white/70">
                            {new Date(activeEvent?.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} {activeEvent?.time ? `às ${activeEvent.time}` : ''}
                          </p>
                        </div>
                      </div>
                      
                      {activeEvent?.location && (
                        <div className="flex gap-4">
                          <MapPin className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Localização</h3>
                            <p className="text-sm text-white/70">{activeEvent.location}</p>
                          </div>
                        </div>
                      )}

                      {activeEvent?.ageRating && (
                        <div className="flex gap-4">
                          <Users className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Classificação</h3>
                            <p className="text-sm text-white/70">{activeEvent.ageRating}</p>
                          </div>
                        </div>
                      )}
                      
                      {activeEvent?.posLocations && (
                        <div className="flex gap-4">
                          <Ticket className="w-5 h-5 text-white/40" />
                          <div>
                            <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-1">Pontos Físicos</h3>
                            <p className="text-sm text-white/70">{activeEvent.posLocations}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {activeEvent?.importantNotes && (
                      <div className="bg-[#d4af37]/5 border border-[#d4af37]/10 p-5 rounded-xl">
                        <h3 className="text-[10px] tracking-widest text-[#d4af37] uppercase mb-3">Observações</h3>
                        <p className="text-sm text-[#d4af37]/80 leading-relaxed whitespace-pre-wrap">{activeEvent.importantNotes}</p>
                      </div>
                    )}
                    
                    {activeEvent?.entryRules && (
                      <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-xl">
                        <h3 className="text-[10px] tracking-widest text-red-400 uppercase mb-3">Avisos e Regras</h3>
                        <p className="text-sm text-red-400/80 leading-relaxed whitespace-pre-wrap">{activeEvent.entryRules}</p>
                      </div>
                    )}

                 </div>
              </section>

              {/* Informações Úteis / FAQ */}
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
            
            {/* Right Column: Ingressos e Resumo */}
            <div className={`lg:col-span-4 flex flex-col ${activeEvent?.status === 'Em breve' && !isPreviewingEvent ? 'hidden' : ''}`}>
              <div className="sticky top-24 flex flex-col gap-8">
            
            {/* Resumo do Pedido */}
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
                         <p className="text-[11px] uppercase tracking-widest text-[#e5e5e5] font-bold mb-1">Seu carrinho está vazio</p>
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
                                   <button onClick={() => setMaleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4"/></button>
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
                                   <button onClick={() => setFemaleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4"/></button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {singleTickets > 0 && (
                              <div className="flex justify-between items-center py-4 border-b border-white/10 group">
                                <div className="flex items-start flex-col gap-1">
                                  <span className="text-[11px] uppercase opacity-60 tracking-wider">{previewSectors[0]?.name || 'Entrada Pista'}</span>
                                  <span className="text-xs text-[#d4af37] font-bold">{singleTickets}x Ingressos</span>
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="text-sm font-display">R$ {ticketsTotal.toFixed(2)}</span>
                                   <button onClick={() => setSingleTickets(0)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4"/></button>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {selectedTablesData.map((table) => (
                          <div key={table.id} className="flex justify-between items-center py-4 border-b border-white/10 group">
                            <div className="flex items-start flex-col gap-1">
                              <span className="text-[11px] uppercase opacity-60 tracking-wider">Mesa #{table.id < 10 ? `0${table.id}` : table.id}</span>
                              <span className="text-xs text-[#d4af37] font-bold">{table.capacity} Pessoas</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="text-sm font-display">R$ {table.price.toFixed(2)}</span>
                               <button onClick={() => toggleTableSelection(table.id, table.status)} className="text-white/20 hover:text-red-400 transition ml-2"><X className="w-4 h-4"/></button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>

                {cartTimeLeft !== null && cartTimeLeft > 0 && (
                  <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 p-3 rounded-lg my-4 flex items-center justify-between">
                    <span className="text-[10px] text-[#d4af37] uppercase tracking-widest font-bold">Reserva Temporária</span>
                    <span className="text-[#d4af37] font-mono font-bold">
                      {Math.floor(cartTimeLeft / 60000).toString().padStart(2, '0')}:
                      {Math.floor((cartTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                  <div className="flex justify-between items-center opacity-60">
                    <span className="text-[11px] uppercase tracking-widest">Subtotal</span>
                    <span className="text-sm font-serif text-white">R$ {subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center opacity-60">
                    <span className="text-[11px] uppercase tracking-widest">Taxa de conveniência (10%)</span>
                    <span className="text-sm font-serif text-white">R$ {taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                    <span className="text-[11px] uppercase opacity-80 tracking-widest font-bold text-[#d4af37]">Total</span>
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
                className="w-full bg-[#d4af37] text-[#0a0a0a] py-5 mt-6 rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
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
      })() : currentView === 'reservations' ? (
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
                                const singleTickets = res.ticketsObj?.filter(t => !t.isTable) || [];
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
                                        {singleTickets.map(tkt => {
                                          const needsData = !tkt.ownerName;
                                          return (
                                          <div key={tkt.id} className={`p-4 rounded-xl border ${tkt.status === 'cancelled' ? 'border-red-500/20 bg-red-500/5' : needsData && tkt.status === 'active' ? 'bg-amber-500/5 border-amber-500/30' : 'border-white/10 bg-white/5'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
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
                                                  <p className="text-[9px] text-yellow-400 mt-1 uppercase">Aguardando {tkt.pendingTransferEmail}</p>
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
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'edit', data: { name: tkt.ownerName, cpf: tkt.ownerCpf, email: tkt.ownerEmail } }); }}
                                                    className={`px-3 py-2 rounded-lg text-[9px] uppercase tracking-[0.1em] font-bold transition flex-1 md:flex-none text-center h-[34px] ${needsData ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                                                  >
                                                    {tkt.ownerName ? 'Editar Dados' : 'Preencher Dados'}
                                                  </button>
                                                  <div className="flex gap-2 flex-1 md:flex-none w-full md:w-auto mt-2 md:mt-0">
                                                     <button 
                                                        onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'transfer' }); }}
                                                        className="h-[34px] flex-1 md:flex-none px-3 bg-white/5 hover:bg-white/10 rounded-lg text-white transition text-[9px] uppercase tracking-widest font-bold"
                                                      >
                                                        Transferir
                                                      </button>
                                                      <button 
                                                        onClick={(e) => { e.stopPropagation(); setActionTicket({ id: tkt.id, type: 'cancel' }); }}
                                                        className="h-[34px] flex-1 md:flex-none px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition text-[9px] uppercase tracking-widest font-bold"
                                                      >
                                                        Cancelar
                                                      </button>
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
                                        })}
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
        ) : currentView === 'profile' ? (
          <div className="max-w-3xl mx-auto px-6 sm:px-10 mt-12 mb-20">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 md:p-10">
              <div className="flex items-center justify-between gap-4 mb-8">
                <h1 className="text-2xl font-serif text-[#d4af37]">Meu Perfil</h1>
                <button
                  onClick={() => { setCurrentView('dashboard'); setDashboardMode('settings'); }}
                  className="px-4 py-2 border border-white/10 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/5 transition"
                >
                  Voltar
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Nome</p>
                  <p className="text-white">{sessionUser?.name || users.find(u => u.id === loggedInUserId)?.name || 'Usuário'}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">E-mail</p>
                  <p className="text-white">{sessionUser?.email || users.find(u => u.id === loggedInUserId)?.email || '-'}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Perfil</p>
                  <p className="text-white">{userRole || 'client'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : currentView === 'contact' ? (
          <div className="max-w-3xl mx-auto px-6 sm:px-10 mt-12 mb-20">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-10 h-10 border border-[#d4af37]/30 bg-[#d4af37]/10 flex items-center justify-center rounded-full">
                <MessageCircle className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h1 className="text-xl font-serif text-[#d4af37]">Central de Atendimento</h1>
                <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Como podemos ajudar você hoje?</p>
              </div>
            </div>

            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-12 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-64 h-64 bg-[#d4af37] opacity-[0.03] blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
               
               <div className="relative z-10">
                 <h2 className="text-xl md:text-2xl font-serif text-white mb-4 md:mb-6">Suporte ao Cliente</h2>
                 <p className="text-sm md:text-base opacity-60 mb-8 md:mb-10 max-w-md mx-auto leading-relaxed">
                   Caso você queira entrar em contato com o suporte ou tirar dúvidas sobre o evento, nossa equipe está disponível via WhatsApp para um atendimento ágil.
                 </p>

                 <a 
                   href={WHATSAPP_LINK}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-flex items-center justify-center min-h-[48px] gap-3 px-8 bg-[#25D366] text-white rounded-xl md:rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs hover:brightness-110 hover:shadow-[0_0_25px_rgba(37,211,102,0.3)] transition-all transform hover:-translate-y-1 w-full sm:w-auto"
                 >
                   <MessageCircle className="w-5 h-5 fill-current" />
                   Conversar com suporte
                 </a>

                 <div className="mt-10 md:mt-12 pt-8 md:pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-left">
                    <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-[#d4af37] mb-2 font-bold">Horário de Atendimento</h4>
                        <p className="text-xs opacity-50">Segunda a Sexta: 09:00 às 18:00</p>
                        <p className="text-xs opacity-50">Sábado: 10:00 às 14:00</p>
                    </div>
                    <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-[#d4af37] mb-2 font-bold">E-mail Corporativo</h4>
                        <p className="text-xs opacity-50 underline">suporte@espacomix.com.br</p>
                    </div>
                 </div>
               </div>
            </div>
            
            <button 
                onClick={() => setCurrentView('booking')}
                className="w-full mt-6 md:mt-8 min-h-[48px] border border-white/10 rounded-xl md:rounded-full text-[10px] md:text-xs uppercase tracking-widest text-white/40 hover:bg-white/5 hover:text-white transition"
              >
                Retornar ao Evento
              </button>
          </div>
        ) : currentView === 'admin-login' ? (
          <div className="max-w-md mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col items-center justify-center min-h-[60vh]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-[#0d0d0d] border border-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              
              {authTab !== 'staff' && (
                <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                  <button 
                    onClick={() => setAuthTab('login')}
                    className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                  >
                    Entrar
                  </button>
                  <button 
                    onClick={() => setAuthTab('register')}
                    className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'register' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                  >
                    Cadastrar
                  </button>
                </div>
              )}

              <div className="text-center mb-6">
                <h1 className="text-lg md:text-2xl font-serif text-[#d4af37] mb-2">
                  {authTab === 'staff' ? 'Acesso Colaborador' : authTab === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
                </h1>
                <p className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-40">
                   {authTab === 'staff' ? 'Entre com sua credencial da equipe' : authTab === 'login' ? 'Acesse sua conta para continuar' : 'Preencha os dados para se cadastrar'}
                </p>
              </div>

              {totpPending ? (
                <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                  <ShieldCheck className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
                  <h2 className="text-xl font-serif text-[#d4af37]">Verificação em Dois Fatores</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Insira o código do seu autenticador</p>
                  <input
                    type="text"
                    value={totpInput}
                    onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    className="w-full text-center text-2xl font-mono tracking-[0.5em] bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white focus:border-[#d4af37] outline-none transition"
                  />
                  {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest">{adminError}</p>}
                  <button
                    onClick={() => {
                      const TOTP_SECRET = import.meta.env.VITE_DEV_TOTP ?? '123456';
                      if (totpInput === TOTP_SECRET) {
                        setUserRole('developer');
                        setIsApprovedEventCreator(true);
                        setSessionUser({
                          id: 'dev',
                          email: adminForm.username,
                          name: 'Admin / Dev',
                          role: 'developer',
                          isApprovedEventCreator: true
                        });
                        setLoggedInUserId('dev');
                        setCurrentView('dashboard');
                        setDashboardMode('list');
                        setAdminError('');
                        setTotpPending(false);
                        setTotpInput('');
                      } else {
                        setAdminError('Token 2FA inválido');
                      }
                    }}
                    className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition"
                  >
                    Confirmar
                  </button>
                  <button onClick={() => { setTotpPending(false); setTotpInput(''); setAdminError(''); }} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition">
                    Voltar
                  </button>
                </div>
              ) : verificationStep ? (
                <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                  <Smartphone className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
                  <h2 className="text-xl font-serif text-[#d4af37]">Verificação de Celular</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    Enviamos um código de 4 dígitos para<br/><span className="text-[#d4af37] mt-2 block">{registerForm.phone}</span>
                  </p>
                  
                  <div className="flex justify-center gap-4 py-4">
                    {verificationCode.map((digit, idx) => (
                      <input 
                        key={idx}
                        id={`code-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const newCode = [...verificationCode];
                          newCode[idx] = e.target.value.replace(/\D/g, '');
                          setVerificationCode(newCode);
                          if (e.target.value && idx < 3) document.getElementById(`code-${idx + 1}`)?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !digit && idx > 0) {
                            document.getElementById(`code-${idx - 1}`)?.focus();
                          }
                        }}
                        className="w-12 h-14 bg-white/5 border border-white/20 rounded-xl text-center text-xl font-bold focus:border-[#d4af37] outline-none text-white transition-all"
                      />
                    ))}
                  </div>
                  {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                  
                  <button 
                    onClick={handleVerifyCode}
                    className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition"
                  >
                    Confirmar Cadastro
                  </button>
                  <button 
                    onClick={() => setVerificationStep(false)}
                    className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition mt-4"
                  >
                    Voltar e editar dados
                  </button>
                </div>
              ) : forgotPasswordStep === 'none' ? (
                  <>
                    <form onSubmit={(authTab === 'login' || authTab === 'staff') ? handleAdminLogin : handleRegister} className="space-y-4 md:space-y-5">
                      {authTab === 'register' && registerStep === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nome Completo</label>
                            <input 
                              type="text" 
                              value={registerForm.name}
                              onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="Seu nome"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                            <input 
                              type="email" 
                              value={registerForm.email}
                              onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="contato@exemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input 
                              type="password" 
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                        </motion.div>
                      )}
                      {authTab === 'register' && registerStep === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <button 
                            type="button"
                            onClick={() => setRegisterStep(1)}
                            className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                          >
                            <ArrowLeft className="w-3 h-3" /> Voltar
                          </button>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Celular</label>
                            <input 
                              type="tel" 
                              value={registerForm.phone}
                              onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="(11) 90000-0000"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">CPF</label>
                            <input 
                              type="text" 
                              value={registerForm.cpf}
                              onChange={(e) => setRegisterForm({...registerForm, cpf: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Data de Nascimento</label>
                            <input 
                              type="date" 
                              value={registerForm.birthDate}
                              onChange={(e) => setRegisterForm({...registerForm, birthDate: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>
                        </motion.div>
                      )}
                      {(authTab === 'login' || authTab === 'staff') && (
                        <>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail / Usuário</label>
                            <input 
                              type="text" 
                              value={adminForm.username}
                              onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="ex: admin"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input 
                              type="password" 
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                          {authTab === 'login' && (
                            <div className="flex justify-start">
                              <button
                                type="button"
                                onClick={() => setForgotPasswordStep('email')}
                                className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110 opacity-70 hover:opacity-100 transition"
                              >
                                Esqueci minha senha
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                      
                      <button 
                        type="submit"
                        className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-2"
                      >
                        {(authTab === 'login' || authTab === 'staff') ? 'Entrar' : registerStep === 1 ? 'Continuar' : 'Criar Conta e Continuar'}
                      </button>
                      
                      {authTab === 'login' && (
                        <>
                          <div className="flex items-center gap-4 my-4 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Entrar com Google
                          </button>
                        </>
                      )}
                      
                      {authTab === 'register' && registerStep === 1 && (
                        <>
                          <div className="flex items-center gap-4 my-4 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Cadastrar com Google
                          </button>
                        </>
                      )}
                    </form>
                  </>
                ) : (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (forgotPasswordStep === 'email') {
                       if (!forgotPasswordData.email) {
                         setAdminError('Preencha o e-mail');
                         return;
                       }
                       setAdminError('');
                       setForgotPasswordStep('code');
                    } else if (forgotPasswordStep === 'code') {
                       if (!forgotPasswordData.code) {
                         setAdminError('Preencha o código');
                         return;
                       }
                       setAdminError('');
                       setForgotPasswordStep('new_password');
                    } else if (forgotPasswordStep === 'new_password') {
                       if (!forgotPasswordData.newPassword) {
                         setAdminError('Preencha a nova senha');
                         return;
                       }
                       setAdminError('');
                       setForgotPasswordStep('none');
                       setForgotPasswordData({ email: '', code: '', newPassword: '' });
                       showToast('Senha redefinida com sucesso!', 'success');
                    }
                  }} className="space-y-4 md:space-y-5 animate-in fade-in zoom-in duration-300">
                     <button
                        type="button"
                        onClick={() => {
                          if (forgotPasswordStep === 'email') setForgotPasswordStep('none');
                          else if (forgotPasswordStep === 'code') setForgotPasswordStep('email');
                          else if (forgotPasswordStep === 'new_password') setForgotPasswordStep('code');
                        }}
                        className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                      >
                        <ArrowLeft className="w-3 h-3" /> Voltar
                     </button>

                     <div className="text-center mb-6">
                        <Smartphone className="w-10 h-10 text-[#d4af37] mx-auto opacity-80 mb-4" />
                        <h2 className="text-xl font-serif text-[#d4af37] mb-2">Recuperar Senha</h2>
                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                           {forgotPasswordStep === 'email' && 'Informe seu e-mail de acesso'}
                           {forgotPasswordStep === 'code' && `Enviamos um código para ${forgotPasswordData.email}`}
                           {forgotPasswordStep === 'new_password' && 'Crie sua nova senha de acesso'}
                        </p>
                     </div>

                     {forgotPasswordStep === 'email' && (
                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                          <input 
                            type="email" 
                            value={forgotPasswordData.email}
                            onChange={(e) => setForgotPasswordData({...forgotPasswordData, email: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                            placeholder="contato@exemplo.com"
                          />
                        </div>
                     )}

                     {forgotPasswordStep === 'code' && (
                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Código de Verificação</label>
                          <input 
                            type="text" 
                            value={forgotPasswordData.code}
                            onChange={(e) => setForgotPasswordData({...forgotPasswordData, code: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-center tracking-[1em]"
                            placeholder="0000"
                            maxLength={4}
                          />
                        </div>
                     )}

                     {forgotPasswordStep === 'new_password' && (
                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nova Senha</label>
                          <input 
                            type="password" 
                            value={forgotPasswordData.newPassword}
                            onChange={(e) => setForgotPasswordData({...forgotPasswordData, newPassword: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                            placeholder="••••••••"
                          />
                        </div>
                     )}

                     {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

                     <button 
                        type="submit"
                        className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-4"
                      >
                        {forgotPasswordStep === 'email' ? 'Enviar Código' : forgotPasswordStep === 'code' ? 'Verificar Código' : 'Redefinir Senha'}
                      </button>
                  </form>
                )}
            </motion.div>
            
            <div className="flex flex-col gap-3 mt-8">
              <button 
                onClick={() => setCurrentView('home')}
                className="inline-flex items-center justify-center min-h-[44px] px-8 bg-white/5 border border-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:border-white/20 transition-all shadow-sm"
              >
                Voltar ao Site
              </button>
            </div>
          </div>
        ) : currentView === 'dashboard' ? (
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
            ) : dashboardMode === 'approval-queue' && userRole === 'admin' ? (
              <ApprovalQueue onToast={showToast} />
            ) : dashboardMode === 'list' ? (
              isStaff ? (
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {events
                      .filter(evt => userRole === 'admin' || evt.assignedStaffIds.includes(loggedInUserId || ''))
                      .map((evt) => (
                      <motion.div 
                          key={evt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setSelectedDashboardEvent(evt.id);
                            setDashboardMode('list');
                            setTimeout(() => setDashboardMode(userRole === 'admin' ? 'details' : 'check-in'), 0);
                            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                            adminScrollRef.current?.scrollTo(0, 0);
                          }}
                          className="bg-[#0d0d0d] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer hover:border-[#d4af37]/30 transition-all duration-500"
                      >
                        <div className="h-40 md:h-48 overflow-hidden relative">
                          {evt.img ? <img src={evt.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" referrerPolicy="no-referrer" /> : <div className="w-full h-full bg-white/5" />}
                          <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-md text-[8px] uppercase tracking-widest font-bold text-[#d4af37]">
                              {evt.status}
                          </div>
                        </div>
                        <div className="p-5 md:p-6">
                          <h3 className="text-lg font-serif text-white mb-4 group-hover:text-[#d4af37] transition-colors">{evt.title}</h3>
                          <div className="space-y-2 mb-6 md:mb-8">
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] opacity-40 uppercase tracking-widest">
                              <Calendar className="w-3 h-3" /> {evt.date}
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
                              <span className="text-[9px] md:text-[10px] uppercase font-bold text-[#d4af37] flex items-center gap-1">Acessar {userRole === 'admin' ? 'Painel' : 'Check-in'} <ChevronRight className="w-3 h-3" /></span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                      {/* Create New Event Card */}
                      {userRole === 'admin' && (
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
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => setDashboardMode('list')}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37] hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" /> Voltar para Lista
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
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
                </div>

            {dashboardMode === 'details' ? (
              <div className="px-4 xl:px-0 space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Cabeçalho do Detalhe */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-serif text-white flex items-center gap-2">
                      {events.find(e => e.id === selectedDashboardEvent)?.title || 'Evento'}
                    </h2>
                  </div>
                  {(() => {
                    const evt = events.find(e => e.id === selectedDashboardEvent);
                    if (!evt) return null;
                    const statusColor = evt.status === 'Vendas liberadas' ? 'bg-green-500/20 text-green-400 border-green-500/30' : evt.status === 'Em breve' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/10 text-white/50 border-white/10';
                    return (
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] uppercase font-bold tracking-widest border ${statusColor}`}>
                          {evt.status}
                        </span>
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
                  return (
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
                      <p className="text-[10px] uppercase tracking-widest opacity-40 mb-4 font-bold text-center">Status do Evento</p>
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
                     <h3 className="text-3xl font-serif text-white">R$ 15.450</h3>
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
                       <h3 className="text-3xl font-serif text-white">148</h3>
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
                       <h3 className="text-3xl font-serif text-white">0</h3>
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
                     <h3 className="text-3xl font-serif text-white">24.5%</h3>
                     <p className="text-[9px] uppercase opacity-30 mt-3 pt-3 border-t border-white/5">25 checkouts abandonados</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Esquerda: Gráfico + Tabela */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Gráfico de Vendas */}
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 h-[340px] flex flex-col">
                       <div className="flex justify-between items-center mb-6">
                         <h3 className="text-sm uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-2">
                           <TrendingUp className="w-4 h-4" /> Evolução de Vendas
                         </h3>
                         <select className="bg-white/5 border border-white/10 rounded-lg text-xs px-3 py-1.5 focus:outline-none">
                           <option>Últimos 7 dias</option>
                           <option>Últimos 30 dias</option>
                         </select>
                       </div>
                       <div className="flex-1 w-full relative min-h-0" style={{height: 240}}>
                         {(() => {
                            const chartData = [
                              { name: 'Seg', ingressos: 15, mesas: 2 },
                              { name: 'Ter', ingressos: 30, mesas: 3 },
                              { name: 'Qua', ingressos: 25, mesas: 1 },
                              { name: 'Qui', ingressos: 40, mesas: 5 },
                              { name: 'Sex', ingressos: 60, mesas: 8 },
                              { name: 'Sab', ingressos: 95, mesas: 12 },
                              { name: 'Dom', ingressos: 120, mesas: 18 }
                            ];
                            return (
                              <ResponsiveContainer width="100%" height={240}>
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
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                  />
                                  <Area type="monotone" dataKey="ingressos" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorIngressos)" />
                                  <Area type="monotone" dataKey="mesas" stroke="#ffffff40" strokeWidth={2} fillOpacity={1} fill="url(#colorMesas)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            );
                         })()}
                       </div>
                    </div>

                    {/* Console de Acessos Recentes */}
                     <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-base font-serif text-white flex items-center gap-2">
                          Console de Entradas & Vendas
                        </h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="relative flex-1 sm:flex-initial">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input type="text" placeholder="Buscar ingresso/nome..." onChange={(e) => { if(e.target.value.length > 2) showToast("Buscando por: " + e.target.value, "info"); }} className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs w-full sm:w-64 focus:border-[#d4af37] outline-none" />
                          </div>
                          <button onClick={() => showToast("Abrindo os filtros da tabela...", "info")} className="p-2.5 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                            <Filter className="w-4 h-4 opacity-50" />
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Data Compra</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Comprador</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Tipo</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Status Acesso</th>
                              <th className="px-6 py-4 text-[9px] uppercase tracking-[0.2em] opacity-40 font-bold">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {buyers.slice(0, 4).map((buyer, idx) => (
                              <tr key={buyer.id} className="hover:bg-white/[0.03] transition relative group">
                                <td className="px-6 py-4">
                                   <div className="text-[11px] font-mono text-white/50">
                                     {new Date(Date.now() - idx * 3600000).toLocaleDateString('pt-BR')}
                                   </div>
                                </td>
                                <td className="px-6 py-4 flex flex-col justify-center">
                                  <span className="text-[13px] font-medium text-white line-clamp-1">{buyer.name}</span>
                                  <span className="text-[10px] opacity-40 lowercase line-clamp-1">{buyer.email}</span>
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
                                  ) : idx === 3 ? (
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
                      <div className="p-4 border-t border-white/5 text-center bg-white/[0.01]">
                        <button onClick={() => { showToast("Carregando mais operações...", "info"); setTimeout(() => showToast("Registros carregados com sucesso.", "success"), 1500); }} className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 transition">Carregar mais operações</button>
                      </div>
                    </div>
                  </div>

                  {/* Direita: Sidebar Actions */}
                  <div className="space-y-6">
                    {/* Botões Operacionais Primários */}
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={downloadPDFList} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition group">
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
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 sm:p-6 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-4 z-40 shadow-2xl">
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
                       <div className="relative aspect-[4/5] sm:aspect-video w-full bg-black flex items-center justify-center">
                          <Scanner
                            onScan={(detectedCodes) => { if(detectedCodes?.[0]?.rawValue) handleCheckIn(detectedCodes[0].rawValue); }}
                            formats={['qr_code']}
                            allowMultiple={false}
                            onError={(err) => { console.warn('[Scanner]', err); }}
                          />
                          
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
                        <div className="w-full sm:max-w-xs relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-white" />
                          <input 
                             type="text" 
                             placeholder="Buscar por nome ou CPF..." 
                             value={checkInSearch}
                             onChange={(e) => setCheckInSearch(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-[#d4af37] outline-none text-white"
                          />
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
                                  <p className={`text-sm font-bold leading-tight ${b.checkedIn ? 'text-green-100' : 'text-white'}`}>{b.name}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-white/40 uppercase tracking-widest font-bold">{b.type}</span>
                                    <span className="text-[8px] opacity-40">{b.cpf}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center">
                                {!b.checkedIn ? (
                                  <button onClick={() => handleCheckIn(b.id)} className="px-4 py-2.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#ffe380] active:scale-95 transition-all">
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
                      onClick={() => { setDashboardMode(events.find(e => e.id === formEvent.id) ? 'details' : 'list'); setFormEvent(null); }}
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

                      <div className="space-y-6">
                        <div>
                          <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Nome do Evento *</label>
                          <input 
                            type="text" 
                            value={formEvent.title || ''}
                            onChange={(e) => setFormEvent({ ...formEvent, title: e.target.value })}
                            placeholder="Ex: Réveillon 2025"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Categoria</label>
                            <select 
                              value={formEvent.category || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, category: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all appearance-none text-white [&>option]:bg-[#0d0d0d]"
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
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all appearance-none text-white [&>option]:bg-[#0d0d0d]"
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
                              onChange={(e) => setFormEvent({ ...formEvent, date: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Hora Abertura *</label>
                            <input 
                              type="time" 
                              value={formEvent.time || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, time: e.target.value })}
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all [color-scheme:dark]"
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

                        <div className="pt-4 border-t border-white/5">
                          <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Localização * (Busca Google Maps)</label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 opacity-30 text-[#d4af37]" />
                            <input 
                              type="text" 
                              value={formEvent.location}
                              onChange={(e) => setFormEvent({ ...formEvent, location: e.target.value })}
                              placeholder="Busque o local ou digite o endereço..."
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl pl-12 pr-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all"
                            />
                            {/* Fake visual autocomplete suggestion drop if started typing */}
                            {formEvent.location.length > 3 && !formEvent.location.includes(',') && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#d4af37]/30 rounded-xl p-2 z-10 shadow-2xl">
                                  <div className="p-3 hover:bg-white/5 cursor-pointer rounded-lg flex items-center gap-3" onClick={(e) => setFormEvent({...formEvent, location: formEvent.location + ', São Paulo - SP'})}>
                                    <MapPin className="w-4 h-4 text-[#d4af37]" />
                                    <span className="text-sm">{formEvent.location}, São Paulo - SP</span>
                                  </div>
                               </div>
                            )}
                          </div>
                        </div>

                        <div>
                           <label className="block text-[9px] md:text-[10px] uppercase opacity-40 mb-2 font-bold tracking-[0.2em] ml-1">Pontos de Venda Físicos Associados</label>
                           <input 
                              type="text" 
                              value={formEvent.posLocations || ''}
                              onChange={(e) => setFormEvent({ ...formEvent, posLocations: e.target.value })}
                              placeholder="Ex: Bilheteria local, Loja X..."
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 text-sm focus:border-[#d4af37] outline-none transition-all placeholder:opacity-20"
                            />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Configuração de Lotes */}
                    <div id="lotes" className="bg-[#0d0d0d] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
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

                      <div className="space-y-8">
                        {formEvent.batches.map((batch, batchIndex) => (
                          <div key={batch.id} className="p-5 md:p-8 rounded-2xl bg-white/[0.02] border border-white/5 relative group">
                            <div className="flex justify-between items-center mb-6">
                              <input
                                type="text"
                                value={batch.name}
                                onChange={(e) => {
                                  const newBatches = [...formEvent.batches];
                                  newBatches[batchIndex].name = e.target.value;
                                  setFormEvent({ ...formEvent, batches: newBatches });
                                }}
                                className="bg-transparent border-b border-white/20 text-white font-bold text-lg focus:border-[#d4af37] outline-none transition-all pb-1 min-w-[200px]"
                                placeholder="Nome do Lote"
                              />
                              <button 
                                onClick={() => {
                                  setFormEvent({ ...formEvent, batches: formEvent.batches.filter((_, i) => i !== batchIndex) });
                                  showToast('Lote removido.', 'info');
                                }}
                                className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 opacity-50 hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-6">
                              {batch.sectors.map((sector, sectorIndex) => (
                                <div key={sector.id} className="p-5 rounded-xl bg-black/40 border border-white/5">
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-4">
                                      <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Nome do Setor / Ingresso</label>
                                      <input 
                                        type="text" 
                                        value={sector.name}
                                        onChange={(e) => {
                                          const newBatches = [...formEvent.batches];
                                          newBatches[batchIndex].sectors[sectorIndex].name = e.target.value;
                                          setFormEvent({ ...formEvent, batches: newBatches });
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
                                          value={sector.price}
                                          onChange={(e) => {
                                            const newBatches = [...formEvent.batches];
                                            newBatches[batchIndex].sectors[sectorIndex].price = Number(e.target.value);
                                            setFormEvent({ ...formEvent, batches: newBatches });
                                          }}
                                          className="w-full bg-[#d4af37]/10 text-[#d4af37] font-bold border border-[#d4af37]/30 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                        />
                                      </div>
                                    ) : (
                                      <div className="md:col-span-3 grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Fem (R$)</label>
                                          <input 
                                            type="number" 
                                            value={sector.priceFemale || ''}
                                            onChange={(e) => {
                                              const newBatches = [...formEvent.batches];
                                              newBatches[batchIndex].sectors[sectorIndex].priceFemale = Number(e.target.value);
                                              setFormEvent({ ...formEvent, batches: newBatches });
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37]"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">Masc (R$)</label>
                                          <input 
                                            type="number" 
                                            value={sector.priceMale || sector.price}
                                            onChange={(e) => {
                                              const newBatches = [...formEvent.batches];
                                              newBatches[batchIndex].sectors[sectorIndex].priceMale = Number(e.target.value);
                                              setFormEvent({ ...formEvent, batches: newBatches });
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
                                          const newBatches = [...formEvent.batches];
                                          newBatches[batchIndex].sectors[sectorIndex].limitPerUser = Number(e.target.value);
                                          setFormEvent({ ...formEvent, batches: newBatches });
                                        }}
                                        min="1"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">QTD Ingressos</label>
                                      <input 
                                        type="number" 
                                        value={sector.quantity}
                                        onChange={(e) => {
                                          const newBatches = [...formEvent.batches];
                                          newBatches[batchIndex].sectors[sectorIndex].quantity = Number(e.target.value);
                                          setFormEvent({ ...formEvent, batches: newBatches });
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-[#d4af37] outline-none"
                                      />
                                    </div>
                                    
                                    <div className="md:col-span-1 flex items-end">
                                      <button 
                                        onClick={() => {
                                          const newBatches = [...formEvent.batches];
                                          newBatches[batchIndex].sectors = batch.sectors.filter((_, i) => i !== sectorIndex);
                                          setFormEvent({ ...formEvent, batches: newBatches });
                                        }}
                                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center rounded-lg transition"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-center sm:justify-start gap-4">
                                     <label className="flex items-center gap-2 cursor-pointer">
                                       <input type="checkbox" className="accent-[#d4af37]" defaultChecked={true} />
                                       <span className="text-[10px] uppercase font-bold opacity-60">Absorver taxa Serviço (10%)</span>
                                     </label>
                                  </div>
                                </div>
                              ))}

                              <button 
                                onClick={() => {
                                  const newBatches = [...formEvent.batches];
                                  newBatches[batchIndex].sectors.push({
                                    id: Math.random().toString(36).substring(7),
                                    name: 'Novo Setor',
                                    quantity: 100,
                                    price: 50,
                                    limitPerUser: 4
                                  });
                                  setFormEvent({ ...formEvent, batches: newBatches });
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
                              id: Math.random().toString(36).substring(7),
                              name: `Lote ${formEvent.batches.length + 1}`,
                              startDate: new Date().toISOString().split('T')[0],
                              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              sectors: [{ id: 's1', name: 'Pista', quantity: 100, price: 50, limitPerUser: 4 }]
                            };
                            setFormEvent({ ...formEvent, batches: [...formEvent.batches, newBatch] });
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
                          className="aspect-[4/5] rounded-2xl border-2 border-dashed border-white/20 bg-white/2 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-colors"
                        >
                            {formEvent.img ? (
                              <>
                                <img src={formEvent.img} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-40 transition" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                  <div className="bg-black/80 px-4 py-2 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md">Alterar Imagem</div>
                                </div>
                              </>
                            ) : (
                              <div className="text-center p-6">
                                <UploadCloud className="w-8 h-8 text-white/30 mx-auto mb-3 group-hover:text-[#d4af37] transition-colors" />
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
                            onChange={(e) => setFormEvent({ ...formEvent, img: e.target.value })}
                            placeholder="https://suaimagem.com/foto.jpg"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-[#d4af37] outline-none"
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
                                setFormEvent({ 
                                  ...formEvent, 
                                  hasTables: true, 
                                  tableConfig: { totalTables: 10, seatsPerTable: 4, gridRows: 2, gridCols: 5 } 
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
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">Total de Mesas</label>
                              <input 
                                type="number" 
                                value={formEvent.tableConfig.totalTables}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, totalTables: Number(e.target.value) } })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37]"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase opacity-40 mb-1 font-bold">Lugares/Mesa</label>
                              <input 
                                type="number" 
                                value={formEvent.tableConfig.seatsPerTable}
                                onChange={(e) => setFormEvent({ ...formEvent, tableConfig: { ...formEvent.tableConfig!, seatsPerTable: Number(e.target.value) } })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37]"
                              />
                            </div>
                          </div>
                          
                          <div className="pt-4 mt-4 border-t border-white/5">
                            <h4 className="text-[10px] uppercase font-bold text-[#d4af37] mb-4">Preview do Mapa</h4>
                            <div className="bg-white/2 rounded-xl border border-white/5 p-4 min-h-[120px] flex items-center justify-center flex-wrap gap-2">
                               {Array.from({length: formEvent.tableConfig.totalTables}).map((_, i) => (
                                 <div key={i} className="w-6 h-6 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-[8px] opacity-70">
                                   {i+1}
                                 </div>
                               ))}
                            </div>
                            <button
                              onClick={() => setIsTableLayoutEditorOpen(true)}
                              className="w-full mt-3 py-2.5 border border-[#d4af37]/30 bg-[#d4af37]/5 rounded-lg text-[9px] uppercase font-bold tracking-widest text-[#d4af37] hover:bg-[#d4af37]/10 transition"
                            >
                              Abrir Editor Visual (Drag & Drop)
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
                onNavigateToProfile={() => setCurrentView('profile')}
              />
            ) : null}
            </>
          )}
        </div>
      ) : null}
    </main>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-8 md:py-6 border-t border-[#ffffff1a] flex flex-col md:flex-row justify-between items-center gap-6 bg-[#0a0a0a]/50 backdrop-blur-sm relative z-40">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-center md:text-left">
          <p className="text-[9px] md:text-[10px] opacity-40 uppercase tracking-widest">© 2026 Espaço Mix Eventos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[9px] md:text-[10px] opacity-60 uppercase tracking-[0.2em]">Reservas Ativas</span>
        </div>
      </footer>
      </div>

      {/* LGPD Banner */}
      <AnimatePresence>
        {showLgpdBanner && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 w-full z-[100] p-6 lg:p-8"
          >
            <div className="max-w-4xl mx-auto bg-[#0d0d0d] border border-[#d4af37]/30 rounded-3xl p-6 md:p-8 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-3 mb-3 justify-center md:justify-start text-[#d4af37]">
                  <ShieldCheck className="w-5 h-5" />
                  <h4 className="text-xs uppercase font-black tracking-widest">Sua Privacidade é Prioridade (LGPD)</h4>
                </div>
                <p className="text-xs opacity-60 leading-relaxed">
                  Utilizamos cookies e tecnologias seguras para garantir a melhor experiência na sua compra. Ao continuar, você concorda com nosso tratamento seguro de dados estritamente para fins de emissão de ingressos.
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button className="text-[10px] uppercase font-bold tracking-widest opacity-40 hover:opacity-100 transition px-4 py-3">Saiba mais</button>
                <button 
                  onClick={acceptLgpd}
                  className="bg-[#d4af37] text-black px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition shadow-[0_0_25px_rgba(212,175,55,0.2)]"
                >
                  Aceitar e Continuar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                aria-label="Fechar editor de layout"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 md:p-6 overflow-auto">
              <TableLayoutEditor
                initialLayout={formEvent.tableLayout || []}
                onSave={(layout) => {
                  setFormEvent({ ...formEvent, tableLayout: layout });
                  setIsTableLayoutEditorOpen(false);
                  showToast('Layout salvo com sucesso.', 'success');
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                       <p className="text-[10px] uppercase opacity-40 font-bold tracking-widest">Informações do Ingresso</p>
                       <p className="text-sm"><strong>Nome:</strong> {actionTicket.data?.name}</p>
                       <p className="text-sm"><strong>Email:</strong> {actionTicket.data?.email}</p>
                       <p className="text-sm"><strong>Tipo:</strong> {actionTicket.data?.type}</p>
                       <p className="text-sm flex items-center gap-2"><strong>Status:</strong> {actionTicket.data?.checkedIn ? <span className="text-green-500 font-bold text-xs uppercase tracking-widest">Acessou o evento</span> : <span className="text-yellow-500 font-bold text-xs uppercase tracking-widest">Aguardando</span>}</p>
                       <p className="text-xs opacity-50 mt-4 pt-4 border-t border-white/10 font-mono">ID Interno: {actionTicket.data?.id}</p>
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
                      {actionTicket.type === 'cancel_table' ? 'Tem certeza que deseja cancelar esta mesa inteira? Esta ação invalidará o QR Code de todos os ocupantes.' : 'Tem certeza que deseja cancelar este ingresso? Esta ação invalidará o QR Code permanentemente.'}
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
                          const updatedReservations = reservations.map(res => {
                            if (actionTicket.type === 'cancel_table' && res.id === actionTicket.reservationId) {
                               return {
                                 ...res,
                                 ticketsObj: res.ticketsObj?.map(t => t.tableNumber === actionTicket.id ? { ...t, status: 'cancelled' as const } : t)
                               };
                            } else if (actionTicket.type === 'cancel') {
                               return {
                                ...res,
                                ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id ? { ...t, status: 'cancelled' as const } : t)
                               };
                            }
                            return res;
                          });
                          setReservations(updatedReservations);
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
                              showToast(`Convite enviado para ${actionTicket.data.email}. A transferência será concluída quando o destinatário aceitar.`, 'success');
                              const updatedReservations = reservations.map(res => {
                                if (actionTicket.type === 'transfer_table' && res.id === actionTicket.reservationId) {
                                  return { ...res, ticketsObj: res.ticketsObj?.map(t => t.tableNumber === actionTicket.id ? { ...t, status: 'pending_transfer' as const, pendingTransferEmail: actionTicket.data?.email } : t) };
                                } else if (actionTicket.type === 'transfer') {
                                  return { ...res, ticketsObj: res.ticketsObj?.map(t => t.id === actionTicket.id ? { ...t, status: 'pending_transfer' as const, pendingTransferEmail: actionTicket.data?.email } : t) };
                                }
                                return res;
                              });
                              setReservations(updatedReservations);
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
                        const updatedReservations = reservations.map(res => ({
                          ...res,
                          ticketsObj: res.ticketsObj?.map(t => {
                            if (t.id === actionTicket.id) {
                              return {
                                ...t,
                                ownerName: actionTicket.data?.name || '',
                                ownerCpf: actionTicket.data?.cpf || '',
                                ownerEmail: actionTicket.data?.email || ''
                              };
                            }
                            return t;
                          })
                        }));
                        setReservations(updatedReservations);
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

      {/* Modal - Equipe de Campo */}
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
                             const currentIds = formEvent.assignedStaffIds || [];
                             setFormEvent({
                               ...formEvent,
                               assignedStaffIds: isAssigned 
                                 ? currentIds.filter(id => id !== staff.id)
                                 : [...currentIds, staff.id]
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

      {/* Modal - Enviar Aviso a Todos */}
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
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-6">
                Envie um aviso para todos os clientes deste evento.
              </p>

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
                  if(!messageText.trim()) {
                     showToast("Escreva uma mensagem primeiro", "warning");
                     return;
                  }
                  showToast("Aviso sendo enviado para todos...", "success");
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

      {/* Modal - Histórico Completo */}
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

      {/* Modal / Checkout State Simples */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(212,175,55,0.05)] relative mx-auto my-auto overflow-y-auto max-h-[95vh]"
            >
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                disabled={paymentStatus !== 'idle'}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition z-50 disabled:opacity-0"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Progress Indicator */}
              {paymentStatus === 'idle' && checkoutStep !== 'success' && checkoutStep !== 'processing' && (
                <div className="flex items-center justify-between mb-8 px-2 max-w-[200px] mx-auto mt-2 relative">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -translate-y-1/2 z-0"></div>
                  <div className="absolute top-1/2 left-0 h-[1px] bg-[#d4af37] -translate-y-1/2 z-0 transition-all duration-500" style={{ width: checkoutStep === 'selection' ? '0%' : (checkoutStep === 'login-form') ? '50%' : '100%' }}></div>
                  
                  {['selection', 'login-form', 'payment-method'].map((step, idx) => {
                     const isCurrent = checkoutStep === step || (idx === 1 && checkoutStep === 'login-form');
                     const isPast = (idx === 0 && checkoutStep !== 'selection') || (idx === 1 && checkoutStep === 'payment-method');
                     return (
                      <div key={idx} className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isCurrent || isPast ? 'bg-[#0f0f0f] border-[#d4af37] text-[#d4af37]' : 'bg-[#0f0f0f] border-white/20 text-white/30'}`}>
                         {isPast ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                     )
                  })}
                </div>
              )}
              
              {paymentStatus === 'idle' && checkoutStep === 'selection' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-xl md:text-2xl font-serif text-[#d4af37] mb-2 text-center">Resumo do Pedido</h2>
                  <p className="text-[10px] md:text-[11px] uppercase opacity-50 tracking-widest text-center mb-8">Confirme seus itens antes de prosseguir</p>
                  
                  {cartTimeLeft !== null && cartTimeLeft > 0 && (
                    <div className={`p-3 rounded-xl mb-6 flex items-center justify-center gap-3 transition-colors ${cartTimeLeft < 120000 ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-white/5 border border-white/10 text-white/70'}`}>
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">
                        {cartTimeLeft < 120000 ? 'Reserva Expirando:' : 'Sua mesa está garantida por:'}
                      </span>
                      <span className="font-mono font-bold">
                        {Math.floor(cartTimeLeft / 60000).toString().padStart(2, '0')}:
                        {Math.floor((cartTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 mb-6 space-y-4">
                    {selectedTablesData.length > 0 && (
                      <div className="flex justify-between items-start text-sm group">
                        <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Mesas ({selectedTablesData.length})</span>
                        <span className="text-white font-serif whitespace-nowrap ml-4">R$ {tablesTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {activeEvent?.priceType === 'gender' ? (
                      <>
                        {maleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Ingressos Masc. ({maleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(maleTickets * (previewSectors[0]?.priceMale || 0)).toFixed(2)}</span>
                          </div>
                        )}
                        {femaleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">Ingressos Fem. ({femaleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(femaleTickets * (previewSectors[0]?.priceFemale || 0)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {singleTickets > 0 && (
                          <div className="flex justify-between items-start text-sm group">
                            <span className="opacity-60 uppercase text-[10px] tracking-widest leading-relaxed">{previewSectors[0]?.name || 'Ingressos'} ({singleTickets})</span>
                            <span className="text-white font-serif whitespace-nowrap ml-4">R$ {(singleTickets * (previewSectors[0]?.price || EVENT_TICKET_PRICE)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center opacity-60">
                      <span className="text-[10px] md:text-[11px] uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-serif text-white whitespace-nowrap">R$ {subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60 group relative cursor-help">
                      <span className="text-[10px] md:text-[11px] uppercase tracking-widest flex items-center gap-1">
                         Taxa de conveniência (10%) <Info className="w-3 h-3 hidden md:block" />
                      </span>
                      <span className="text-sm font-serif text-white whitespace-nowrap">R$ {taxAmount.toFixed(2)}</span>
                      <div className="absolute left-0 bottom-full mb-2 w-[220px] p-2 bg-[#222] border border-white/10 text-[9px] normal-case tracking-normal rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:block hidden z-50 shadow-2xl">
                        Esta taxa cobre os custos operacionais da plataforma, garantindo segurança na transação e suporte dedicado.
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[11px] uppercase opacity-80 tracking-[0.2em] font-bold text-[#d4af37]">Total</span>
                      <span className="text-white text-2xl font-serif whitespace-nowrap">R$ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (role) {
                        setCheckoutStep('payment-method');
                      } else {
                        setAuthTab('login');
                        setCheckoutStep('login-form');
                      }
                    }}
                    className="w-full py-3 md:py-4 mt-2 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => setIsCheckoutOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 border border-[#d4af37]/50 bg-[#d4af37]/10 rounded-xl text-[#d4af37] text-[10px] uppercase font-bold tracking-widest hover:bg-[#d4af37]/20 transition mx-auto mt-4"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar Itens
                  </button>
                </motion.div>
              )}

              {paymentStatus === 'idle' && checkoutStep === 'payment-method' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <button 
                    onClick={() => setCheckoutStep('selection')}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition mb-6"
                  >
                    <ArrowLeft className="w-3 h-3" /> Voltar ao resumo
                  </button>

                  <h2 className="text-xl md:text-2xl font-serif text-[#d4af37] mb-1">Forma de Pagamento</h2>
                  <p className="text-[10px] uppercase opacity-50 tracking-widest mb-4">Escolha como deseja pagar (R$ {grandTotal.toFixed(2)})</p>

                  <div className="space-y-2 mb-4">
                    {/* PIX - DESTAQUE */}
                    <button 
                      onClick={() => {
                        setPaymentMethod('pix');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${paymentMethod === 'pix' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition ${paymentMethod === 'pix' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                          <Smartphone className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-2">
                            PIX 
                            <span className="bg-green-500 text-black text-[8px] px-1.5 py-0.5 rounded font-black animate-pulse">RECOMENDADO</span>
                          </p>
                          <p className="text-[9px] md:text-[10px] opacity-40">Aprovação instantânea 24/7</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'pix' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                        {paymentMethod === 'pix' && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </button>

                    {/* Cartão de Crédito */}
                    <AnimatePresence>
                      <button 
                        onClick={() => {
                          setPaymentMethod('credit_card');
                          setErrors(prev => ({ ...prev, payment: '' }));
                        }}
                        className={`w-full p-3 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${paymentMethod === 'credit_card' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition ${paymentMethod === 'credit_card' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                            <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Cartão de Crédito</p>
                            <p className="text-[9px] md:text-[10px] opacity-40">Até 12x no cartão</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === 'credit_card' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                          {paymentMethod === 'credit_card' && <Check className="w-3 h-3 text-black" />}
                        </div>
                      </button>

                      {paymentMethod === 'credit_card' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-2 pb-2 overflow-hidden"
                        >
                          <div className="pt-4 border-t border-white/5 mt-4 space-y-4">
                             <div className="space-y-4">
                               <div className="relative">
                                 <input type="text" placeholder="Número do Cartão" className="w-full bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl text-[11px] md:text-sm focus:outline-none focus:border-[#d4af37] transition font-mono tracking-widest text-[#d4af37]" />
                                 <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                               </div>
                               <input type="text" placeholder="Nome Impresso no Cartão" className="w-full bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl text-[11px] md:text-sm focus:outline-none focus:border-[#d4af37] transition uppercase" />
                               <div className="flex gap-4">
                                  <input type="text" placeholder="Validade (MM/AA)" className="w-1/2 bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl text-[11px] md:text-sm focus:outline-none focus:border-[#d4af37] transition font-mono" />
                                  <input type="text" placeholder="CVV" className="w-1/2 bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl text-[11px] md:text-sm focus:outline-none focus:border-[#d4af37] transition font-mono" />
                               </div>
                               <select className="w-full bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl text-[11px] md:text-sm focus:outline-none focus:border-[#d4af37] transition text-white/80 appearance-none">
                                  <option value="1">1x de R$ {grandTotal.toFixed(2)} sem juros</option>
                                  <option value="2">2x de R$ {(grandTotal / 2).toFixed(2)} sem juros</option>
                                  <option value="3">3x de R$ {(grandTotal / 3).toFixed(2)} sem juros</option>
                               </select>
                             </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Cartão de Débito */}
                    <button 
                      onClick={() => {
                        setPaymentMethod('debit_card');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className={`w-full p-3 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${paymentMethod === 'debit_card' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition ${paymentMethod === 'debit_card' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                          <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Cartão de Débito</p>
                          <p className="text-[9px] md:text-[10px] opacity-40">Débito à vista</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'debit_card' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                        {paymentMethod === 'debit_card' && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </button>

                    {/* Boleto */}
                    <AnimatePresence>
                      <button 
                        onClick={() => {
                          setPaymentMethod('boleto');
                          setErrors(prev => ({ ...prev, payment: '' }));
                        }}
                        className={`w-full p-3 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between group ${paymentMethod === 'boleto' ? 'bg-[#d4af37]/10 border-[#d4af37]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition ${paymentMethod === 'boleto' ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white'}`}>
                            <Receipt className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Boleto Bancário</p>
                            <p className="text-[9px] md:text-[10px] opacity-40">Compensação em até 48h</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === 'boleto' ? 'border-[#d4af37] bg-[#d4af37]' : 'border-white/10'}`}>
                          {paymentMethod === 'boleto' && <Check className="w-3 h-3 text-black" />}
                        </div>
                      </button>

                      {paymentMethod === 'boleto' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-2 pb-2 overflow-hidden"
                        >
                          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left flex gap-3">
                             <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                             <p className="text-[10px] md:text-[11px] text-amber-500/80 leading-relaxed font-bold">
                               Atenção: Boletos podem levar até 48 horas úteis para compensar. Se o evento estiver próximo, sua reserva pode não ser confirmada a tempo.
                             </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={handleConfirmReservation}
                    disabled={!paymentMethod || isProcessingPayment}
                    className="w-full py-3 md:py-4 mt-2 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Confirmar e Pagar <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="mt-4 p-3 md:p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3 md:gap-4 text-left">
                    <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mt-0.5" />
                    <div>
                       <p className="text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Ambiente 100% Seguro</p>
                       <p className="text-[9px] md:text-[10px] opacity-60 leading-relaxed">Sua transação é protegida com criptografia de ponta a ponta seguindo normas PCI-DSS.</p>
                    </div>
                  </div>
                  {errors.payment && <p className="text-[10px] text-red-500 mt-2 text-center font-bold uppercase">{errors.payment}</p>}
                </motion.div>
              )}

              {paymentStatus === 'idle' && checkoutStep === 'login-form' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <button 
                    onClick={() => setCheckoutStep('selection')}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition mb-6"
                  >
                    <ArrowLeft className="w-3 h-3" /> Voltar às opções
                  </button>

                  <div className="flex bg-white/5 p-1 rounded-xl mb-8">
                    <button 
                      onClick={() => setAuthTab('login')}
                      className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'login' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                    >
                      Entrar
                    </button>
                    <button 
                      onClick={() => setAuthTab('register')}
                      className={`flex-1 min-h-[44px] text-[10px] uppercase tracking-widest font-bold rounded-lg transition ${authTab === 'register' ? 'bg-[#d4af37] text-black shadow-sm' : 'text-white/40 hover:text-white'}`}
                    >
                      Cadastrar
                    </button>
                  </div>

                  <h2 className="text-2xl font-serif text-[#d4af37] mb-2 text-center">
                    {authTab === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}
                  </h2>
                  <p className="text-[11px] uppercase opacity-50 tracking-widest mb-8 text-center text-balance">
                    {authTab === 'login' ? 'Acesse para continuar sua compra' : 'Preencha os dados obrigatórios'}
                  </p>

                  {verificationStep ? (
                    <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                      <Smartphone className="w-12 h-12 text-[#d4af37] mx-auto opacity-80" />
                      <h2 className="text-xl font-serif text-[#d4af37]">Verificação de Celular</h2>
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                        Enviamos um código de 4 dígitos para<br/><span className="text-[#d4af37] mt-2 block">{registerForm.phone}</span>
                      </p>
                      
                      <div className="flex justify-center gap-4 py-4">
                        {verificationCode.map((digit, idx) => (
                          <input 
                            key={`checkout-code-${idx}`}
                            id={`checkout-code-${idx}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => {
                              const newCode = [...verificationCode];
                              newCode[idx] = e.target.value.replace(/\D/g, '');
                              setVerificationCode(newCode);
                              if (e.target.value && idx < 3) document.getElementById(`checkout-code-${idx + 1}`)?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !digit && idx > 0) {
                                document.getElementById(`checkout-code-${idx - 1}`)?.focus();
                              }
                            }}
                            className="w-12 h-14 bg-white/5 border border-white/20 rounded-xl text-center text-xl font-bold focus:border-[#d4af37] outline-none text-white transition-all"
                          />
                        ))}
                      </div>
                      {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                      
                      <button 
                        onClick={() => {
                          if (verificationCode.join('').length < 4) {
                            setAdminError('Preencha o código completo (4 dígitos)');
                            return;
                          }
                          setAdminError('');
                          // Simulando verificacao de API e confirmacao
                          setTimeout(() => {
                            const newUser = {
                              id: Math.random().toString(36).substr(2, 9),
                              name: registerForm.name,
                              email: registerForm.email,
                              phone: registerForm.phone,
                              cpf: registerForm.cpf,
                              birthDate: registerForm.birthDate,
                              password: registerForm.password
                            };
                            setUsers([...users, newUser]);
                            setVerificationStep(false);
                            setAuthTab('login');
                            showToast(`Cadastro concluído! Faça login para prosseguir.`, 'success');
                            setRegisterForm({ name: '', email: '', phone: '', cpf: '', birthDate: '', password: '' });
                            setVerificationCode(['', '', '', '']);
                          }, 500);
                        }}
                        className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.2)] transition"
                      >
                        Confirmar Cadastro
                      </button>
                      <button 
                        onClick={() => setVerificationStep(false)}
                        className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition mt-4"
                      >
                        Voltar e editar dados
                      </button>
                    </div>
                  ) : forgotPasswordStep === 'none' ? (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (authTab === 'login') {
                        const user = users.find(u => u.email === adminForm.username && u.password === adminForm.password);
                        if (user) {
                          setUserRole('client');
                          setIsApprovedEventCreator(Boolean(user.isApprovedEventCreator));
                          setSessionUser({
                            id: user.id,
                            email: user.email,
                            name: user.name || 'Sua Conta',
                            role: 'client',
                            isApprovedEventCreator: Boolean(user.isApprovedEventCreator),
                            producerProfile: user.producerProfile
                          });
                          setLoggedInUserId(user.id);
                          setAdminError('');
                          setGuestData({ name: user.name || 'Usuário', email: user.email, cpf: user.cpf || '000.000.000-00' });
                          setCheckoutStep('payment-method');
                        } else {
                          setAdminError('Usuário ou senha incorretos');
                        }
                      } else {
                        handleRegister(e);
                      }
                    }} className="space-y-4 md:space-y-5">
                      {authTab === 'register' && registerStep === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nome Completo</label>
                            <input 
                              type="text" 
                              value={registerForm.name}
                              onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="Seu nome"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                            <input 
                              type="email" 
                              value={registerForm.email}
                              onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="contato@exemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input 
                              type="password" 
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                        </motion.div>
                      )}
                      {authTab === 'register' && registerStep === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-5">
                          <button 
                            type="button"
                            onClick={() => setRegisterStep(1)}
                            className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                          >
                            <ArrowLeft className="w-3 h-3" /> Voltar
                          </button>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Celular</label>
                            <input 
                              type="tel" 
                              value={registerForm.phone}
                              onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="(11) 90000-0000"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">CPF</label>
                            <input 
                              type="text" 
                              value={registerForm.cpf}
                              onChange={(e) => setRegisterForm({...registerForm, cpf: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Data de Nascimento</label>
                            <input 
                              type="date" 
                              value={registerForm.birthDate}
                              onChange={(e) => setRegisterForm({...registerForm, birthDate: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-white"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>
                        </motion.div>
                      )}
                      {authTab === 'login' && (
                        <>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail / Usuário</label>
                            <input 
                              type="text" 
                              value={adminForm.username}
                              onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="ex: admin"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Senha</label>
                            <input 
                              type="password" 
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                          <div className="flex justify-start">
                            <button
                              type="button"
                              onClick={() => setForgotPasswordStep('email')}
                              className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:brightness-110 opacity-70 hover:opacity-100 transition"
                            >
                              Esqueci minha senha
                            </button>
                          </div>
                        </>
                      )}
                      {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}
                      
                      <button 
                        type="submit"
                        className="w-full py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2 mb-2 mt-2"
                      >
                        {authTab === 'login' ? 'Entrar e Prosseguir' : registerStep === 1 ? 'Próximo Passo' : 'Cadastrar e Entrar'}
                      </button>
                      
                      {authTab === 'login' && (
                        <>
                          <div className="flex items-center gap-4 mb-3 mt-1 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Entrar com Google
                          </button>
                        </>
                      )}
                      
                      {authTab === 'register' && registerStep === 1 && (
                        <>
                          <div className="flex items-center gap-4 mb-3 mt-1 opacity-30">
                            <div className="h-[1px] flex-1 bg-white"></div>
                            <span className="text-[9px] uppercase tracking-widest">ou</span>
                            <div className="h-[1px] flex-1 bg-white"></div>
                          </div>
                          <button 
                            type="button"
                            className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition flex justify-center items-center gap-2"
                          >
                            <GoogleIcon className="w-4 h-4" /> Cadastrar com Google
                          </button>
                        </>
                      )}
                    </form>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (forgotPasswordStep === 'email') {
                         if (!forgotPasswordData.email) {
                           setAdminError('Preencha o e-mail');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('code');
                      } else if (forgotPasswordStep === 'code') {
                         if (!forgotPasswordData.code) {
                           setAdminError('Preencha o código');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('new_password');
                      } else if (forgotPasswordStep === 'new_password') {
                         if (!forgotPasswordData.newPassword) {
                           setAdminError('Preencha a nova senha');
                           return;
                         }
                         setAdminError('');
                         setForgotPasswordStep('none');
                         setForgotPasswordData({ email: '', code: '', newPassword: '' });
                         showToast('Senha redefinida com sucesso!', 'success');
                      }
                    }} className="space-y-4 md:space-y-5 animate-in fade-in zoom-in duration-300">
                       <button
                          type="button"
                          onClick={() => {
                            if (forgotPasswordStep === 'email') setForgotPasswordStep('none');
                            else if (forgotPasswordStep === 'code') setForgotPasswordStep('email');
                            else if (forgotPasswordStep === 'new_password') setForgotPasswordStep('code');
                          }}
                          className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition flex items-center gap-2 mb-4"
                        >
                          <ArrowLeft className="w-3 h-3" /> Voltar
                       </button>

                       <div className="text-center mb-6">
                          <Smartphone className="w-10 h-10 text-[#d4af37] mx-auto opacity-80 mb-4" />
                          <h2 className="text-xl font-serif text-[#d4af37] mb-2">Recuperar Senha</h2>
                          <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                             {forgotPasswordStep === 'email' && 'Informe seu e-mail de acesso'}
                             {forgotPasswordStep === 'code' && `Enviamos um código para ${forgotPasswordData.email}`}
                             {forgotPasswordStep === 'new_password' && 'Crie sua nova senha de acesso'}
                          </p>
                       </div>

                       {forgotPasswordStep === 'email' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">E-mail</label>
                            <input 
                              type="email" 
                              value={forgotPasswordData.email}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, email: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="contato@exemplo.com"
                            />
                          </div>
                       )}

                       {forgotPasswordStep === 'code' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Código de Verificação</label>
                            <input 
                              type="text" 
                              value={forgotPasswordData.code}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, code: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition text-center tracking-[1em]"
                              placeholder="0000"
                              maxLength={4}
                            />
                          </div>
                       )}

                       {forgotPasswordStep === 'new_password' && (
                          <div>
                            <label className="block text-[9px] md:text-[10px] uppercase tracking-[2px] opacity-50 mb-2 ml-1">Nova Senha</label>
                            <input 
                              type="password" 
                              value={forgotPasswordData.newPassword}
                              onChange={(e) => setForgotPasswordData({...forgotPasswordData, newPassword: e.target.value})}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 min-h-[48px] text-sm focus:border-[#d4af37] outline-none transition"
                              placeholder="••••••••"
                            />
                          </div>
                       )}

                       {adminError && <p className="text-red-400 text-[10px] uppercase tracking-widest text-center">{adminError}</p>}

                       <button 
                          type="submit"
                          className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 transition mt-4"
                        >
                          {forgotPasswordStep === 'email' ? 'Enviar Código' : forgotPasswordStep === 'code' ? 'Verificar Código' : 'Redefinir Senha'}
                        </button>
                    </form>
                  )}
                </motion.div>
              )}

              {paymentStatus === 'processing' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-6"
                >
                  {paymentMethod === 'pix' && pixData ? (
                    <div className="text-center w-full">
                      <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-xl">
                        <img src={pixData.qrCode} alt="PIX QR Code" className="w-48 h-48 mx-auto" />
                      </div>
                      <h3 className="text-xl font-serif text-[#d4af37] mb-2">Escaneie o QR Code</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-6">Aguardando confirmação do pagamento...</p>
                      
                      <div className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                           <p className="text-[9px] uppercase tracking-widest opacity-40 mb-2">Pix Copia e Cola</p>
                           <div className="flex gap-2">
                              <input 
                                readOnly 
                                value={pixData.copyPaste}
                                className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-[#d4af37] outline-none"
                              />
                              <button 
                                onClick={() => navigator.clipboard.writeText(pixData.copyPaste)}
                                className="bg-[#d4af37] text-black px-4 rounded-lg font-bold text-[10px] hover:brightness-110"
                              >
                                COPIAR
                              </button>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-center gap-3 py-4">
                           <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-ping"></div>
                           <p className="text-[10px] uppercase font-bold text-[#d4af37] animate-pulse">Sincronizando com Banco Central...</p>
                        </div>

                        <button 
                           onClick={() => {
                             setPaymentStatus('success');
                           }}
                           className="w-full py-4 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-[#d4af37]/10 transition"
                        >
                          Já realizei o pagamento
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="relative w-20 h-20 mb-6 mx-auto">
                        <div className="absolute inset-0 rounded-full border-t-2 border-[#d4af37] border-r-2 border-transparent border-b-2 border-transparent border-l-2 border-[#d4af37]/30 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-t-2 border-transparent border-r-2 border-[#d4af37]/50 border-b-2 border-transparent border-l-2 border-[#d4af37] animate-[spin_1.5s_linear_infinite_reverse]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-[#d4af37] animate-pulse" />
                        </div>
                      </div>
                      <h3 className="text-xl font-serif text-[#d4af37] mb-2">Processando {paymentMethod?.replace('_', ' ')}</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50">Por favor aguarde...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {paymentStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <X className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-serif text-white mb-2">Ops! Algo deu errado</h3>
                  <p className="text-[11px] text-white/60 mb-8 max-w-[280px] mx-auto">
                    {errors.payment || "Não conseguimos processar seu pagamento neste momento. Por favor, verifique seus dados ou tente outra forma de pagamento."}
                  </p>
                  
                  <div className="w-full space-y-4">
                    <button 
                      onClick={() => {
                        setPaymentStatus('idle');
                        setErrors(prev => ({ ...prev, payment: '' }));
                      }}
                      className="w-full py-4 bg-[#d4af37] text-black rounded-full text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" /> Tentar Novamente
                    </button>
                    
                    <button 
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setPaymentStatus('idle');
                      }}
                      className="w-full py-4 bg-white/5 text-white/40 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition"
                    >
                      Voltar depois
                    </button>
                  </div>
                </motion.div>
              )}

              {paymentStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center pt-2"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center mb-4 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-green-500/20 blur-xl animate-pulse"></div>
                    <Check className="w-8 h-8 relative z-10" />
                  </motion.div>
                  
                  <h3 className="text-xl font-serif text-white mb-1">Compra Concluída!</h3>
                  <p className="text-[9px] uppercase tracking-widest text-[#d4af37] mb-6 text-center">Seu ingresso foi enviado para <br/>{guestData.email || 'seu e-mail'}</p>

                  {reservations[0]?.ticketsObj?.some(t => t.isTable) && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30 p-4 rounded-xl mb-6 text-center w-full shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <p className="text-[11px] text-amber-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2 justify-center mb-2"><AlertCircle className="w-4 h-4" /> Importante</p>
                      <p className="text-[10px] text-amber-500/80 leading-relaxed uppercase">Para facilitar a entrada, informe agora os dados de cada ocupante da sua mesa.</p>
                      <button 
                        onClick={() => {
                          setIsCheckoutOpen(false);
                          setSelectedTables([]);
                          setSingleTickets(0);
                          setCurrentView('reservations');
                          setPaymentStatus('idle');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-4 w-full bg-amber-500/20 text-amber-400 text-[9px] uppercase font-bold tracking-widest py-2 rounded-lg hover:bg-amber-500/30 transition border border-amber-500/20"
                      >
                        Informar Ocupantes Agora
                      </button>
                    </motion.div>
                  )}

                  {/* MULTIPLE QR CODES */}
                  <div className={`grid grid-cols-2 gap-4 w-full pb-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar p-1`}>
                    {reservations[0]?.ticketsObj && reservations[0].ticketsObj.length > 0 ? (
                      reservations[0].ticketsObj.map((tkt, idx) => (
                        <div key={tkt.id} className="flex flex-col items-center gap-2">
                          <div className="bg-white p-3 rounded-xl relative group w-full flex flex-col items-center border-[3px] border-white shadow-xl">
                            <div className="text-[#0a0a0a] text-[8px] font-bold uppercase tracking-widest mb-2 border-b border-black/10 pb-2 w-full text-center truncate px-1">
                              {tkt.name}
                            </div>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${tkt.id}`} alt={`QR Code ${tkt.id}`} className="w-20 h-20 mx-auto" />
                            <p className="text-black/40 text-[7px] font-mono tracking-widest text-center mt-2">{tkt.id}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex w-full flex-col items-center justify-center gap-4 col-span-2">
                        <div className="bg-white p-4 rounded-2xl relative group">
                          <div className="absolute inset-0 bg-[#d4af37]/10 opacity-0 group-hover:opacity-100 transition rounded-2xl"></div>
                          <QrCode className="w-20 h-20 text-black mx-auto" strokeWidth={1.5} />
                          <p className="text-black/40 text-[8px] font-bold uppercase tracking-widest text-center mt-4">Reserva de Mesa(s)</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full mb-6">
                     <div className="flex gap-2">
                       <button className="flex-1 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 rounded-xl py-3 flex items-center justify-center gap-2 group transition">
                          <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"></path></svg>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 group-hover:text-white transition">Compartilhar</span>
                       </button>
                       <button className="flex-1 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 rounded-xl py-3 flex items-center justify-center gap-2 group transition">
                          <Download className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                          <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 group-hover:text-white transition">PDFs</span>
                       </button>
                     </div>
                  </div>

                  <div className="w-full pt-4 border-t border-white/10">
                    <button 
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setSelectedTables([]);
                        setSingleTickets(0);
                        setCurrentView('reservations');
                        setPaymentStatus('idle');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0a0a0a] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.2)] rounded-full hover:brightness-110 transition flex items-center justify-center gap-2"
                    >
                      Acessar Minhas Reservas
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participant Details Modal */}
      <AnimatePresence>
        {selectedBuyerForDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl relative"
            >
              {/* Header with Visual Decor */}
              <div className="relative h-32 md:h-40 bg-[#d4af37] flex items-end px-8 pb-6">
                <div className="absolute top-6 right-8 z-10">
                  <button 
                    onClick={() => setSelectedBuyerForDetails(null)}
                    className="w-10 h-10 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all hover:rotate-90"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Abstract Pattern Overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                   <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-white rotate-12 blur-3xl rounded-full"></div>
                   <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-black -rotate-12 blur-3xl rounded-full"></div>
                </div>

                <div className="relative z-10 flex items-center gap-6">
                   <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-[#0a0a0a]">
                      <User className="w-10 h-10 md:w-12 md:h-12 text-[#0a0a0a]" />
                   </div>
                   <div className="mb-2">
                      <h2 className="text-xl md:text-3xl font-serif text-[#0a0a0a] leading-none mb-1">{selectedBuyerForDetails.name}</h2>
                      <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-[#0a0a0a]/60">#{selectedBuyerForDetails.id.substring(0, 12)}</p>
                   </div>
                </div>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Personal Information */}
                <div>
                   <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-[#d4af37] mb-5 flex items-center gap-2">
                     <div className="w-4 h-[1px] bg-[#d4af37]/30"></div>
                     Dados Pessoais
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">CPF</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                            <FileText className="w-4 h-4 text-[#d4af37] opacity-60" />
                            <span className="text-sm font-mono tracking-wider">{selectedBuyerForDetails.cpf}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">E-mail</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 overflow-hidden">
                            <Mail className="w-4 h-4 text-[#d4af37] opacity-60 shrink-0" />
                            <span className="text-sm truncate">{selectedBuyerForDetails.email}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">Contato</p>
                         <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                            <Smartphone className="w-4 h-4 text-[#d4af37] opacity-60" />
                            <span className="text-sm">{selectedBuyerForDetails.phone || '(Não informado)'}</span>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold ml-1">Status de Cadastro</p>
                         <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/10 rounded-2xl p-4">
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-green-500">Verificado</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Purchase Information */}
                <div>
                   <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-[#d4af37] mb-5 flex items-center gap-2">
                     <div className="w-4 h-[1px] bg-[#d4af37]/30"></div>
                     Dados da Compra
                   </h3>
                   <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                         <Ticket className="w-32 h-32 rotate-12" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-8 relative z-10">
                         <div>
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Item Reservado</p>
                            <p className="text-xl md:text-2xl font-serif text-white leading-tight">{selectedBuyerForDetails.type}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Valor Pago</p>
                            <p className="text-xl md:text-2xl font-serif text-[#d4af37]">R$ {selectedBuyerForDetails.value.toFixed(2)}</p>
                         </div>
                         <div>
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Forma de Pagamento</p>
                            <div className="flex items-center gap-2">
                               <CreditCard className="w-4 h-4 opacity-50" />
                               <span className="text-[10px] uppercase tracking-widest font-bold">Cartão de Crédito</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-2">Data da Compra</p>
                            <p className="text-[10px] uppercase tracking-widest font-bold">24 de Abril, 2026</p>
                         </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${selectedBuyerForDetails.status === 'Pago' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[9px] uppercase tracking-[0.2em] font-black opacity-60">Status: {selectedBuyerForDetails.status}</span>
                         </div>
                         <button className="text-[9px] uppercase tracking-[0.2em] font-black text-[#d4af37] hover:underline flex items-center gap-2">
                           <Download className="w-3 h-3" /> Segunda Via Recibo
                         </button>
                      </div>
                   </div>
                </div>

                {/* Bottom Action */}
                <div className="flex gap-4">
                   <button 
                     onClick={() => setSelectedBuyerForDetails(null)}
                     className="flex-1 py-5 border border-white/10 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] hover:bg-white/5 transition-all transition-colors"
                   >
                     Fechar Detalhes
                   </button>
                   {!selectedBuyerForDetails.checkedIn && (
                      <button 
                        onClick={() => {
                          handleCheckIn(selectedBuyerForDetails.id);
                          setSelectedBuyerForDetails(null);
                        }}
                        className="flex-1 py-5 bg-[#d4af37] text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 shadow-lg shadow-[#d4af374d] transition-all"
                      >
                        Confirmar Check-in
                      </button>
                   )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Restored / Conflict Notification */}
      <AnimatePresence>
        {(sessionRestored || sessionConflict.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${sessionConflict.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                  {sessionConflict.length > 0 ? <ShieldAlert className="w-5 h-5" /> : <RefreshCcw className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#d4af37]">
                    {sessionConflict.length > 0 ? 'Conflito de Disponibilidade' : 'Sessão Restaurada'}
                  </h4>
                  <p className="text-[10px] opacity-60 leading-relaxed mt-0.5">
                    {sessionConflict.length > 0 
                      ? `Notamos que ${sessionConflict.join(', ')} não estão mais disponíveis e foram removidos.` 
                      : 'Recuperamos o seu checkout anterior para sua conveniência.'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSessionRestored(false);
                    setSessionConflict([]);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center transition opacity-40 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

       {/* Toast Notification */}
       <AnimatePresence>
         {actionToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 right-6 z-[100] pointer-events-none"
            >
               <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl shadow-black/80 border backdrop-blur-xl ${
                 actionToast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-100' :
                 actionToast.type === 'success' ? 'bg-[#d4af37]/20 border-[#d4af37]/50 text-[#d4af37]' :
                 actionToast.type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-100' :
                 'bg-[#1a1a1a]/90 border-white/20 text-white'
               }`}>
                 {actionToast.type === 'error' && <StopCircle className="w-5 h-5 text-red-500 shrink-0" />}
                 {actionToast.type === 'success' && <div className="w-2 h-2 rounded-full bg-[#d4af37] shrink-0 animate-pulse" />}
                 {actionToast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />}
                 {actionToast.type === 'info' && <div className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse" />}
                 <span className="font-medium text-sm tracking-wide leading-snug">{actionToast.message}</span>
               </div>
            </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
