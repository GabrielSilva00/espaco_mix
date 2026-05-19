// src/lib/supabase.ts
// ─────────────────────────────────────────────────────────────
// Cliente Supabase + todas as funções de banco de dados
// Substitui completamente o Firebase (initializeApp, getFirestore, etc.)
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ─── Tipos ────────────────────────────────────────────────────
export type UserRole = 'client' | 'admin' | 'developer' | null;

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  role: UserRole;
  is_approved_event_creator: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  end_date?: string;
  time?: string;
  end_time?: string;
  location: string;
  status: 'Ativo' | 'Em breve' | 'Vendas liberadas' | 'Rascunho' | 'Finalizado' | 'Pausado';
  img?: string;
  price_type: 'unique' | 'gender';
  has_tables: boolean;
  age_rating?: string;
  important_notes?: string;
  entry_rules?: string;
  additional_info?: string;
  pos_locations?: string;
  category?: string;
  capacity?: number;
  is_recurring?: boolean;
  custom_url?: string;
  refund_policy?: string;
  social_instagram?: string;
  social_spotify?: string;
  table_total?: number;
  table_seats?: number;
  table_rows?: number;
  table_cols?: number;
  table_layout?: any;
  created_by?: string;
  assigned_staff?: string[];
  updated_at?: string;
  batches?: Batch[];
}

export interface Batch {
  id: string;
  event_id: number;
  name: string;
  start_date: string;
  end_date: string;
  sort_order?: number;
  sectors?: Sector[];
}

export interface Sector {
  id: string;
  batch_id: string;
  event_id: number;
  name: string;
  quantity: number;
  price?: number;
  price_male?: number;
  price_female?: number;
  convenience_fee?: number;
  limit_per_user?: number;
  visibility?: 'public' | 'private' | 'code';
  description?: string;
}

export interface Reservation {
  id: string;
  event_id: number;
  user_id?: string;
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_phone?: string;
  tables?: number[];
  single_tickets?: number;
  male_tickets?: number;
  female_tickets?: number;
  total: number;
  platform_fee?: number;
  net_amount?: number;
  payment_status: 'pending' | 'approved' | 'cancelled' | 'refunded';
  payment_method?: 'pix' | 'credit_card' | 'debit_card' | 'boleto';
  payment_id?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  checked_in?: boolean;
  created_at: string;
  updated_at?: string;
  ticket_items?: TicketItem[];
}

export interface TicketItem {
  id: string;
  reservation_id: string;
  event_id: number;
  name: string;
  is_table?: boolean;
  table_number?: number;
  occupant_index?: number;
  owner_name: string;
  owner_cpf: string;
  owner_email?: string;
  status: 'active' | 'transferred' | 'cancelled' | 'pending_transfer';
  pending_transfer_email?: string;
  original_buyer_id?: string;
  checked_in_at?: string;
}

export interface StaffAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  event_ids?: number[];
  is_active?: boolean;
}

export interface ProducerApplication {
  id: string;
  user_id: string;
  company_name?: string;
  cnpj?: string;
  phone?: string;
  city?: string;
  event_types?: string[];
  social_instagram?: string;
  experience?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  site_name: string;
  site_logo_url?: string;
  primary_color?: string;
  venue_max_capacity?: number;
  platform_fee_percent?: number;
  max_tickets_per_purchase?: number;
  cart_expiration_minutes?: number;
  allow_scheduled?: boolean;
  default_event_status?: string;
  require_cpf?: boolean;
  limit_per_cpf?: number;
  block_simultaneous?: boolean;
  verify_email?: boolean;
  late_participant_info?: boolean;
  payment_provider?: string;
  // Transferências
  allow_transfer?: boolean;
  transfer_max_delay_hours?: number;
  allow_multiple_transfers?: boolean;
  transfer_require_email?: boolean;
  // Notificações
  notify_purchase?: boolean;
  notify_transfer?: boolean;
  notify_cancel?: boolean;
  notify_reminder?: boolean;
  // Cancelamento e reembolso
  allow_cancellation?: boolean;
  cancel_max_delay_hours?: number;
  auto_refund?: boolean;
  refund_type?: 'total' | 'partial';
  cancel_fee_percent?: number;
  refund_process_days?: number;
  // Checkout / ingressos
  show_fee_to_buyer?: boolean;
  ticket_require_name?: boolean;
  ticket_require_email?: boolean;
  same_owner_for_all?: boolean;
  // Gateway de pagamento
  gateway_fee_percent?: number;
  fee_payer?: 'buyer' | 'seller';
  // Relatórios e suporte
  enable_reports?: boolean;
  allow_export?: boolean;
  show_sensitive_data?: boolean;
  support_email?: string;
  support_phone?: string;
  main_url?: string;
  // Dados da organização
  person_type?: 'pf' | 'pj';
  company_name?: string;
  trade_name?: string;
  address?: string;
  document?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface BankingDetails {
  id: string;
  user_id: string;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pix_holder_name?: string;
  bank_code?: string;
  bank_name?: string;
  account_type?: 'corrente' | 'poupanca';
  agency?: string;
  account?: string;
  account_holder_name?: string;
  account_holder_cpf?: string;
  preferred_method?: 'PIX' | 'TED';
  payout_schedule?: 'after_event' | 'weekly' | 'monthly';
  created_at: string;
  updated_at: string;
}

export interface TransferLog {
  id: string;
  ticket_id: string;
  from_user_id?: string;
  to_email: string;
  to_user_id?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  initiated_at: string;
  resolved_at?: string;
  expires_at?: string;
}

export interface Cancellation {
  id: string;
  reservation_id: string;
  requested_by?: string;
  reason?: string;
  refund_amount?: number;
  refund_type?: 'total' | 'partial' | 'none';
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  processed_by?: string;
  processed_at?: string;
  gateway_refund_id?: string;
  notes?: string;
  created_at: string;
}

export interface SectorAccessCode {
  id: string;
  sector_id: string;
  code: string;
  label?: string;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ─── Inicialização do cliente ─────────────────────────────────
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ═══════════════════════════════════════════════════════════════
// AUTH — Login, Cadastro, Logout, Sessão
// ═══════════════════════════════════════════════════════════════

/** Cadastro de novo usuário */
export async function signUp(email: string, password: string, name: string, extraData?: Partial<Profile>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, ...extraData },
    },
  });
  if (error) throw error;
  return data;
}

/** Login com e-mail e senha */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Pegar sessão atual */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Pegar perfil do usuário logado */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Login especial para admin/staff (por username, não e-mail) */
export async function signInWithUsername(username: string, password: string) {
  // Busca o e-mail correspondente ao username na tabela profiles ou staff
  // Admin padrão: username='admin' → e-mail='admin@espacomix.internal'
  const adminEmail = `${username}@espacomix.internal`;

  // Tenta login de admin primeiro
  try {
    const result = await signIn(adminEmail, password);
    return result;
  } catch {
    // Se falhar, tenta login de staff
    const { data: staff, error } = await supabase
      .from('staff_accounts')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !staff) throw new Error('Usuário ou senha incorretos');

    // Verificação de senha do staff (no banco está armazenada como hash com crypt)
    // Para simplificar no MVP, comparar direto. Em produção, use pgcrypto no backend.
    if (staff.password !== password) throw new Error('Usuário ou senha incorretos');

    return { staff };
  }
}

/** Recuperar senha */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════════════════════

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════════

/** Buscar todos os eventos com lotes e setores aninhados */
export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      batches (
        *,
        sectors ( * )
      )
    `)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Event[];
}

/** Buscar eventos do usuário logado (criadores de eventos) */
export async function getMyEvents(userId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`*, batches(*, sectors(*))`)
    .eq('created_by', userId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Event[];
}

/** Buscar um evento específico */
export async function getEvent(eventId: number): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`*, batches(*, sectors(*))`)
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  return data as Event | null;
}

/** Criar novo evento */
export async function createEvent(event: Omit<Event, 'id' | 'batches'>): Promise<Event> {
  const { batches: _, ...eventData } = event as any;

  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (error) throw error;
  return data as Event;
}

/** Atualizar evento (salva lotes e setores também) */
export async function saveEvent(event: Event): Promise<Event> {
  const { batches, ...eventData } = event as any;

  // 1. Upsert do evento principal
  const { data: savedEvent, error: evErr } = await supabase
    .from('events')
    .upsert({ ...eventData, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (evErr) throw evErr;

  const currentBatchIds: string[] = [];
  const currentSectorIds: string[] = [];

  if (batches && batches.length > 0) {
    for (const batch of batches) {
      const { sectors, id, name, startDate, endDate, sort_order } = batch as any;

      // 2. Upsert do lote (mapeia camelCase → snake_case)
      const { data: savedBatch, error: bErr } = await supabase
        .from('batches')
        .upsert({
          id,
          name,
          start_date: startDate ?? batch.start_date,
          end_date: endDate ?? batch.end_date,
          sort_order,
          event_id: savedEvent.id,
        })
        .select()
        .single();

      if (bErr) throw bErr;
      currentBatchIds.push(savedBatch.id);

      if (sectors && sectors.length > 0) {
        // 3. Upsert dos setores (mapeia camelCase → snake_case)
        const sectorsToUpsert = sectors.map((s: any) => ({
          id: s.id,
          name: s.name,
          quantity: s.quantity,
          price: s.price,
          price_male: s.priceMale ?? s.price_male,
          price_female: s.priceFemale ?? s.price_female,
          convenience_fee: s.convenienceFee ?? s.convenience_fee,
          limit_per_user: s.limitPerUser ?? s.limit_per_user,
          visibility: s.visibility,
          description: s.description,
          batch_id: savedBatch.id,
          event_id: savedEvent.id,
        }));

        const { error: sErr } = await supabase
          .from('sectors')
          .upsert(sectorsToUpsert);

        if (sErr) throw sErr;

        sectors.forEach((s: any) => currentSectorIds.push(s.id));
      }
    }
  }

  // 4. Remover lotes e setores que foram excluídos na UI
  if (currentSectorIds.length > 0) {
    await supabase
      .from('sectors')
      .delete()
      .eq('event_id', savedEvent.id)
      .not('id', 'in', `(${currentSectorIds.join(',')})`);
  } else {
    await supabase.from('sectors').delete().eq('event_id', savedEvent.id);
  }

  if (currentBatchIds.length > 0) {
    await supabase
      .from('batches')
      .delete()
      .eq('event_id', savedEvent.id)
      .not('id', 'in', `(${currentBatchIds.join(',')})`);
  } else {
    await supabase.from('batches').delete().eq('event_id', savedEvent.id);
  }

  return savedEvent as Event;
}

/** Upload de imagem do evento para o Supabase Storage */
export async function uploadEventImage(file: File, eventId: number): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `events/${eventId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('event-images')
    .getPublicUrl(path);

  return publicUrl;
}

/** Deletar evento (cascata: lotes e setores são deletados automaticamente) */
export async function deleteEvent(eventId: number): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

/** Atualizar status do evento */
export async function updateEventStatus(
  eventId: number,
  status: Event['status']
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// RESERVAS
// ═══════════════════════════════════════════════════════════════

/** Criar reserva + tickets */
export async function createReservation(
  reservation: Omit<Reservation, 'id' | 'created_at' | 'ticket_items'>,
  ticketItems: Omit<TicketItem, 'id' | 'created_at'>[]
): Promise<Reservation> {
  // 1. Criar a reserva
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .insert(reservation)
    .select()
    .single();

  if (resErr) throw resErr;

  // 2. Criar os ticket_items
  if (ticketItems.length > 0) {
    const itemsToInsert = ticketItems.map(t => ({
      ...t,
      reservation_id: res.id,
    }));

    const { error: tiErr } = await supabase
      .from('ticket_items')
      .insert(itemsToInsert);

    if (tiErr) throw tiErr;
  }

  return res as Reservation;
}

/** Buscar reservas do usuário logado */
export async function getMyReservations(userId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`*, ticket_items(*)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Reservation[];
}

/** Buscar reservas de um evento (para admin/organizador) */
export async function getEventReservations(eventId: number): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`*, ticket_items(*)`)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Reservation[];
}

/** Atualizar status de pagamento (chamado pelo webhook do MP/Stripe) */
export async function updateReservationPayment(
  reservationId: string,
  status: Reservation['payment_status'],
  paymentId?: string
): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({
      payment_status: status,
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId);

  if (error) throw error;
}

/** Check-in de ingresso */
export async function checkInTicket(ticketId: string): Promise<TicketItem> {
  const { data, error } = await supabase
    .from('ticket_items')
    .update({ status: 'active', checked_in_at: new Date().toISOString() })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  return data as TicketItem;
}

/** Buscar ticket por QR code ID */
export async function getTicketById(ticketId: string): Promise<TicketItem | null> {
  const { data, error } = await supabase
    .from('ticket_items')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (error) return null;
  return data as TicketItem;
}

// ═══════════════════════════════════════════════════════════════
// STAFF
// ═══════════════════════════════════════════════════════════════

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  const { data, error } = await supabase
    .from('staff_accounts')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as StaffAccount[];
}

export async function createStaffAccount(
  staff: Omit<StaffAccount, 'id'>
): Promise<StaffAccount> {
  const { data, error } = await supabase
    .from('staff_accounts')
    .insert(staff)
    .select()
    .single();
  if (error) throw error;
  return data as StaffAccount;
}

export async function deleteStaffAccount(staffId: string): Promise<void> {
  const { error } = await supabase
    .from('staff_accounts')
    .update({ is_active: false })
    .eq('id', staffId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// CANDIDATURAS DE PRODUTOR
// ═══════════════════════════════════════════════════════════════

export async function getPendingApplications(): Promise<ProducerApplication[]> {
  const { data, error } = await supabase
    .from('producer_applications')
    .select('*, profiles!producer_applications_user_id_fkey(name, email, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProducerApplication[];
}

export async function submitProducerApplication(
  application: Omit<ProducerApplication, 'id' | 'status' | 'created_at'>
): Promise<ProducerApplication> {
  const { data, error } = await supabase
    .from('producer_applications')
    .insert({ ...application, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as ProducerApplication;
}

export async function approveProducer(
  applicationId: string,
  userId: string,
  reviewerId: string
): Promise<void> {
  // 1. Aprovar a candidatura
  const { error: appErr } = await supabase
    .from('producer_applications')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (appErr) throw appErr;

  // 2. Ativar flag no perfil do usuário
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ is_approved_event_creator: true })
    .eq('id', userId);

  if (profErr) throw profErr;
}

export async function rejectProducer(
  applicationId: string,
  reviewerId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('producer_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  id: 'main',
  site_name: 'Espaço Mix',
};

export async function getSystemConfig(): Promise<SystemConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

  if (error) throw error;
  return (data as SystemConfig) ?? DEFAULT_SYSTEM_CONFIG;
}

export async function updateSystemConfig(
  updates: Partial<SystemConfig>
): Promise<void> {
  const { error } = await supabase
    .from('system_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'main');

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// REAL-TIME — Ouvintes de mudanças ao vivo
// ═══════════════════════════════════════════════════════════════

/** Ouvir mudanças nos eventos em tempo real */
export function subscribeToEvents(callback: (events: Event[]) => void) {
  const channel = supabase
    .channel('events-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      async () => {
        const events = await getEvents();
        callback(events);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/** Ouvir mudanças nas reservas de um evento */
export function subscribeToEventReservations(
  eventId: number,
  callback: (reservations: Reservation[]) => void
) {
  const channel = supabase
    .channel(`reservations-event-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        const reservations = await getEventReservations(eventId);
        callback(reservations);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/** Ouvir candidaturas pendentes (painel admin) */
export function subscribeToPendingApplications(
  callback: (count: number) => void
) {
  const channel = supabase
    .channel('pending-applications')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'producer_applications',
        filter: `status=eq.pending`,
      },
      async () => {
        const apps = await getPendingApplications();
        callback(apps.length);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ═══════════════════════════════════════════════════════════════
// DADOS BANCÁRIOS DO PRODUTOR
// ═══════════════════════════════════════════════════════════════

export async function getBankingDetails(userId: string): Promise<BankingDetails | null> {
  const { data, error } = await supabase
    .from('banking_details')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as BankingDetails | null;
}

export async function saveBankingDetails(
  userId: string,
  details: Omit<BankingDetails, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<BankingDetails> {
  const { data, error } = await supabase
    .from('banking_details')
    .upsert({ ...details, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data as BankingDetails;
}

// ═══════════════════════════════════════════════════════════════
// TRANSFERÊNCIAS DE INGRESSOS
// ═══════════════════════════════════════════════════════════════

export async function initiateTransfer(
  ticketId: string,
  fromUserId: string,
  toEmail: string,
  expiresInHours = 48
): Promise<TransferLog> {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data: log, error: logErr } = await supabase
    .from('transfer_logs')
    .insert({ ticket_id: ticketId, from_user_id: fromUserId, to_email: toEmail, expires_at: expiresAt })
    .select()
    .single();

  if (logErr) throw logErr;

  const { error: ticketErr } = await supabase
    .from('ticket_items')
    .update({ status: 'pending_transfer', pending_transfer_email: toEmail })
    .eq('id', ticketId);

  if (ticketErr) throw ticketErr;

  return log as TransferLog;
}

export async function resolveTransfer(
  transferId: string,
  resolution: 'accepted' | 'rejected' | 'cancelled',
  toUserId?: string
): Promise<void> {
  const { data: log, error: fetchErr } = await supabase
    .from('transfer_logs')
    .select('ticket_id')
    .eq('id', transferId)
    .single();

  if (fetchErr) throw fetchErr;

  await supabase
    .from('transfer_logs')
    .update({ status: resolution, resolved_at: new Date().toISOString(), to_user_id: toUserId })
    .eq('id', transferId);

  if (resolution === 'accepted') {
    await supabase
      .from('ticket_items')
      .update({ status: 'transferred', pending_transfer_email: null, original_buyer_id: toUserId })
      .eq('id', log.ticket_id);
  } else {
    await supabase
      .from('ticket_items')
      .update({ status: 'active', pending_transfer_email: null })
      .eq('id', log.ticket_id);
  }
}

export async function getTransferLogs(ticketId: string): Promise<TransferLog[]> {
  const { data, error } = await supabase
    .from('transfer_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('initiated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TransferLog[];
}

// ═══════════════════════════════════════════════════════════════
// CANCELAMENTOS E REEMBOLSOS
// ═══════════════════════════════════════════════════════════════

export async function requestCancellation(
  reservationId: string,
  requestedBy: string,
  reason: string,
  refundType: Cancellation['refund_type'] = 'total'
): Promise<Cancellation> {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('total')
    .eq('id', reservationId)
    .single();

  const { data, error } = await supabase
    .from('cancellations')
    .insert({
      reservation_id: reservationId,
      requested_by: requestedBy,
      reason,
      refund_type: refundType,
      refund_amount: reservation?.total ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Cancellation;
}

export async function processCancellation(
  cancellationId: string,
  processedBy: string,
  status: 'approved' | 'rejected',
  gatewayRefundId?: string,
  notes?: string
): Promise<void> {
  const { data: cancellation, error: fetchErr } = await supabase
    .from('cancellations')
    .select('reservation_id')
    .eq('id', cancellationId)
    .single();

  if (fetchErr) throw fetchErr;

  await supabase
    .from('cancellations')
    .update({
      status: status === 'approved' ? 'processed' : 'rejected',
      processed_by: processedBy,
      processed_at: new Date().toISOString(),
      gateway_refund_id: gatewayRefundId,
      notes,
    })
    .eq('id', cancellationId);

  if (status === 'approved') {
    await supabase
      .from('reservations')
      .update({ payment_status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', cancellation.reservation_id);
  }
}

export async function getCancellations(reservationId: string): Promise<Cancellation[]> {
  const { data, error } = await supabase
    .from('cancellations')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Cancellation[];
}

// ═══════════════════════════════════════════════════════════════
// CÓDIGOS DE ACESSO A SETORES PRIVADOS
// ═══════════════════════════════════════════════════════════════

export async function createSectorAccessCode(
  sectorId: string,
  code: string,
  options?: { label?: string; maxUses?: number; expiresAt?: string }
): Promise<SectorAccessCode> {
  const { data, error } = await supabase
    .from('sector_access_codes')
    .insert({
      sector_id: sectorId,
      code: code.toUpperCase().trim(),
      label: options?.label,
      max_uses: options?.maxUses,
      expires_at: options?.expiresAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SectorAccessCode;
}

export async function validateSectorCode(sectorId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('validate_sector_code', { p_sector_id: sectorId, p_code: code });
  if (error) throw error;
  return data as boolean;
}

export async function getSectorAccessCodes(sectorId: string): Promise<SectorAccessCode[]> {
  const { data, error } = await supabase
    .from('sector_access_codes')
    .select('*')
    .eq('sector_id', sectorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SectorAccessCode[];
}

// ═══════════════════════════════════════════════════════════════
// AUDITORIA
// ═══════════════════════════════════════════════════════════════

export async function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  changes?: Record<string, any>
): Promise<void> {
  await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes,
      ip_address: null,
    });
}

export async function getAuditLogs(filters?: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters?.entityId)   query = query.eq('entity_id', filters.entityId);
  if (filters?.userId)     query = query.eq('user_id', filters.userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditLog[];
}