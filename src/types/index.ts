export type LayoutElementType = 'round-table' | 'rect-table' | 'bistro-table' | 'stage' | 'dance-floor' | 'bar' | 'entry-exit' | 'restroom';

export interface TableLayoutElement {
  id: string;
  type: LayoutElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  capacity?: number;
  price?: number;
}

export type TableStatus = 'available' | 'reserved' | 'selected';

export interface TableDef {
  id: number;
  capacity: number;
  status: 'available' | 'reserved';
  price: number;
}

export interface TicketOwner {
  name: string;
  cpf: string;
  email?: string;
}

export interface TicketItem {
  id: string;
  name: string;
  isTable?: boolean;
  tableNumber?: number;
  occupantIndex?: number;
  ownerName: string;
  ownerCpf: string;
  ownerEmail?: string;
  status: 'active' | 'transferred' | 'cancelled' | 'pending_transfer';
  pendingTransferEmail?: string;
  transferExpiresAt?: number;
  originalBuyerId?: string;
}

export interface Reservation {
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
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card';
  platformFee?: number;
  netAmount?: number;
  createdAt?: string;
}

export interface StaffAccount {
  id: string;
  name: string;
  username: string;
  password: string;
}

export interface ProducerProfile {
  [key: string]: unknown;
}

export type UserRole = 'client' | 'admin' | 'developer' | null;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isApprovedEventCreator: boolean;
  producerProfile?: ProducerProfile;
  avatarUrl?: string;
}

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sectors: Sector[];
  is_active?: boolean;
  sort_order?: number;
}

export interface Sector {
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

export interface TableConfig {
  totalTables: number;
  seatsPerTable: number;
  gridRows: number;
  gridCols: number;
  tablePrice?: number;
  bistroPrice?: number;
  totalBistros?: number;
  globalIconSize?: number;
}

export interface Event {
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

export interface Buyer {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  type: string;
  value: number;
  status: 'Pago' | 'Pendente' | 'Cancelado';
  checkedIn?: boolean;
  purchaseDate?: string;
}

export interface SiteConfig {
  venueMaxCapacity: number | null;
  platformName: string;
  platformLogo: string | null;
}

export type CheckoutStep =
  | 'selection'
  | 'identification'
  | 'guest-form'
  | 'login-form'
  | 'payment-method'
  | 'processing'
  | 'success';

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card';

export type CurrentView =
  | 'home'
  | 'booking'
  | 'reservations'
  | 'contact'
  | 'admin-login'
  | 'dashboard'
  | 'profile';

export type DashboardMode =
  | 'list'
  | 'details'
  | 'staff'
  | 'check-in'
  | 'edit'
  | 'settings'
  | 'approval-queue'
  | 'producer-onboarding'
  | 'producer-dashboard'
  | 'developer-panel'
  | 'admin-overview'
  | 'dev-overview';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  message: string;
  type?: ToastType;
}

export interface GuestData {
  name: string;
  email: string;
  cpf: string;
}

export interface PixData {
  qrCode: string;
  copyPaste: string;
}
