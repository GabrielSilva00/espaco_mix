import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { sendConfirmationEmail, sendReminderEmails, sendTestEmail, resolveEmailConfig, sendTransferInvitation } from "./emailService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

// ─── Mascaramento de dados sensíveis ────────────────────────────────────────

function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

// ─── Criptografia AES-256-CBC ────────────────────────────────────────────────

function getEncKey(): Buffer {
  // Normaliza o valor da env: na Vercel é comum colar a chave com aspas, espaços
  // ou quebra de linha invisível, fazendo o tamanho passar de 64 e estourar a
  // validação (origem do erro "ENCRYPTION_KEY deve ter 64 caracteres" em prod).
  const hex = (process.env.ENCRYPTION_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes). Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(hex, "hex");
}

function encryptData(data: string): string {
  const key = getEncKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return "enc:" + iv.toString("hex") + ":" + encrypted;
}

function decryptData(value: string): string {
  if (!value.startsWith("enc:")) return value; // Dado legado em plaintext
  const parts = value.split(":");
  const iv = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncKey(), iv);
  let decrypted = decipher.update(parts[2], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Descriptografa sem derrubar a requisição: se a chave estiver ausente/errada
// ou o valor corrompido, loga e devolve string vazia em vez de lançar 500.
function safeDecrypt(value: string | null | undefined): string | null | undefined {
  if (!value || !value.startsWith("enc:")) return value;
  try {
    return decryptData(value);
  } catch (err: any) {
    console.error("[PROFILE] Falha ao descriptografar campo sensível:", err?.message ?? err);
    return "";
  }
}

// ─── Hash de Senha (scrypt) ──────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return "scrypt:" + salt.toString("hex") + ":" + hash.toString("hex");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("scrypt:")) {
    // Senha legada em plaintext — comparação direta
    return password === stored;
  }
  const [, saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return crypto.timingSafeEqual(hash, storedHash);
}

// ─── Token de Staff (equipe de portaria) ─────────────────────────────────────
// A equipe de portaria NÃO usa Supabase Auth — ela loga em /api/staff/login e
// recebe este token assinado (HMAC). Contém o(s) evento(s) vinculado(s); o
// check-in só autoriza ingressos desses eventos. Formato: staff.<payload>.<sig>
interface StaffTokenPayload { sid: string; name: string; eventIds: string[]; exp: number; }

function staffSecret(): string {
  return process.env.CRON_SECRET || process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "staff-fallback-secret";
}

function signStaffToken(payload: StaffTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", staffSecret()).update(body).digest("base64url");
  return `staff.${body}.${sig}`;
}

function verifyStaffToken(token: string): StaffTokenPayload | null {
  if (!token.startsWith("staff.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  const expected = crypto.createHmac("sha256", staffSecret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StaffTokenPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ─── Config (module-level para ser compartilhado entre dev e serverless) ─────

const isProduction = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL;
const paymentProvider = process.env.PAYMENT_PROVIDER ?? (isProduction ? "disabled" : "mock");

async function getPaymentProvider(): Promise<string> {
  const admin = await getAdminClient();
  if (admin) {
    const { data } = await admin.from("system_config").select("payment_provider").eq("id", "main").maybeSingle();
    if (data?.payment_provider) return data.payment_provider as string;
  }
  return paymentProvider;
}

// ─── Credenciais MP em memória (definidas via painel admin) ──────────────────
// Persiste até reiniciar o servidor; process.env tem prioridade em produção.
let runtimeMpAccessToken = "";
let runtimeMpPublicKey = "";

// ─── Credenciais MP em runtime: env → memória → banco (app_secrets/config) ───
// O admin configura pelo painel (Acesso Master); o segredo fica criptografado em
// app_secrets e a public key (não-secreta) em system_config. Cache curto p/ não
// consultar o banco a cada pagamento.
let mpCache: { accessToken: string; publicKey: string } | null = null;
let mpCacheAt = 0;
function invalidateMpCache() { mpCache = null; mpCacheAt = 0; }

async function getMpCredentials(): Promise<{ accessToken: string; publicKey: string }> {
  const envToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
  const envKey = process.env.VITE_MERCADOPAGO_PUBLIC_KEY || "";
  if (envToken) return { accessToken: envToken, publicKey: envKey || runtimeMpPublicKey };
  if (runtimeMpAccessToken) return { accessToken: runtimeMpAccessToken, publicKey: runtimeMpPublicKey || envKey };
  if (mpCache && Date.now() - mpCacheAt < 30000) return mpCache;
  try {
    const admin = await getAdminClient();
    if (admin) {
      const [{ data: sec }, { data: cfg }] = await Promise.all([
        admin.from("app_secrets").select("mp_access_token").eq("id", "main").maybeSingle(),
        admin.from("system_config").select("mp_public_key").eq("id", "main").maybeSingle(),
      ]);
      const accessToken = sec?.mp_access_token ? (safeDecrypt(sec.mp_access_token) || "") : "";
      mpCache = { accessToken, publicKey: cfg?.mp_public_key || envKey };
      mpCacheAt = Date.now();
      return mpCache;
    }
  } catch (e: any) {
    console.error("[MP] Falha ao ler credenciais do banco:", e?.message ?? e);
  }
  return { accessToken: "", publicKey: envKey };
}
async function getMpAccessToken(): Promise<string> { return (await getMpCredentials()).accessToken; }

// ─── Cliente Supabase com service role (admin) ───────────────────────────────
async function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
}

// ─── Papel do usuário (autorização) ──────────────────────────────────────────
async function getProfileRole(uid: string): Promise<string | null> {
  const admin = await getAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
  return (data?.role as string) ?? null;
}

// ─── Mapeia status do Mercado Pago → status interno da reserva ───────────────
function mpStatusToReservation(mpStatus: string): string | null {
  const map: Record<string, string> = {
    approved: "approved",
    authorized: "approved",
    pending: "pending",
    in_process: "pending",
    in_mediation: "pending",
    rejected: "cancelled",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "refunded",
  };
  return map[mpStatus] ?? null;
}

// ─── Normaliza status da Orders API (/v1/orders) → vocabulário legado ────────
// A Orders API usa status próprios (processed/processing/failed...). Converte
// para o vocabulário que o frontend já entende (approved/pending/rejected),
// evitando mudanças no cliente.
function orderStatusToNormalized(status?: string): "approved" | "pending" | "rejected" | "refunded" | "unknown" {
  const map: Record<string, "approved" | "pending" | "rejected" | "refunded"> = {
    processed: "approved",
    accredited: "approved",
    approved: "approved",
    processing: "pending",
    pending: "pending",
    action_required: "pending",
    at_terminal: "pending",
    failed: "rejected",
    rejected: "rejected",
    cancelled: "rejected",
    canceled: "rejected",
    refunded: "refunded",
    partially_refunded: "refunded",
  };
  return map[status ?? ""] ?? "unknown";
}

// ─── E-mail do pagador compatível com o ambiente ─────────────────────────────
// Em sandbox o Mercado Pago EXIGE que o e-mail do pagador contenha "@testuser.com"
// (senão: invalid_email_for_sandbox). Em produção usa o e-mail real do comprador.
function payerEmailForEnv(email?: string): string {
  if (isProduction) return email || "comprador@email.com";
  const local = (email || "comprador").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "comprador";
  return `test_${local}@testuser.com`;
}

// ─── Consulta o status REAL de um pagamento no MP ────────────────────────────
// O id da notificação pode ser de uma order (Orders API) ou de um payment
// (legado); tenta /v1/orders primeiro e cai para /v1/payments.
type MpPaymentInfo = { externalRef?: string; normalized: string; resolvedPaymentId: string };

async function resolveMpPayment(mpId: string, accessToken: string): Promise<MpPaymentInfo | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${mpId}`, { headers });
  if (orderRes.ok) {
    const order: any = await orderRes.json();
    const pay = order?.transactions?.payments?.[0] ?? {};
    return {
      externalRef: order?.external_reference ?? undefined,
      normalized: orderStatusToNormalized(pay?.status || order?.status),
      resolvedPaymentId: String(pay?.id ?? mpId),
    };
  }
  const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, { headers });
  if (!payRes.ok) {
    console.error("[MP] Falha ao consultar order/pagamento:", orderRes.status, payRes.status);
    return null;
  }
  const payment: any = await payRes.json();
  return {
    externalRef: payment?.external_reference ?? undefined,
    normalized: orderStatusToNormalized(payment?.status),
    resolvedPaymentId: String(mpId),
  };
}

// ─── Aplica o status confirmado à reserva (service role) ─────────────────────
// Casa por external_reference (id da reserva) ou, na falta, pelo payment_id já
// salvo. Retorna a reserva atingida para o chamador encadear o e-mail.
async function applyPaymentUpdate(
  admin: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>,
  info: MpPaymentInfo
): Promise<{ reservationId: string; newStatus: string } | null> {
  const newStatus = mpStatusToReservation(info.normalized);
  if (!newStatus) return null;
  let query = admin.from("reservations").update({
    payment_status: newStatus,
    payment_id: info.resolvedPaymentId,
    updated_at: new Date().toISOString(),
  });
  query = info.externalRef ? query.eq("id", info.externalRef) : query.eq("payment_id", info.resolvedPaymentId);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`Falha ao atualizar reserva: ${error.message}`);
  const reservationId = (data as any[])?.[0]?.id;
  if (!reservationId) return null;
  return { reservationId: String(reservationId), newStatus };
}

// ─── E-mail de confirmação a partir do BANCO (fonte da verdade) ──────────────
// O claim atômico em confirmation_email_sent_at garante envio único mesmo com
// webhooks duplicados ou corrida entre webhook e rota de cartão/polling.
// force=true (reenvio manual pelo painel) ignora o claim.
async function sendReservationConfirmation(
  admin: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>,
  reservationId: string,
  opts: { force?: boolean } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const now = new Date().toISOString();
  if (opts.force) {
    await admin.from("reservations").update({ confirmation_email_sent_at: now }).eq("id", reservationId);
  } else {
    const { data: claimed, error: claimErr } = await admin
      .from("reservations")
      .update({ confirmation_email_sent_at: now })
      .eq("id", reservationId)
      .is("confirmation_email_sent_at", null)
      .select("id");
    if (claimErr) throw new Error(`Falha no claim do e-mail: ${claimErr.message}`);
    if (!claimed || claimed.length === 0) return { sent: false, reason: "e-mail já enviado anteriormente" };
  }

  const releaseClaim = async () => {
    try {
      await admin.from("reservations").update({ confirmation_email_sent_at: null }).eq("id", reservationId);
    } catch { /* melhor-esforço: o reenvio manual cobre o claim preso */ }
  };

  try {
    const { data: reservation, error } = await admin
      .from("reservations")
      .select("id, buyer_name, buyer_email, total, payment_method, payment_status, event_id, ticket_items(id, name, status)")
      .eq("id", reservationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reservation) throw new Error("Reserva não encontrada.");
    if (reservation.payment_status !== "approved") {
      await releaseClaim();
      return { sent: false, reason: `reserva não aprovada (${reservation.payment_status})` };
    }
    if (!reservation.buyer_email) {
      await releaseClaim();
      return { sent: false, reason: "reserva sem e-mail do comprador" };
    }

    const { data: event } = await admin
      .from("events")
      .select("title, date, time, location")
      .eq("id", reservation.event_id)
      .maybeSingle();

    const tickets = ((reservation as any).ticket_items ?? [])
      .filter((t: any) => t.status !== "cancelled")
      .map((t: any) => ({ id: String(t.id), name: String(t.name ?? "Ingresso") }));

    const sent = await sendConfirmationEmail({
      buyerName: reservation.buyer_name ?? "Cliente",
      buyerEmail: reservation.buyer_email,
      reservationId: reservation.id,
      eventTitle: event?.title ?? "Evento",
      eventDate: event?.date ?? "",
      eventTime: event?.time ?? undefined,
      eventLocation: event?.location ?? "",
      total: Number(reservation.total ?? 0),
      paymentMethod: reservation.payment_method ?? "pix",
      tickets,
    });
    if (!sent) return { sent: false, reason: "notificação de compra desativada no painel" };
    return { sent: true };
  } catch (err: any) {
    await releaseClaim();
    try {
      await admin.from("audit_logs").insert({
        user_id: null,
        action: "email_confirmation_failed",
        entity_type: "reservation",
        entity_id: reservationId,
        changes: { error: String(err?.message ?? err) },
      });
    } catch { /* auditoria é melhor-esforço */ }
    console.error(`[EMAIL] Falha na confirmação da reserva ${reservationId}:`, err?.message ?? err);
    return { sent: false, reason: String(err?.message ?? err) };
  }
}

// ─── Parse de JSON tolerante a falhas ────────────────────────────────────────
function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ─── Assinatura stateless de OTP (HMAC) ──────────────────────────────────────
// Em vez de guardar o código em memória (que não sobrevive ao serverless da
// Vercel — instâncias diferentes para enviar e verificar), assinamos
// email+código+expiração e devolvemos o "ticket" ao cliente. A verificação
// recalcula a assinatura, sem precisar de estado compartilhado.
function signOtp(email: string, code: string, exp: number): string {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "otp-fallback-secret";
  return crypto.createHmac("sha256", key).update(`${email.trim().toLowerCase()}:${code}:${exp}`).digest("hex");
}

// ─── Escape de HTML (previne injeção em corpos de e-mail) ────────────────────
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Cálculo autoritativo do valor do pedido (anti-fraude) ───────────────────
// Recalcula o total no servidor a partir dos preços do banco, ignorando
// qualquer valor enviado pelo cliente. Espelha a lógica de derivedTables /
// ticketsTotal do frontend (AppContext.tsx).
const PLATFORM_FEE_RATE = 0.10; // fallback quando system_config não está disponível
const DEFAULT_TICKET_PRICE = 50; // EVENT_TICKET_PRICE (fallback sem setor)

async function getPlatformFeeRates(): Promise<{ platformRate: number; gatewayRate: number; feeType: 'percentage' | 'fixed'; feeRaw: number }> {
  try {
    const admin = await getAdminClient();
    if (!admin) return { platformRate: PLATFORM_FEE_RATE, gatewayRate: 0, feeType: 'percentage', feeRaw: PLATFORM_FEE_RATE * 100 };
    const { data } = await admin.from("system_config").select("platform_fee_percent, gateway_fee_percent, platform_fee_type").eq("id", "main").maybeSingle();
    const feeRaw = typeof data?.platform_fee_percent === "number" ? data.platform_fee_percent : PLATFORM_FEE_RATE * 100;
    const feeType: 'percentage' | 'fixed' = data?.platform_fee_type === 'fixed' ? 'fixed' : 'percentage';
    return {
      platformRate: feeType === 'percentage' ? feeRaw / 100 : PLATFORM_FEE_RATE,
      gatewayRate: typeof data?.gateway_fee_percent === "number" ? data.gateway_fee_percent / 100 : 0,
      feeType,
      feeRaw,
    };
  } catch {
    return { platformRate: PLATFORM_FEE_RATE, gatewayRate: 0, feeType: 'percentage', feeRaw: PLATFORM_FEE_RATE * 100 };
  }
}

interface OrderSelection {
  eventId?: number | string;
  tables?: unknown;
  singleTickets?: number;
  maleTickets?: number;
  femaleTickets?: number;
  sectorId?: string;
}

async function computeOrderTotal(sel: OrderSelection): Promise<number> {
  const admin = await getAdminClient();
  if (!admin) throw new Error("Serviço de validação de preço não configurado.");

  if (sel.eventId === undefined || sel.eventId === null || sel.eventId === "") {
    throw new Error("Evento do pedido não informado.");
  }

  const { data: event, error: evErr } = await admin
    .from("events")
    .select("price_type, has_tables, table_total, total_bistros, table_price, bistro_price, table_seats, table_layout")
    .eq("id", sel.eventId)
    .maybeSingle();
  if (evErr || !event) throw new Error("Evento não encontrado.");

  const tables = Array.isArray(sel.tables) ? sel.tables.map(Number) : [];
  const singleTickets = Math.max(0, Math.floor(Number(sel.singleTickets) || 0));
  const maleTickets = Math.max(0, Math.floor(Number(sel.maleTickets) || 0));
  const femaleTickets = Math.max(0, Math.floor(Number(sel.femaleTickets) || 0));

  // ── Mesas ──────────────────────────────────────────────────────────────
  let tablesTotal = 0;
  if (tables.length > 0) {
    const tablePrice = event.table_price ?? 300;
    const bistroPrice = event.bistro_price ?? 200;
    const layout: any[] = Array.isArray(event.table_layout) ? event.table_layout : [];
    const layoutTables = layout.filter(
      (el) => el?.type === "round-table" || el?.type === "rect-table" || el?.type === "bistro-table"
    );

    const priceById = new Map<number, number>();
    if (layoutTables.length > 0) {
      layoutTables.forEach((el, i) => {
        const def = el.type === "bistro-table" ? bistroPrice : tablePrice;
        priceById.set(i + 1, typeof el.price === "number" ? el.price : def);
      });
    } else {
      const totalTables = event.table_total ?? 20;
      const totalBistros = event.total_bistros ?? 0;
      for (let i = 0; i < totalTables; i++) priceById.set(i + 1, tablePrice);
      for (let i = 0; i < totalBistros; i++) priceById.set(totalTables + i + 1, bistroPrice);
    }

    for (const id of tables) {
      const p = priceById.get(id);
      if (p === undefined) throw new Error("Mesa selecionada inválida.");
      tablesTotal += p;
    }
  }

  // ── Ingressos ──────────────────────────────────────────────────────────
  let ticketsTotal = 0;
  if (singleTickets > 0 || maleTickets > 0 || femaleTickets > 0) {
    let sector: any = null;
    if (sel.sectorId) {
      const { data } = await admin
        .from("sectors")
        .select("price, price_male, price_female, event_id")
        .eq("id", sel.sectorId)
        .maybeSingle();
      sector = data;
      if (sector && Number(sector.event_id) !== Number(sel.eventId)) {
        throw new Error("Setor não pertence ao evento.");
      }
    }
    if (event.price_type === "gender") {
      ticketsTotal = maleTickets * (sector?.price_male ?? 0) + femaleTickets * (sector?.price_female ?? 0);
    } else {
      ticketsTotal = singleTickets * (sector?.price ?? DEFAULT_TICKET_PRICE);
    }
  }

  const subTotal = tablesTotal + ticketsTotal;
  return Math.round(subTotal * 100) / 100;
}

// ─── Mesas ocupadas de um evento (reservas pagas OU pendentes) ───────────────
// Retorna apenas NÚMEROS de mesa (sem dados pessoais) — usado para bloquear
// dupla reserva no checkout e marcar mesas como indisponíveis no mapa.
async function getOccupiedTables(admin: any, eventId: number | string): Promise<number[]> {
  const { data, error } = await admin
    .from("reservations")
    .select("tables, payment_status")
    .eq("event_id", eventId)
    .in("payment_status", ["approved", "pending"]);
  if (error) throw error;
  const set = new Set<number>();
  (data ?? []).forEach((r: any) => {
    (Array.isArray(r.tables) ? r.tables : []).forEach((t: any) => set.add(Number(t)));
  });
  return [...set];
}

// ─── Validação de ambiente no startup ────────────────────────────────────────
// Apenas avisa (não derruba o servidor): facilita diagnosticar deploy com env
// incompleta na Vercel sem quebrar ambientes de desenvolvimento.
function validateEnv() {
  const warn = (msg: string) => console.warn(`[STARTUP] ${msg}`);

  if (!process.env.VITE_SUPABASE_URL) {
    warn("VITE_SUPABASE_URL ausente — integrações com o banco não funcionarão.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warn("SUPABASE_SERVICE_ROLE_KEY ausente — webhook, pagamentos e e-mail não funcionarão.");
  }
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) {
    warn("ENCRYPTION_KEY ausente — segredos salvos no painel admin (SMTP/MP) não poderão ser lidos.");
  } else if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    warn("ENCRYPTION_KEY em formato inválido — esperado 64 caracteres hex (32 bytes).");
  }
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    warn("MERCADOPAGO_WEBHOOK_SECRET ausente — webhooks do Mercado Pago serão aceitos SEM validação de assinatura.");
  }
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    warn("Nenhum provedor de e-mail em env (RESEND_API_KEY/SMTP_HOST) — usará apenas a config do painel admin, se houver.");
  }
}

// ─── Express app factory ─────────────────────────────────────────────────────

export async function createExpressApp() {
  validateEnv();
  const app = express();
  app.set('trust proxy', 1);

  if (isProduction && !appUrl) {
    throw new Error("APP_URL é obrigatória em produção para configurar CORS.");
  }

  // ── HTTPS redirect (produção) ─────────────────────────────────────────────
  if (isProduction) {
    app.use((req, res, next) => {
      const proto = req.header("x-forwarded-proto") ?? req.protocol;
      if (proto !== "https") {
        res.redirect(301, `https://${req.header("host")}${req.url}`);
        return;
      }
      next();
    });
  }

  // ── Security Headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "https://secure.mlstatic.com"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'", "https://*.supabase.co", "https://*.mercadopago.com", "https://*.mercadolibre.com"],
              fontSrc: ["'self'", "data:"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      // X-Frame-Options: DENY — impede clickjacking
      frameguard: { action: "deny" },
      // Referrer-Policy — não vaza URL em requisições cross-origin
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // HSTS — força HTTPS por 1 ano (apenas produção)
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      // Bloqueia plugins Flash/PDF cross-domain
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
    })
  );

  app.use(
    cors({
      origin: isProduction ? appUrl : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  });

  const paymentLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de pagamento. Aguarde 10 minutos." },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de autenticação. Aguarde 15 minutos." },
  });

  // O polling de status do pagamento (PIX em aberto consulta a cada poucos
  // segundos) ficaria refém das 200 req/15min do limite global e derrubaria o
  // restante da API do mesmo IP — por isso tem um limite próprio, mais alto.
  const paymentStatusLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas consultas de status. Aguarde alguns minutos." },
  });

  // Aplica o limite global APENAS às rotas de API. No dev o Express serve
  // todos os módulos/assets via Vite middleware; limitá-los derrubaria o app
  // (cada page load = dezenas de requisições). Em produção o Express só atende /api.
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/payment/status/")) { next(); return; }
    globalLimiter(req, res, next);
  });

  // ── Auth Middleware ───────────────────────────────────────────────────────
  const requireAuth = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token de autenticação ausente." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user }, error } = await Promise.race([
          supabase.auth.getUser(token),
          new Promise<any>(resolve =>
            setTimeout(() => resolve({ data: { user: null }, error: new Error("timeout") }), 5000)
          ),
        ]);
        if (error || !user) {
          res.status(401).json({ error: "Token inválido ou expirado." });
          return;
        }
        (req as any).user = { uid: user.id, email: user.email };
      } catch {
        res.status(401).json({ error: "Falha ao verificar token." });
        return;
      }
    } else {
      // Dev fallback: aceita qualquer token não-vazio quando Supabase não está configurado
      (req as any).user = { uid: "dev-user", email: "dev@localhost" };
    }

    next();
  };

  // ── Admin Middleware (usar SEMPRE após requireAuth) ───────────────────────
  const requireAdmin = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const user = (req as any).user;
    if (!user?.uid) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) {
      // Sem service role: só liberamos em desenvolvimento. Em produção, falha fechado.
      if (!isProduction) {
        next();
        return;
      }
      res.status(503).json({ error: "Serviço de autorização não configurado." });
      return;
    }
    const { data } = await admin.from("profiles").select("role").eq("id", user.uid).maybeSingle();
    const role = data?.role;
    if (role !== "admin" && role !== "developer") {
      res.status(403).json({ error: "Acesso restrito a administradores." });
      return;
    }
    (req as any).userRole = role;
    next();
  };

  // ── Auth OU Staff ─────────────────────────────────────────────────────────
  // Usado só pelo check-in: aceita o token Supabase (admin/organizador) OU o
  // token de staff (equipe de portaria). Define req.staff quando for staff.
  const requireAuthOrStaff = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    if (token.startsWith("staff.")) {
      const staff = verifyStaffToken(token);
      if (!staff) {
        res.status(401).json({ result: "forbidden", error: "Sessão de portaria inválida ou expirada." });
        return;
      }
      (req as any).staff = staff;
      next();
      return;
    }
    return requireAuth(req, res, next);
  };

  // ── Staff: criar/listar/remover (admin) ───────────────────────────────────
  app.post("/api/staff", requireAuth, requireAdmin, async (req, res) => {
    const { name, username, password, eventIds } = req.body as {
      name?: string; username?: string; password?: string; eventIds?: (string | number)[];
    };
    if (!name?.trim() || !username?.trim() || !password) {
      res.status(400).json({ error: "Nome, usuário e senha são obrigatórios." });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const uname = username.trim().toLowerCase();
      const { data: existing } = await admin.from("staff_accounts").select("id").eq("username", uname).eq("is_active", true).maybeSingle();
      if (existing) { res.status(409).json({ error: "Já existe um colaborador com esse usuário." }); return; }
      const hashed = await hashPassword(password);
      const { data, error } = await admin.from("staff_accounts").insert({
        name: name.trim(),
        username: uname,
        password: hashed,
        event_ids: (eventIds ?? []).map(String),
        is_active: true,
      }).select("id, name, username, event_ids, is_active").single();
      if (error) throw error;
      res.status(201).json({ staff: data });
    } catch (e: any) {
      console.error("[STAFF] Falha ao criar:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível cadastrar o colaborador." });
    }
  });

  app.get("/api/staff", requireAuth, requireAdmin, async (_req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.json({ staff: [] }); return; }
    try {
      const { data, error } = await admin
        .from("staff_accounts")
        .select("id, name, username, event_ids, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      res.json({ staff: data ?? [] });
    } catch (e: any) {
      console.error("[STAFF] Falha ao listar:", e?.message ?? e);
      res.json({ staff: [] });
    }
  });

  app.delete("/api/staff/:id", requireAuth, requireAdmin, async (req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { error } = await admin.from("staff_accounts").update({ is_active: false }).eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      console.error("[STAFF] Falha ao remover:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível remover o colaborador." });
    }
  });

  app.patch("/api/staff/:id", requireAuth, requireAdmin, async (req, res) => {
    const { name, username, password } = req.body as { name?: string; username?: string; password?: string };
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const updates: Record<string, string> = {};
      if (name?.trim()) updates.name = name.trim();
      if (username?.trim()) updates.username = username.trim().toLowerCase().replace(/\s+/g, '_');
      if (password && password.length >= 6) {
        updates.password = await hashPassword(password);
      }
      if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nenhum dado para atualizar." }); return; }
      const { error } = await admin.from("staff_accounts").update(updates).eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      console.error("[STAFF] Falha ao editar:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível editar o colaborador." });
    }
  });

  // ── Staff: login da equipe de portaria ────────────────────────────────────
  app.post("/api/staff/login", authLimiter, async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username?.trim() || !password) {
      res.status(400).json({ error: "Informe usuário e senha." });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: staff } = await admin
        .from("staff_accounts")
        .select("id, name, username, password, event_ids, is_active")
        .eq("username", username.trim().toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      if (!staff || !(await verifyPassword(password, staff.password))) {
        res.status(401).json({ error: "Usuário ou senha incorretos." });
        return;
      }
      const eventIds = Array.isArray(staff.event_ids) ? staff.event_ids.map(String) : [];
      const token = signStaffToken({
        sid: staff.id, name: staff.name, eventIds,
        exp: Date.now() + 12 * 60 * 60 * 1000, // 12h
      });
      res.json({ token, staff: { id: staff.id, name: staff.name, eventIds } });
    } catch (e: any) {
      console.error("[STAFF] Falha no login:", e?.message ?? e);
      res.status(500).json({ error: "Erro ao autenticar." });
    }
  });

  // ── Staff: lista de ingressos do evento vinculado (para o check-in) ───────
  // A equipe de portaria não tem sessão Supabase/RLS; o servidor (service role)
  // devolve as reservas do(s) evento(s) vinculado(s) ao token de staff.
  app.get("/api/staff/event-tickets", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    const staff = verifyStaffToken(token);
    if (!staff) { res.status(401).json({ error: "Sessão de portaria inválida." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.json({ reservations: [] }); return; }
    try {
      const eventIds = (staff.eventIds ?? []).map(Number).filter(n => !Number.isNaN(n));
      if (eventIds.length === 0) { res.json({ reservations: [] }); return; }
      const { data, error } = await admin
        .from("reservations")
        .select("id, event_id, buyer_name, buyer_email, buyer_cpf, total, payment_status, payment_method, platform_fee, net_amount, tables, single_tickets, created_at, ticket_items(*)")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ reservations: data ?? [] });
    } catch (e: any) {
      console.error("[STAFF] Falha ao listar ingressos:", e?.message ?? e);
      res.json({ reservations: [] });
    }
  });

  // ── Dev TOTP Verify (server-side — segredo nunca vai ao frontend) ─────────
  app.post("/api/auth/dev-verify", authLimiter, (req, res) => {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      res.status(400).json({ valid: false });
      return;
    }
    const devSecret = process.env.DEV_TOTP;
    if (!devSecret) {
      res.status(403).json({ valid: false, error: "Dev login desabilitado." });
      return;
    }
    res.json({ valid: token === devSecret });
  });

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      environment: isProduction ? "production" : "development",
      paymentProvider,
      timestamp: new Date().toISOString(),
    });
  });

  // ── CPF Validation ────────────────────────────────────────────────────────
  app.post("/api/validate-cpf", authLimiter, (req, res) => {
    const { cpf } = req.body as { cpf?: string };
    if (!cpf || typeof cpf !== "string") {
      res.status(400).json({ error: "CPF ausente." });
      return;
    }
    const valid = validateCpf(cpf);
    res.json({ valid });
  });

  // ── Resolve Username → E-mail (login por nome de usuário) ───────────────────
  app.post("/api/auth/resolve-username", authLimiter, async (req, res) => {
    const { username } = req.body as { username?: string };
    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Usuário ausente." });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(503).json({ error: "Serviço de autenticação não configurado." });
      return;
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const { data, error } = await adminClient
        .from("profiles")
        .select("email")
        .ilike("username", username.trim())
        .maybeSingle();

      if (error) throw error;
      // Retorna apenas o e-mail (nunca outros dados do perfil)
      res.json({ email: data?.email ?? null });
    } catch (err: any) {
      console.error("[AUTH] Erro ao resolver username:", err.message);
      res.status(500).json({ error: "Erro ao resolver usuário." });
    }
  });

  // ── User Registration ─────────────────────────────────────────────────────
  app.post("/api/users/register", authLimiter, async (req, res) => {
    const { name, email, cpf, phone, birthDate, lgpdConsent } = req.body as {
      name?: string;
      email?: string;
      cpf?: string;
      phone?: string;
      birthDate?: string;
      lgpdConsent?: boolean;
    };

    const missing = [];
    if (!name?.trim() || name.trim().length < 2) missing.push("name");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("email");
    if (!cpf || !validateCpf(cpf)) missing.push("cpf");
    if (!lgpdConsent) missing.push("lgpdConsent");

    if (missing.length > 0) {
      res.status(400).json({
        error: "Dados obrigatórios ausentes ou inválidos.",
        fields: missing,
      });
      return;
    }

    const maskedEmail = email!.replace(/(^.).*(@.*$)/, "$1***$2");
    console.log(`[REGISTER] User registered: ${maskedEmail}`);

    res.status(201).json({
      success: true,
      message: "Usuário registrado com sucesso.",
    });
  });

  // ── Orders ────────────────────────────────────────────────────────────────
  app.post("/api/orders", requireAuth, async (req, res) => {
    const { eventId, items, total, paymentId, paymentMethod } = req.body as {
      eventId?: string | number;
      items?: unknown[];
      total?: number;
      paymentId?: string;
      paymentMethod?: string;
    };

    if (!eventId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Dados do pedido incompletos." });
      return;
    }

    if (typeof total !== "number" || total <= 0) {
      res.status(400).json({ error: "Valor total inválido." });
      return;
    }

    const allowedMethods = new Set(["pix", "credit_card", "debit_card", "boleto"]);
    if (!paymentMethod || !allowedMethods.has(paymentMethod)) {
      res.status(400).json({ error: "Forma de pagamento inválida." });
      return;
    }

    const user = (req as any).user;
    const orderId = "ORD-" + Math.random().toString(36).slice(2, 10).toUpperCase();

    console.log(`[ORDER] Created ${orderId} for user ${user?.uid} | total: R$${total}`);

    // TODO: persist order to Firestore when Firebase Admin SDK is configured.
    // const db = getFirestore();
    // await db.collection("orders").doc(orderId).set({ ... });

    res.status(201).json({
      orderId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  });

  // ── Mercado Pago - Test Connection ────────────────────────────────────────
  // ── Status do pagamento (read-only para o painel) ────────────────────────
  // Não expõe segredos: só informa SE está configurado, o ambiente e a public
  // key mascarada. As credenciais ficam nas variáveis de ambiente (Vercel).
  app.get("/api/admin/payment-status", requireAuth, requireAdmin, async (_req, res) => {
    const { accessToken, publicKey } = await getMpCredentials();
    const isProd = /^APP_USR-/.test(accessToken);
    const maskKey = (k: string) =>
      !k ? "" : k.length <= 12 ? k : `${k.slice(0, 8)}…${k.slice(-4)}`;
    res.json({
      provider: await getPaymentProvider(),
      configured: Boolean(accessToken),
      environment: accessToken ? (isProd ? "production" : "test") : "unset",
      publicKeyMasked: maskKey(publicKey),
      webhookConfigured: Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET),
    });
  });

  app.post("/api/admin/test-mercadopago", requireAuth, requireAdmin, async (req, res) => {
    const body = (req.body ?? {}) as { accessToken?: string; publicKey?: string };
    // Sem credenciais no corpo: testa as do SERVIDOR (env → memória → banco).
    const accessToken = body.accessToken || (await getMpAccessToken());

    if (!accessToken) {
      res.status(400).json({ error: "Nenhuma credencial do Mercado Pago configurada no servidor." });
      return;
    }

    try {
      // Teste simples: fazer uma requisição à API do Mercado Pago
      const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        console.log("[MERCADOPAGO] ✓ Credenciais válidas");
        res.json({ success: true, message: "Credenciais válidas! Conexão estabelecida." });
      } else {
        console.log("[MERCADOPAGO] ✗ Credenciais inválidas:", response.status);
        res.status(401).json({ error: "Credenciais inválidas ou expiradas." });
      }
    } catch (error) {
      console.error("[MERCADOPAGO] Erro ao testar:", error);
      res.status(500).json({ error: "Erro ao conectar com Mercado Pago." });
    }
  });

  // ── Definir credenciais MP em memória (painel admin) ─────────────────────
  app.post("/api/admin/set-mp-credentials", requireAuth, requireAdmin, (req, res) => {
    const { accessToken, publicKey } = req.body as { accessToken?: string; publicKey?: string };
    if (!accessToken || !publicKey) {
      res.status(400).json({ error: "accessToken e publicKey são obrigatórios." });
      return;
    }
    runtimeMpAccessToken = accessToken;
    runtimeMpPublicKey = publicKey;
    invalidateMpCache();
    console.log("[MP] Credenciais atualizadas via painel admin");
    res.json({ success: true });
  });

  // ── Salvar credenciais do Mercado Pago no banco (criptografadas) ──────────
  // O Access Token vai criptografado em app_secrets; a Public Key (não-secreta)
  // e o ambiente em system_config. Nada disso volta ao client.
  app.post("/api/admin/payment-credentials", requireAuth, requireAdmin, async (req, res) => {
    const { accessToken, publicKey, environment } = req.body as {
      accessToken?: string; publicKey?: string; environment?: string;
    };
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      if (accessToken && accessToken.trim()) {
        await admin.from("app_secrets").upsert({ id: "main", mp_access_token: encryptData(accessToken.trim()), updated_at: new Date().toISOString() });
      }
      const cfgUpdate: Record<string, any> = {};
      if (publicKey !== undefined) cfgUpdate.mp_public_key = publicKey.trim() || null;
      if (environment) cfgUpdate.mp_environment = environment;
      if (Object.keys(cfgUpdate).length) await admin.from("system_config").update(cfgUpdate).eq("id", "main");
      invalidateMpCache();
      res.json({ success: true });
    } catch (e: any) {
      console.error("[MP] Falha ao salvar credenciais:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível salvar as credenciais." });
    }
  });

  // ── Salvar configuração de e-mail (Resend ou SMTP) ───────────────────────
  app.post("/api/admin/email-config", requireAuth, requireAdmin, async (req, res) => {
    const { provider, resendApiKey, smtp, senderName, senderAddress, notifyWebhookUrl } = req.body as {
      provider?: string; resendApiKey?: string;
      smtp?: { host?: string; port?: number; user?: string; password?: string; secure?: boolean };
      senderName?: string; senderAddress?: string; notifyWebhookUrl?: string;
    };
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const secretUpdate: Record<string, any> = { id: "main", updated_at: new Date().toISOString() };
      if (resendApiKey && resendApiKey.trim()) secretUpdate.resend_api_key = encryptData(resendApiKey.trim());
      if (smtp?.password && smtp.password.trim()) secretUpdate.smtp_password = encryptData(smtp.password.trim());
      if (Object.keys(secretUpdate).length > 2) await admin.from("app_secrets").upsert(secretUpdate);

      const cfgUpdate: Record<string, any> = {};
      if (provider) cfgUpdate.email_provider = provider === "smtp" ? "smtp" : "resend";
      if (senderName !== undefined) cfgUpdate.email_sender_name = senderName || null;
      if (senderAddress !== undefined) cfgUpdate.email_sender_address = senderAddress || null;
      if (notifyWebhookUrl !== undefined) cfgUpdate.notify_webhook_url = notifyWebhookUrl || null;
      if (smtp) {
        if (smtp.host !== undefined) cfgUpdate.smtp_host = smtp.host || null;
        if (smtp.port !== undefined) cfgUpdate.smtp_port = smtp.port || null;
        if (smtp.user !== undefined) cfgUpdate.smtp_user = smtp.user || null;
        if (smtp.secure !== undefined) cfgUpdate.smtp_secure = !!smtp.secure;
      }
      if (Object.keys(cfgUpdate).length) await admin.from("system_config").update(cfgUpdate).eq("id", "main");
      res.json({ success: true });
    } catch (e: any) {
      console.error("[EMAIL] Falha ao salvar config:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível salvar a configuração de e-mail." });
    }
  });

  // ── Status do e-mail (sem expor segredos) ────────────────────────────────
  app.get("/api/admin/email-status", requireAuth, requireAdmin, async (_req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.json({ provider: "resend", configured: false }); return; }
    try {
      const [{ data: cfg }, { data: sec }] = await Promise.all([
        admin.from("system_config").select("email_provider, smtp_host, smtp_port, smtp_user, smtp_secure, email_sender_name, email_sender_address, notify_webhook_url").eq("id", "main").maybeSingle(),
        admin.from("app_secrets").select("resend_api_key, smtp_password").eq("id", "main").maybeSingle(),
      ]);
      const provider = (cfg?.email_provider === "smtp" ? "smtp" : "resend");
      const configured = provider === "smtp"
        ? Boolean(cfg?.smtp_host && sec?.smtp_password)
        : Boolean(sec?.resend_api_key || process.env.RESEND_API_KEY);
      res.json({
        provider, configured,
        senderName: cfg?.email_sender_name ?? "",
        senderAddress: cfg?.email_sender_address ?? "",
        smtpHost: cfg?.smtp_host ?? "",
        smtpPort: cfg?.smtp_port ?? "",
        smtpUser: cfg?.smtp_user ?? "",
        smtpSecure: cfg?.smtp_secure ?? true,
        notifyWebhookUrl: cfg?.notify_webhook_url ?? "",
      });
    } catch (e: any) {
      console.error("[EMAIL] Falha no status:", e?.message ?? e);
      res.json({ provider: "resend", configured: false });
    }
  });

  // ── Status das variáveis de ambiente (Categoria A) — apenas booleans ───────
  app.get("/api/admin/env-status", requireAuth, requireAdmin, (_req, res) => {
    res.json({
      ENCRYPTION_KEY:             !!process.env.ENCRYPTION_KEY,
      SUPABASE_SERVICE_ROLE_KEY:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      MERCADOPAGO_ACCESS_TOKEN:   !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
      RESEND_API_KEY:             !!process.env.RESEND_API_KEY,
      CRON_SECRET:                !!process.env.CRON_SECRET,
      STRIPE_SECRET_KEY:          !!process.env.STRIPE_SECRET_KEY,
      APP_URL:                    !!process.env.APP_URL,
    });
  });

  // ── Enviar e-mail de teste para o admin logado ───────────────────────────
  app.post("/api/admin/test-email", requireAuth, requireAdmin, async (req, res) => {
    const { to } = req.body as { to?: string };
    const user = (req as any).user;
    const target = (to && to.trim()) || user?.email;
    if (!target) { res.status(400).json({ error: "Informe um e-mail de destino." }); return; }
    try {
      await sendTestEmail(target);
      res.json({ success: true, message: `E-mail de teste enviado para ${target}.` });
    } catch (e: any) {
      console.error("[EMAIL] Falha no teste:", e?.message ?? e);
      res.status(500).json({ error: e?.message || "Falha ao enviar e-mail de teste." });
    }
  });

  // ── Criar reserva (convidado OU logado) ───────────────────────────────────
  // Roteada pelo servidor (service role) porque o cliente anônimo não tem
  // política de RLS para ler de volta a reserva criada (.select()) nem para
  // inserir ticket_items. O total é SEMPRE recalculado aqui (anti-fraude).
  app.post("/api/reservations", async (req, res) => {
    const { reservation, ticketItems } = req.body as {
      reservation?: any;
      ticketItems?: any[];
    };

    if (!reservation || typeof reservation !== "object") {
      res.status(400).json({ error: "Dados da reserva ausentes." });
      return;
    }

    const buyerName = String(reservation.buyer_name ?? "").trim();
    const buyerEmail = String(reservation.buyer_email ?? "").trim();
    const buyerCpf = String(reservation.buyer_cpf ?? "").trim();
    if (!buyerName || !buyerEmail) {
      res.status(400).json({ error: "Nome e e-mail do comprador são obrigatórios." });
      return;
    }

    const admin = await getAdminClient();
    if (!admin) {
      res.status(503).json({ error: "Serviço de reservas não configurado." });
      return;
    }

    // Auth opcional: se houver token válido, associa a reserva ao usuário.
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const { data: { user } } = await admin.auth.getUser(token);
        if (user) userId = user.id;
      } catch { /* token inválido → trata como convidado */ }
    }

    // Recálculo autoritativo do valor a partir dos preços do banco.
    const selection: OrderSelection = {
      eventId: reservation.event_id,
      tables: reservation.tables,
      singleTickets: reservation.single_tickets,
      maleTickets: reservation.male_tickets,
      femaleTickets: reservation.female_tickets,
      sectorId: reservation.sector_id,
    };
    let grandTotal: number;
    try {
      grandTotal = await computeOrderTotal(selection);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Não foi possível validar o valor do pedido." });
      return;
    }
    const { platformRate, feeType, feeRaw } = await getPlatformFeeRates();
    const platformFee = feeType === 'fixed'
      ? Math.round(Math.min(feeRaw, grandTotal) * 100) / 100
      : Math.round(grandTotal * platformRate * 100) / 100;
    const netAmount = Math.round((grandTotal - platformFee) * 100) / 100;

    // Bloqueia dupla reserva: rejeita se alguma mesa pedida já está ocupada.
    const requestedTables = Array.isArray(reservation.tables) ? reservation.tables.map(Number) : [];
    if (requestedTables.length > 0) {
      try {
        const occupied = new Set(await getOccupiedTables(admin, reservation.event_id));
        const conflict = requestedTables.filter((t: number) => occupied.has(t));
        if (conflict.length > 0) {
          res.status(409).json({ error: `Mesa(s) já reservada(s): ${conflict.join(", ")}. Atualize o mapa e escolha outra.` });
          return;
        }
      } catch (e: any) {
        console.error("[RESERVA] Falha ao checar mesas ocupadas:", e?.message);
      }
    }

    try {
      const { data: res1, error: resErr } = await admin
        .from("reservations")
        .insert({
          event_id: reservation.event_id,
          user_id: userId,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_cpf: buyerCpf,
          tables: Array.isArray(reservation.tables) ? reservation.tables : [],
          single_tickets: Math.max(0, Math.floor(Number(reservation.single_tickets) || 0)),
          male_tickets: Math.max(0, Math.floor(Number(reservation.male_tickets) || 0)),
          female_tickets: Math.max(0, Math.floor(Number(reservation.female_tickets) || 0)),
          total: grandTotal,
          platform_fee: platformFee,
          net_amount: netAmount,
          payment_status: "pending",
          payment_method: reservation.payment_method ?? null,
        })
        .select()
        .single();
      if (resErr) throw resErr;

      // ticket_items: sanitiza e força reservation_id/event_id no servidor.
      const items = Array.isArray(ticketItems) ? ticketItems.slice(0, 500) : [];
      let insertedItems: any[] = [];
      if (items.length > 0) {
        const toInsert = items.map((t) => ({
          reservation_id: res1.id,
          event_id: reservation.event_id,
          name: String(t?.name ?? "Ingresso"),
          is_table: Boolean(t?.is_table),
          table_number: t?.table_number ?? null,
          occupant_index: t?.occupant_index ?? null,
          owner_name: String(t?.owner_name ?? ""),
          owner_cpf: String(t?.owner_cpf ?? ""),
          owner_email: t?.owner_email ?? null,
          status: String(t?.status ?? "active"),
        }));
        // .select() retorna os ids reais (gerados no banco) — usados no QR Code
        // para que o check-in encontre o ingresso.
        const { data: ins, error: tiErr } = await admin.from("ticket_items").insert(toInsert).select();
        if (tiErr) throw tiErr;
        insertedItems = ins ?? [];
      }

      res.status(201).json({ reservation: res1, ticketItems: insertedItems });
    } catch (err: any) {
      console.error("[RESERVA] Falha ao criar reserva:", err?.message ?? err);
      res.status(500).json({ error: "Não foi possível registrar a reserva." });
    }
  });

  // ── Mesas ocupadas de um evento (público — só números, sem dados pessoais) ─
  app.get("/api/events/:eventId/occupied-tables", async (req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.json({ tables: [] }); return; }
    try {
      const tables = await getOccupiedTables(admin, req.params.eventId);
      res.json({ tables });
    } catch (e: any) {
      console.error("[OCCUPIED] Erro:", e?.message);
      res.json({ tables: [] });
    }
  });

  // ── Check-in de ingresso (valida o QR contra o banco) ─────────────────────
  // O QR do ingresso carrega o id do ticket_items. Valida pagamento aprovado e
  // duplicidade, e marca checked_in_at. Só admin/developer ou o organizador do
  // evento pode fazer check-in.
  app.post("/api/checkin", requireAuthOrStaff, async (req, res) => {
    const user = (req as any).user;
    const staff = (req as any).staff as StaffTokenPayload | undefined;
    const { ticketId } = req.body as { ticketId?: string };
    if (!ticketId || typeof ticketId !== "string") {
      res.status(400).json({ result: "notfound" });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) {
      res.status(503).json({ result: "error", error: "Serviço não configurado." });
      return;
    }
    try {
      const { data: ticket, error } = await admin
        .from("ticket_items")
        .select("id, reservation_id, event_id, name, owner_name, status, checked_in_at")
        .eq("id", ticketId.trim())
        .maybeSingle();
      if (error) throw error;
      if (!ticket) { res.json({ result: "notfound" }); return; }

      const { data: reservation } = await admin
        .from("reservations")
        .select("id, payment_status, buyer_name, event_id")
        .eq("id", ticket.reservation_id)
        .maybeSingle();

      // Autorização: equipe de portaria (só o evento vinculado) OU
      // admin/developer OU organizador (created_by) do evento.
      let allowed = false;
      if (staff) {
        allowed = Array.isArray(staff.eventIds) && staff.eventIds.map(String).includes(String(ticket.event_id));
      } else {
        const role = await getProfileRole(user.uid);
        allowed = role === "admin" || role === "developer";
        if (!allowed) {
          const { data: ev } = await admin
            .from("events")
            .select("created_by")
            .eq("id", ticket.event_id)
            .maybeSingle();
          allowed = ev?.created_by === user.uid;
        }
      }
      if (!allowed) { res.status(403).json({ result: "forbidden" }); return; }

      const name = ticket.owner_name || reservation?.buyer_name || "Convidado";
      if (ticket.status === "cancelled") {
        res.json({ result: "cancelled", name, ticketName: ticket.name });
        return;
      }
      if (!reservation || reservation.payment_status !== "approved") {
        res.json({ result: "unpaid", name, ticketName: ticket.name });
        return;
      }
      if (ticket.checked_in_at) {
        res.json({ result: "duplicate", name, ticketName: ticket.name, checkedInAt: ticket.checked_in_at });
        return;
      }
      const { error: upErr } = await admin
        .from("ticket_items")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (upErr) throw upErr;
      res.json({ result: "ok", name, ticketName: ticket.name });
    } catch (err: any) {
      console.error("[CHECKIN] Erro:", err?.message ?? err);
      res.status(500).json({ result: "error", error: "Erro ao validar ingresso." });
    }
  });

  // ── Desfazer check-in (restaura QR para ser bipado novamente) ────────────
  app.post("/api/checkin/undo", requireAuthOrStaff, async (req, res) => {
    const user = (req as any).user;
    const staff = (req as any).staff as StaffTokenPayload | undefined;
    const { ticketId } = req.body as { ticketId?: string };
    if (!ticketId || typeof ticketId !== "string") {
      res.status(400).json({ error: "ticketId obrigatório." });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: ticket } = await admin
        .from("ticket_items")
        .select("id, event_id, checked_in_at")
        .eq("id", ticketId.trim())
        .maybeSingle();
      if (!ticket) { res.status(404).json({ error: "Ingresso não encontrado." }); return; }

      let allowed = false;
      if (staff) {
        allowed = Array.isArray(staff.eventIds) && staff.eventIds.map(String).includes(String(ticket.event_id));
      } else {
        const role = await getProfileRole(user.uid);
        allowed = role === "admin" || role === "developer";
        if (!allowed) {
          const { data: ev } = await admin.from("events").select("created_by").eq("id", ticket.event_id).maybeSingle();
          allowed = ev?.created_by === user.uid;
        }
      }
      if (!allowed) { res.status(403).json({ error: "Sem permissão." }); return; }

      await admin.from("ticket_items").update({ checked_in_at: null }).eq("id", ticket.id);
      console.log(`[CHECKIN] Check-in desfeito: ticket ${ticket.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[CHECKIN/UNDO] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao desfazer check-in." });
    }
  });

  // ── Cancelar ingresso individual + estorno proporcional ──────────────────
  app.post("/api/ticket/:ticketId/cancel", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { ticketId } = req.params;
    if (!ticketId) { res.status(400).json({ error: "ticketId obrigatório." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: ticket } = await admin
        .from("ticket_items")
        .select("id, reservation_id, status, checked_in_at, name")
        .eq("id", ticketId)
        .maybeSingle();
      if (!ticket) { res.status(404).json({ error: "Ingresso não encontrado." }); return; }
      if (ticket.status !== "active") {
        res.status(400).json({ error: `Ingresso não pode ser cancelado (status: ${ticket.status}).` });
        return;
      }
      if (ticket.checked_in_at) {
        res.status(409).json({ error: "Ingresso já utilizado no evento — não pode ser cancelado." });
        return;
      }

      const { data: reservation } = await admin
        .from("reservations")
        .select("id, user_id, payment_status, payment_id, total, platform_fee, ticket_items(id, status)")
        .eq("id", ticket.reservation_id)
        .maybeSingle();
      if (!reservation) { res.status(404).json({ error: "Reserva não encontrada." }); return; }

      const role = await getProfileRole(user.uid);
      const isAdmin = role === "admin" || role === "developer";
      if (!isAdmin && (reservation as any).user_id !== user.uid) {
        res.status(403).json({ error: "Sem permissão para cancelar este ingresso." });
        return;
      }

      const allItems: any[] = (reservation as any).ticket_items ?? [];
      const totalTickets = allItems.length || 1;
      const total: number = (reservation as any).total ?? 0;

      let refundAmount: number | null = null;
      let refundStatus: "processed" | "manual_required" | "failed" | "not_applicable" = "not_applicable";
      let refundError: string | null = null;

      // Tenta estorno ANTES de cancelar o ticket (para não cancelar sem reembolsar).
      if (reservation.payment_status === "approved") {
        const settings = await admin
          .from("system_config")
          .select("allow_cancellation,refund_type,cancel_fee_percent,auto_refund")
          .eq("id", "main")
          .maybeSingle();
        const cfg = settings.data;

        if (!cfg?.allow_cancellation) {
          res.status(400).json({ error: "Cancelamento de ingressos não está habilitado no momento." });
          return;
        }

        if (!cfg?.auto_refund) {
          refundStatus = "manual_required";
        } else {
          // Calcula o valor a estornar para este ingresso (proporcional ao total).
          const activeItems = allItems.filter((t: any) => t.status === "active");
          const isLastTicket = activeItems.length === 1;

          if (isLastTicket) {
            // Último ingresso ativo: estorno do restante conforme política.
            if (cfg.refund_type === "partial") {
              refundAmount = Math.round(total * (1 - (cfg.cancel_fee_percent ?? 0) / 100) * 100) / 100;
            } else if (cfg.refund_type === "no-fee") {
              refundAmount = Math.round((total - ((reservation as any).platform_fee ?? 0)) * 100) / 100;
            } else {
              refundAmount = null; // sem amount = MP estorna o saldo restante
            }
          } else {
            // Cancelamento parcial: proporcional pelos tickets ativos restantes.
            const activeCount = Math.max(activeItems.length, 1);
            const unitValue = Math.round((total / activeCount) * 100) / 100;
            refundAmount = unitValue;
          }

          const orderId = (reservation as any).payment_id;
          if (!orderId) {
            refundStatus = "manual_required";
            refundError = "Pagamento sem identificador — estorno manual necessário.";
          } else {
            try {
              const mpToken = await getMpAccessToken();
              const info = await resolveMpPayment(String(orderId), mpToken);
              const realPaymentId = info?.resolvedPaymentId ?? String(orderId);
              const mpBody = refundAmount !== null ? { amount: Math.round(refundAmount * 100) / 100 } : {};
              const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${realPaymentId}/refunds`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${mpToken}`,
                  "Content-Type": "application/json",
                  "X-Idempotency-Key": `refund-${reservation.id}-${ticket.id}`,
                },
                body: JSON.stringify(mpBody),
              });
              if (mpRes.ok) {
                const mpData = await mpRes.json().catch(() => ({}));
                refundAmount = refundAmount ?? (mpData.amount ?? total);
                refundStatus = "processed";
              } else {
                const errText = await mpRes.text();
                refundStatus = "failed";
                refundError = errText;
                console.error("[TICKET/CANCEL] Falha no estorno MP:", errText);
                try {
                  await admin.from("audit_logs").insert({
                    user_id: user.uid,
                    action: "refund_failed",
                    entity_type: "reservation",
                    entity_id: reservation.id,
                    changes: { paymentId: realPaymentId, refundAmount, error: errText },
                  });
                } catch { /* auditoria é melhor-esforço */ }
                // Estorno falhou — não cancelar o ingresso.
                res.status(422).json({ error: `Não foi possível processar o estorno. ${errText}`, refundStatus, refundError });
                return;
              }
            } catch (mpErr: any) {
              refundStatus = "failed";
              refundError = String(mpErr?.message ?? mpErr);
              console.error("[TICKET/CANCEL] Erro ao chamar MP refund:", refundError);
              try {
                await admin.from("audit_logs").insert({
                  user_id: user.uid,
                  action: "refund_failed",
                  entity_type: "reservation",
                  entity_id: reservation.id,
                  changes: { refundAmount, error: refundError },
                });
              } catch { /* auditoria é melhor-esforço */ }
              // Estorno falhou — não cancelar o ingresso.
              res.status(422).json({ error: `Erro ao processar estorno: ${refundError}`, refundStatus, refundError });
              return;
            }
          }
        }
      }

      // Estorno processado (ou não aplicável) — agora cancela o ticket.
      await admin.from("ticket_items").update({ status: "cancelled" }).eq("id", ticket.id);

      // Verificar se todos os itens da reserva agora estão cancelados.
      const activeAfterCancel = allItems.filter((t: any) => t.id !== ticket.id && t.status === "active");
      if (activeAfterCancel.length === 0 && reservation.payment_status === "approved") {
        await admin.from("reservations").update({ payment_status: "refunded" }).eq("id", reservation.id);
      }

      console.log(`[TICKET/CANCEL] Ticket ${ticket.id} cancelado por ${user.uid} (refund: ${refundStatus})`);
      res.json({ cancelled: true, refundAmount, refundStatus, refundError });
    } catch (err: any) {
      console.error("[TICKET/CANCEL] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao cancelar ingresso." });
    }
  });

  // ── Iniciar transferência de ingresso ────────────────────────────────────
  // Valida que o destinatário tem conta, marca o ingresso como pending_transfer
  // e envia e-mail com link de aceite. A reatribuição só ocorre no aceite.
  app.post("/api/ticket/:ticketId/transfer", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { ticketId } = req.params;
    const { toEmail } = req.body as { toEmail?: string };
    if (!ticketId) { res.status(400).json({ error: "ticketId obrigatório." }); return; }
    const email = String(toEmail ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) { res.status(400).json({ error: "E-mail do destinatário inválido." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: ticket } = await admin
        .from("ticket_items")
        .select("id, reservation_id, event_id, status, checked_in_at, name, holder_user_id")
        .eq("id", ticketId)
        .maybeSingle();
      if (!ticket) { res.status(404).json({ error: "Ingresso não encontrado." }); return; }
      if (ticket.checked_in_at) { res.status(409).json({ error: "Ingresso já utilizado — não pode ser transferido." }); return; }
      if (ticket.status !== "active") { res.status(400).json({ error: `Ingresso não pode ser transferido (status: ${ticket.status}).` }); return; }

      const { data: reservation } = await admin
        .from("reservations")
        .select("id, user_id, event_id")
        .eq("id", ticket.reservation_id)
        .maybeSingle();

      // Autorização: o detentor atual (holder ou, na ausência, dono da reserva) ou admin.
      const currentHolder = (ticket as any).holder_user_id ?? (reservation as any)?.user_id;
      const role = await getProfileRole(user.uid);
      const isAdmin = role === "admin" || role === "developer";
      if (!isAdmin && currentHolder !== user.uid) {
        res.status(403).json({ error: "Sem permissão para transferir este ingresso." });
        return;
      }

      // Limite de 2 transferências aceitas por ingresso.
      const { count: acceptedCount } = await admin
        .from("transfer_logs")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticket.id)
        .eq("status", "accepted");
      if ((acceptedCount ?? 0) >= 2) {
        res.status(400).json({ error: "Este ingresso já atingiu o limite de transferências." });
        return;
      }

      // O destinatário PRECISA ter conta no site.
      const { data: recipient } = await admin
        .from("profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();
      if (!recipient) {
        res.status(404).json({ error: "O destinatário não possui cadastro no site. Peça para ele criar uma conta primeiro." });
        return;
      }
      if ((recipient as any).id === user.uid) {
        res.status(400).json({ error: "Você não pode transferir um ingresso para si mesmo." });
        return;
      }

      const { data: sender } = await admin.from("profiles").select("name").eq("id", user.uid).maybeSingle();
      const senderName = (sender as any)?.name ?? "Um usuário";

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await admin.from("ticket_items").update({
        status: "pending_transfer",
        pending_transfer_email: email,
        transfer_token: token,
        transfer_expires_at: expiresAt,
      }).eq("id", ticket.id);

      await admin.from("transfer_logs").insert({
        ticket_id: ticket.id,
        from_user_id: user.uid,
        to_email: email,
        transfer_token: token,
        status: "pending",
        expires_at: expiresAt,
      });

      // Busca dados do evento para o e-mail.
      const { data: ev } = await admin.from("events").select("title").eq("id", ticket.event_id).maybeSingle();
      const acceptUrl = `${appUrl ?? ""}/?transfer=${token}`;
      try {
        await sendTransferInvitation({
          toEmail: email,
          fromName: senderName,
          eventTitle: (ev as any)?.title ?? "Evento",
          ticketName: (ticket as any).name ?? "Ingresso",
          acceptUrl,
        });
      } catch (mailErr: any) {
        console.error("[TRANSFER] Falha ao enviar e-mail de convite:", mailErr?.message);
        // Mantém a transferência pendente mesmo se o e-mail falhar (auditável).
      }

      console.log(`[TRANSFER] Ticket ${ticket.id} → ${email} (pendente) por ${user.uid}`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[TRANSFER] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao iniciar transferência." });
    }
  });

  // ── Aceitar transferência (destinatário) ─────────────────────────────────
  app.post("/api/transfer/:token/accept", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const token = String(req.params.token ?? "").trim();
    if (!token) { res.status(400).json({ error: "Token inválido." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: ticket } = await admin
        .from("ticket_items")
        .select("id, status, pending_transfer_email, transfer_expires_at")
        .eq("transfer_token", token)
        .maybeSingle();
      if (!ticket || ticket.status !== "pending_transfer") {
        res.status(404).json({ error: "Convite de transferência inválido ou já resolvido." });
        return;
      }
      if (ticket.transfer_expires_at && new Date(ticket.transfer_expires_at).getTime() < Date.now()) {
        res.status(410).json({ error: "Este convite de transferência expirou." });
        return;
      }
      const { data: profile } = await admin.from("profiles").select("email").eq("id", user.uid).maybeSingle();
      const myEmail = String((profile as any)?.email ?? "").toLowerCase();
      if (myEmail !== String(ticket.pending_transfer_email ?? "").toLowerCase()) {
        res.status(403).json({ error: "Este convite foi enviado para outro e-mail. Entre com a conta correta." });
        return;
      }

      const { data: log } = await admin
        .from("transfer_logs")
        .select("id, from_user_id")
        .eq("transfer_token", token)
        .maybeSingle();
      let fromName = "outro usuário";
      if ((log as any)?.from_user_id) {
        const { data: from } = await admin.from("profiles").select("name").eq("id", (log as any).from_user_id).maybeSingle();
        fromName = (from as any)?.name ?? fromName;
      }

      // Busca o nome/email do destinatário para gravar no ticket do remetente.
      const { data: recipientProfile } = await admin.from("profiles").select("name, email").eq("id", user.uid).maybeSingle();
      const recipientName = (recipientProfile as any)?.name ?? null;
      const recipientEmail = (recipientProfile as any)?.email ?? (ticket as any).pending_transfer_email ?? null;

      // Atualiza o ticket: transfere a posse (holder_user_id), registra remetente
      // (transferred_from_name) e, no mesmo registro, guarda destinatário para
      // que o remetente consiga ver para quem transferiu.
      await admin.from("ticket_items").update({
        status: "transferred",
        holder_user_id: user.uid,
        transferred_from_name: fromName,
        transferred_to_name: recipientName,
        transferred_to_email: recipientEmail,
        transferred_at: new Date().toISOString(),
        pending_transfer_email: null,
        transfer_token: null,
        transfer_expires_at: null,
      }).eq("id", ticket.id);

      if ((log as any)?.id) {
        await admin.from("transfer_logs").update({ status: "accepted", to_user_id: user.uid, resolved_at: new Date().toISOString() }).eq("id", (log as any).id);
      }

      console.log(`[TRANSFER] Ticket ${ticket.id} aceito por ${user.uid}`);
      res.json({ accepted: true, fromName });
    } catch (err: any) {
      console.error("[TRANSFER/ACCEPT] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao aceitar transferência." });
    }
  });

  // ── Recusar transferência (destinatário) ─────────────────────────────────
  app.post("/api/transfer/:token/reject", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const token = String(req.params.token ?? "").trim();
    if (!token) { res.status(400).json({ error: "Token inválido." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: ticket } = await admin
        .from("ticket_items")
        .select("id, status, pending_transfer_email")
        .eq("transfer_token", token)
        .maybeSingle();
      if (!ticket || ticket.status !== "pending_transfer") {
        res.status(404).json({ error: "Convite de transferência inválido ou já resolvido." });
        return;
      }
      const { data: profile } = await admin.from("profiles").select("email").eq("id", user.uid).maybeSingle();
      const myEmail = String((profile as any)?.email ?? "").toLowerCase();
      if (myEmail !== String(ticket.pending_transfer_email ?? "").toLowerCase()) {
        res.status(403).json({ error: "Este convite foi enviado para outro e-mail." });
        return;
      }
      // Reverte o ingresso para o detentor original.
      await admin.from("ticket_items").update({
        status: "active",
        pending_transfer_email: null,
        transfer_token: null,
        transfer_expires_at: null,
      }).eq("id", ticket.id);
      await admin.from("transfer_logs").update({ status: "rejected", to_user_id: user.uid, resolved_at: new Date().toISOString() }).eq("transfer_token", token);
      res.json({ rejected: true });
    } catch (err: any) {
      console.error("[TRANSFER/REJECT] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao recusar transferência." });
    }
  });

  // ── Ingressos recebidos por transferência (detentor = eu) ────────────────
  // A RLS impede o cliente de ler ticket_items de reservas alheias, então o
  // servidor (service role) devolve reservas sintéticas só com os ingressos de
  // que o usuário é detentor — usado por "Minhas Reservas".
  app.get("/api/my-transfers", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data } = await admin
        .from("ticket_items")
        .select("*, reservations(*)")
        .eq("holder_user_id", user.uid)
        .eq("status", "transferred");
      const synthetic: Record<string, any> = {};
      for (const t of (data ?? []) as any[]) {
        const r = t.reservations;
        if (!r || r.user_id === user.uid) continue; // já aparece como reserva minha
        if (!synthetic[r.id]) synthetic[r.id] = { ...r, ticket_items: [] };
        const { reservations: _omit, ...item } = t;
        synthetic[r.id].ticket_items.push(item);
      }
      res.json({ reservations: Object.values(synthetic) });
    } catch (err: any) {
      console.error("[MY-TRANSFERS] Erro:", err?.message ?? err);
      res.status(500).json({ error: "Erro ao carregar transferências." });
    }
  });

  // ── Mercado Pago - Process Payment ────────────────────────────────────────
  app.post("/api/payment/mercadopago", paymentLimiter, requireAuth, async (req, res) => {
    const {
      cardToken,
      cardBrand,
      amount: clientAmount,
      description,
      paymentMethod,
      installments,
      guestData,
      selection,
      reservationId,
    } = req.body as {
      cardToken?: string;
      cardBrand?: string;
      amount?: number;
      description?: string;
      paymentMethod?: string;
      installments?: string;
      guestData?: { name?: string; email?: string; cpf?: string };
      selection?: OrderSelection;
      reservationId?: string;
    };

    const accessToken = await getMpAccessToken();

    if (!accessToken) {
      console.error("[MERCADOPAGO] Access Token não configurado");
      res.status(503).json({ error: "Mercado Pago não configurado. Configure as credenciais no painel admin." });
      return;
    }

    if (!cardToken || !description) {
      res.status(400).json({ error: "Dados incompletos para pagamento." });
      return;
    }

    // Valor SEMPRE recalculado no servidor a partir dos preços do banco.
    // O valor enviado pelo cliente é descartado (anti-fraude).
    let amount: number;
    try {
      amount = await computeOrderTotal(selection ?? {});
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Não foi possível validar o valor do pedido." });
      return;
    }

    if (amount <= 0 || amount > 999999) {
      res.status(400).json({ error: "Valor inválido para pagamento." });
      return;
    }

    if (Number.isFinite(Number(clientAmount)) && Math.abs(Number(clientAmount) - amount) > 0.01) {
      console.warn(`[SECURITY] Divergência de valor (cartão): cliente=${clientAmount} servidor=${amount}`);
    }

    try {
      const isDebit = paymentMethod === 'debit_card';
      const brandMap: Record<string, string> = { visa: 'visa', mastercard: 'master', amex: 'amex', elo: 'elo' };
      const brandId = brandMap[cardBrand || 'visa'] ?? 'visa';
      const amountStr = (Math.round(amount * 100) / 100).toFixed(2);

      // Orders API (/v1/orders) — o /v1/payments legado foi descontinuado para
      // novas integrações (retornava internal_error). Em sandbox usa-se a
      // credencial APP_USR de um vendedor de teste.
      const payload = {
        type: "online",
        processing_mode: "automatic",
        total_amount: amountStr,
        ...(reservationId ? { external_reference: reservationId } : {}),
        payer: {
          // Nunca usar domínio @mercadopago.com (proibido pelo MP → erro 4390).
          // Em sandbox, o e-mail é convertido para @testuser.com (exigência do MP).
          email: payerEmailForEnv(guestData?.email || (req as any).user?.email),
          first_name: (guestData?.name || "").split(" ")[0],
          last_name: (guestData?.name || "").split(" ").slice(1).join(" "),
          identification: {
            number: guestData?.cpf?.replace(/\D/g, "") || "00000000000",
            type: "CPF",
          },
        },
        transactions: {
          payments: [
            {
              amount: amountStr,
              payment_method: {
                id: brandId,
                type: isDebit ? "debit_card" : "credit_card",
                token: cardToken,
                // Débito não suporta parcelamento na Orders API — força 1x,
                // senão o MP rejeita o pagamento (unsupported/invalid installments).
                installments: isDebit ? 1 : parseInt(installments || "1", 10),
              },
            },
          ],
        },
      };

      console.log(`[MERCADOPAGO] Processando pagamento (orders): R$ ${amount} | Método: ${paymentMethod} | payer.email: ${payload.payer.email}`);

      const response = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[MERCADOPAGO] Erro:", JSON.stringify(data));
        res.status(response.status).json({
          error: data.errors?.[0]?.message || data.message || "Erro ao processar pagamento",
          details: data,
        });
        return;
      }

      const payment = data.transactions?.payments?.[0] ?? {};
      const normalized = orderStatusToNormalized(payment.status || data.status);
      const paymentId = payment.id ?? data.id;
      console.log(`[MERCADOPAGO] ✓ Order ${data.id} | pagamento ${paymentId} | status ${payment.status} → ${normalized}`);

      // Atualiza a reserva (service role) com o status real — não confia no cliente.
      // O webhook é a rede de segurança caso esta atualização falhe.
      // Salva o id da ORDER (não o do pagamento interno): é ele que a rota de
      // status usa para re-consultar /v1/orders quando o webhook não chega.
      if (reservationId) {
        const newStatus = mpStatusToReservation(normalized);
        const admin = await getAdminClient();
        if (admin && newStatus) {
          const { error: upErr } = await admin
            .from("reservations")
            .update({ payment_status: newStatus, payment_id: String(data.id ?? paymentId), updated_at: new Date().toISOString() })
            .eq("id", reservationId);
          if (upErr) {
            console.error("[MERCADOPAGO] Falha ao atualizar reserva:", upErr.message);
          } else if (newStatus === "approved") {
            // Cartão aprovado na hora: envia a confirmação já — o webhook que
            // chegar depois é no-op graças ao claim de idempotência.
            const mail = await sendReservationConfirmation(admin, reservationId);
            if (!mail.sent && mail.reason) {
              console.warn(`[MERCADOPAGO] E-mail de confirmação não enviado: ${mail.reason}`);
            }
          }
        }
      }

      res.json({
        success: true,
        paymentId,
        status: normalized,
        statusDetail: payment.status_detail ?? data.status_detail,
        amount: Number(data.total_amount ?? amount),
      });
    } catch (error) {
      console.error("[MERCADOPAGO] Erro ao processar:", error);
      res.status(500).json({ error: "Erro interno ao processar pagamento." });
    }
  });

  // ── Mercado Pago - PIX ────────────────────────────────────────────────────
  app.post("/api/payment/pix", paymentLimiter, requireAuth, async (req, res) => {
    const { amount: clientAmount, description, guestData, selection, reservationId } = req.body as {
      amount?: number;
      description?: string;
      guestData?: { name?: string; email?: string; cpf?: string };
      selection?: OrderSelection;
      reservationId?: string;
    };

    // Valor SEMPRE recalculado no servidor (anti-fraude) — ignora o do cliente.
    let amount: number;
    try {
      amount = await computeOrderTotal(selection ?? {});
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Não foi possível validar o valor do pedido." });
      return;
    }

    if (amount <= 0 || amount > 999999) {
      res.status(400).json({ error: "Valor inválido para pagamento PIX." });
      return;
    }

    if (Number.isFinite(Number(clientAmount)) && Math.abs(Number(clientAmount) - amount) > 0.01) {
      console.warn(`[SECURITY] Divergência de valor (PIX): cliente=${clientAmount} servidor=${amount}`);
    }

    const accessToken = await getMpAccessToken();
    if (!accessToken) {
      res.status(503).json({ error: "Mercado Pago não configurado. Configure as credenciais no painel admin." });
      return;
    }

    // Timeout defensivo: se o MP demorar demais para responder, devolvemos um
    // erro amigável em vez de deixar o checkout girando indefinidamente.
    const pixController = new AbortController();
    const pixTimeout = setTimeout(() => pixController.abort(), 8000);
    try {
      const amountStr = (Math.round(amount * 100) / 100).toFixed(2);
      const response = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        signal: pixController.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `pix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          type: "online",
          processing_mode: "automatic",
          total_amount: amountStr,
          ...(reservationId ? { external_reference: reservationId } : {}),
          payer: {
            email: payerEmailForEnv(guestData?.email),
            first_name: (guestData?.name || "").split(" ")[0] || "Comprador",
            last_name: (guestData?.name || "").split(" ").slice(1).join(" ") || "Eventix",
            identification: {
              // PIX exige CPF não-vazio (MP: "length must be >= 1"). Mesmo
              // fallback do cartão quando o comprador não informou o CPF.
              type: "CPF",
              number: (guestData?.cpf || "").replace(/\D/g, "") || "00000000000",
            },
          },
          transactions: {
            // expiration_time é OBRIGATÓRIO para o MP gerar o QR do PIX (sem ele,
            // qr_code volta vazio). PT30M = expira em 30 minutos.
            payments: [{ amount: amountStr, expiration_time: "PT30M", payment_method: { id: "pix", type: "bank_transfer" } }],
          },
        }),
      });

      clearTimeout(pixTimeout);
      const data = await response.json();

      if (!response.ok) {
        console.error("[PIX] Erro Mercado Pago:", JSON.stringify(data));
        res.status(response.status).json({ error: data.errors?.[0]?.message || data.message || "Erro ao gerar PIX" });
        return;
      }

      const payment = data.transactions?.payments?.[0] ?? {};
      const pm = payment.payment_method ?? {};
      const qrCode = pm.qr_code ?? "";
      const qrCodeBase64 = pm.qr_code_base64 ?? "";
      // Prioriza a imagem oficial do MP (base64); senão gera a partir do código copia-e-cola.
      const qrCodeUrl = qrCodeBase64
        ? `data:image/png;base64,${qrCodeBase64}`
        : (qrCode ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCode)}&size=250x250` : "");

      const paymentId = payment.id ?? data.id;
      // Vincula a ORDER à reserva (service role): o webhook casa a confirmação
      // por external_reference e a rota de status re-consulta /v1/orders/{id}.
      if (reservationId) {
        const admin = await getAdminClient();
        if (admin) {
          const { error: upErr } = await admin
            .from("reservations")
            .update({ payment_id: String(data.id ?? paymentId), updated_at: new Date().toISOString() })
            .eq("id", reservationId);
          if (upErr) console.error("[PIX] Falha ao vincular payment_id à reserva:", upErr.message);
        }
      }

      console.log(`[PIX] Order ${data.id} | pagamento ${paymentId} status=${payment.status} | qr=${qrCode ? "ok" : "vazio"}`);
      res.json({
        paymentId,
        status: orderStatusToNormalized(payment.status || data.status),
        qrCode,
        qrCodeUrl,
      });
    } catch (error: any) {
      clearTimeout(pixTimeout);
      if (error?.name === "AbortError") {
        console.error("[PIX] Timeout ao gerar PIX no Mercado Pago");
        res.status(504).json({ error: "O Mercado Pago demorou para responder. Tente novamente em alguns instantes." });
        return;
      }
      console.error("[PIX] Erro interno:", error);
      res.status(500).json({ error: "Erro interno ao gerar PIX." });
    }
  });

  // ── Retomar pagamento PIX de uma reserva pendente (carrinho) ──────────────
  // Regenera o QR para uma reserva já existente (pending), lendo os dados do
  // banco (service role) — usado pela página de carrinho ("Pagar agora").
  app.post("/api/payment/pix/resume", paymentLimiter, requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { reservationId } = req.body as { reservationId?: string };
    if (!reservationId) { res.status(400).json({ error: "reservationId obrigatório." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    const accessToken = await getMpAccessToken();
    if (!accessToken) { res.status(503).json({ error: "Mercado Pago não configurado." }); return; }

    const { data: reservation } = await admin
      .from("reservations")
      .select("id, user_id, payment_status, total, buyer_name, buyer_email, buyer_cpf")
      .eq("id", reservationId)
      .maybeSingle();
    if (!reservation) { res.status(404).json({ error: "Reserva não encontrada." }); return; }
    if ((reservation as any).user_id !== user.uid) {
      res.status(403).json({ error: "Sem permissão." }); return;
    }
    if ((reservation as any).payment_status !== "pending") {
      res.status(400).json({ error: "Reserva não está pendente de pagamento." }); return;
    }

    const pixController = new AbortController();
    const pixTimeout = setTimeout(() => pixController.abort(), 8000);
    try {
      const amountStr = (Math.round(Number((reservation as any).total) * 100) / 100).toFixed(2);
      const response = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        signal: pixController.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `pix-resume-${reservationId}-${Date.now()}`,
        },
        body: JSON.stringify({
          type: "online",
          processing_mode: "automatic",
          total_amount: amountStr,
          external_reference: reservationId,
          payer: {
            email: payerEmailForEnv((reservation as any).buyer_email),
            first_name: ((reservation as any).buyer_name || "").split(" ")[0] || "Comprador",
            last_name: ((reservation as any).buyer_name || "").split(" ").slice(1).join(" ") || "Eventix",
            identification: { type: "CPF", number: ((reservation as any).buyer_cpf || "").replace(/\D/g, "") || "00000000000" },
          },
          transactions: {
            payments: [{ amount: amountStr, expiration_time: "PT30M", payment_method: { id: "pix", type: "bank_transfer" } }],
          },
        }),
      });
      clearTimeout(pixTimeout);
      const data = await response.json();
      if (!response.ok) {
        console.error("[PIX/RESUME] Erro MP:", JSON.stringify(data));
        res.status(response.status).json({ error: data.errors?.[0]?.message || data.message || "Erro ao gerar PIX" });
        return;
      }
      const payment = data.transactions?.payments?.[0] ?? {};
      const pm = payment.payment_method ?? {};
      const qrCode = pm.qr_code ?? "";
      const qrCodeBase64 = pm.qr_code_base64 ?? "";
      const qrCodeUrl = qrCodeBase64
        ? `data:image/png;base64,${qrCodeBase64}`
        : (qrCode ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCode)}&size=250x250` : "");
      await admin.from("reservations").update({ payment_id: String(data.id ?? payment.id), updated_at: new Date().toISOString() }).eq("id", reservationId);
      res.json({ paymentId: payment.id ?? data.id, status: orderStatusToNormalized(payment.status || data.status), qrCode, qrCodeUrl });
    } catch (error: any) {
      clearTimeout(pixTimeout);
      if (error?.name === "AbortError") {
        res.status(504).json({ error: "O Mercado Pago demorou para responder. Tente novamente." });
        return;
      }
      console.error("[PIX/RESUME] Erro interno:", error);
      res.status(500).json({ error: "Erro interno ao retomar PIX." });
    }
  });

  // ── Remover/cancelar uma reserva pendente do carrinho ─────────────────────
  app.post("/api/reservation/:id/cancel-pending", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const id = String(req.params.id ?? "").trim();
    if (!id) { res.status(400).json({ error: "id obrigatório." }); return; }
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    const { data: reservation } = await admin
      .from("reservations")
      .select("id, user_id, payment_status")
      .eq("id", id)
      .maybeSingle();
    if (!reservation) { res.status(404).json({ error: "Reserva não encontrada." }); return; }
    if ((reservation as any).user_id !== user.uid) { res.status(403).json({ error: "Sem permissão." }); return; }
    if ((reservation as any).payment_status !== "pending") {
      res.status(400).json({ error: "Apenas reservas pendentes podem ser removidas do carrinho." }); return;
    }
    await admin.from("reservations").update({ payment_status: "cancelled" }).eq("id", id);
    res.json({ removed: true });
  });

  // ── Status do pagamento de uma reserva (polling do checkout) ──────────────
  // O frontend consulta enquanto o PIX/cartão está pendente. Com ?refresh=1,
  // re-consulta o Mercado Pago e aplica o status — rede de segurança para o
  // caso de o webhook não estar cadastrado ou ainda não ter chegado.
  app.get("/api/payment/status/:reservationId", paymentStatusLimiter, requireAuth, async (req, res) => {
    const reservationId = String(req.params.reservationId ?? "").trim();
    if (!reservationId) {
      res.status(400).json({ error: "Reserva inválida." });
      return;
    }
    const admin = await getAdminClient();
    if (!admin) {
      res.status(503).json({ error: "Serviço não configurado." });
      return;
    }
    try {
      const { data: reservation, error } = await admin
        .from("reservations")
        .select("id, user_id, payment_status, payment_id, updated_at")
        .eq("id", reservationId)
        .maybeSingle();
      if (error) throw error;

      const user = (req as any).user;
      // Autorização: dono da reserva; reserva de convidado (sem user_id) é
      // acessível por quem tem o UUID; admin/developer sempre.
      let allowed = Boolean(reservation && (!reservation.user_id || reservation.user_id === user?.uid));
      if (reservation && !allowed && user?.uid) {
        const role = await getProfileRole(user.uid);
        allowed = role === "admin" || role === "developer";
      }
      // 404 genérico: não revela a existência da reserva a terceiros.
      if (!reservation || !allowed) {
        res.status(404).json({ error: "Reserva não encontrada." });
        return;
      }

      let paymentStatus: string = reservation.payment_status;
      if (req.query.refresh === "1" && paymentStatus === "pending" && reservation.payment_id) {
        const accessToken = await getMpAccessToken();
        if (accessToken) {
          const info = await resolveMpPayment(String(reservation.payment_id), accessToken);
          if (info) {
            const updated = await applyPaymentUpdate(admin, {
              ...info,
              externalRef: info.externalRef ?? reservation.id,
            });
            if (updated) {
              paymentStatus = updated.newStatus;
              if (updated.newStatus === "approved") {
                const mail = await sendReservationConfirmation(admin, updated.reservationId);
                if (!mail.sent && mail.reason) {
                  console.warn(`[STATUS] E-mail de confirmação não enviado: ${mail.reason}`);
                }
              }
            }
          }
        }
      }
      res.json({ paymentStatus, updatedAt: reservation.updated_at ?? null });
    } catch (err: any) {
      console.error("[STATUS] Erro ao consultar status do pagamento:", err?.message);
      res.status(500).json({ error: "Erro ao consultar status." });
    }
  });

  // ── Mercado Pago - Webhook ────────────────────────────────────────────────
  // Sem auth de usuário, mas valida a ASSINATURA do MP e confirma o status real
  // consultando a API (nunca confia no corpo recebido). Atualiza a reserva via
  // service role — a única forma legítima de marcar um pagamento como aprovado.
  app.post("/api/webhook/mercadopago", (req, res, next) => {
    if (req.is('application/json')) {
      express.json()(req, res, next);
    } else if (req.is('application/x-www-form-urlencoded')) {
      express.urlencoded({ extended: true })(req, res, next);
    } else {
      express.text({ type: '*/*' })(req, res, next);
    }
  }, async (req, res) => {
    // IMPORTANTE: todo o processamento acontece ANTES da resposta. Na Vercel a
    // função serverless é congelada assim que responde — responder 200 primeiro
    // fazia o update no banco nunca executar. O MP tolera ~22s e reenvia a
    // notificação quando recebe 5xx, então usamos isso como fila de retry:
    //   • notificação irrelevante/sem id/assinatura inválida → 200 (descarta)
    //   • falha transitória (MP fora, banco indisponível)     → 500 (MP reenvia)
    try {
      // 1. Extrai o ID do pagamento (corpo ou querystring)
      const body: any = typeof req.body === "string" ? safeJsonParse(req.body) : req.body;
      const topic = body?.type ?? body?.topic ?? req.query.type ?? req.query.topic;
      const paymentId =
        body?.data?.id ?? body?.["data.id"] ?? req.query["data.id"] ?? req.query.id;

      // Aceita notificações de order (Orders API) e payment (legado)
      if (topic && !/order|payment/i.test(String(topic))) {
        res.status(200).json({ received: true });
        return;
      }
      if (!paymentId) {
        res.status(200).json({ received: true });
        return;
      }

      // 2. Valida a assinatura HMAC do Mercado Pago (se o secret estiver configurado)
      const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
      if (secret) {
        const sigHeader = String(req.headers["x-signature"] ?? "");
        const requestId = String(req.headers["x-request-id"] ?? "");
        const parts = Object.fromEntries(
          sigHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim())) as [string, string][]
        );
        const ts = parts["ts"];
        const v1 = parts["v1"];
        const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${ts};`;
        const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
        const ok =
          !!v1 &&
          v1.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
        if (!ok) {
          console.warn("[WEBHOOK] Assinatura inválida — notificação descartada.");
          res.status(200).json({ received: true });
          return;
        }
      } else {
        console.warn("[WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura não verificada.");
      }

      // 3. Confirma o status REAL consultando a API do MP (não confia no corpo).
      const accessToken = await getMpAccessToken();
      if (!accessToken) {
        console.error("[WEBHOOK] Access Token não configurado — impossível confirmar pagamento.");
        res.status(500).json({ error: "Pagamento não configurado." });
        return;
      }
      const info = await resolveMpPayment(String(paymentId), accessToken);
      if (!info) {
        res.status(500).json({ error: "Falha ao consultar o Mercado Pago." });
        return;
      }

      // 4. Atualiza a reserva (service role)
      const admin = await getAdminClient();
      if (!admin) {
        console.error("[WEBHOOK] Service role não configurado — reserva não atualizada.");
        res.status(500).json({ error: "Banco não configurado." });
        return;
      }
      const updated = await applyPaymentUpdate(admin, info);
      if (!updated) {
        // Status sem mapeamento ou nenhuma reserva casou — nada a fazer.
        console.warn(`[WEBHOOK] Notificação ${paymentId} sem reserva correspondente (status=${info.normalized}).`);
        res.status(200).json({ received: true });
        return;
      }
      console.log(`[WEBHOOK] ${info.resolvedPaymentId} → ${updated.newStatus} (reserva ${updated.reservationId})`);

      // 5. Pagamento aprovado → e-mail de confirmação (idempotente via claim).
      //    Falha de e-mail NÃO derruba o webhook: fica em audit_logs p/ reenvio.
      if (updated.newStatus === "approved") {
        const mail = await sendReservationConfirmation(admin, updated.reservationId);
        if (!mail.sent && mail.reason) {
          console.warn(`[WEBHOOK] E-mail de confirmação não enviado: ${mail.reason}`);
        }
      }
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[WEBHOOK] Erro ao processar notificação:", err?.message);
      if (!res.headersSent) res.status(500).json({ error: "Erro interno." });
    }
  });

  // ── Profile Sensitive Data — leitura (descriptografa CPF / phone / birth_date) ──
  app.get("/api/profile/sensitive", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(503).json({ error: "Serviço de perfil não configurado." });
      return;
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const { data, error } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", user.uid)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: "Perfil não encontrado." });
        return;
      }

      const profile = { ...data };
      profile.cpf = safeDecrypt(profile.cpf);
      profile.phone = safeDecrypt(profile.phone);
      profile.birth_date = safeDecrypt(profile.birth_date);

      res.json({ success: true, profile });
    } catch (err: any) {
      console.error("[PROFILE] Erro ao buscar perfil:", err.message);
      res.status(500).json({ error: "Erro ao buscar perfil." });
    }
  });

  // ── Profile Sensitive Data (encrypts CPF / phone / birth_date) ──────────────
  app.put("/api/profile/sensitive", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { name, cpf, phone, birth_date } = req.body as {
      name?: string;
      cpf?: string;
      phone?: string;
      birth_date?: string;
    };

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(503).json({ error: "Serviço de perfil não configurado." });
      return;
    }

    if (cpf && !validateCpf(cpf)) {
      res.status(400).json({ error: "CPF inválido." });
      return;
    }

    // birth_date: aceita apenas 'YYYY-MM-DD' (formato do <input type="date">).
    if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      res.status(400).json({ error: "Data de nascimento inválida (use AAAA-MM-DD)." });
      return;
    }

    // phone: aceita dígitos, espaços e ( ) - + ; entre 8 e 20 caracteres.
    if (phone && !/^[\d\s()+-]{8,20}$/.test(phone)) {
      res.status(400).json({ error: "Telefone inválido." });
      return;
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const encKey = (process.env.ENCRYPTION_KEY ?? "").trim();
      const updates: Record<string, string | null> = {};

      if (name !== undefined) updates.name = name;

      if (cpf !== undefined) {
        updates.cpf = cpf && encKey ? encryptData(cpf) : cpf ?? null;
      }
      if (phone !== undefined) {
        updates.phone = phone && encKey ? encryptData(phone) : phone ?? null;
      }
      if (birth_date !== undefined) {
        updates.birth_date = birth_date && encKey ? encryptData(birth_date) : birth_date ?? null;
      }

      if (!encKey) {
        console.warn("[PROFILE] ENCRYPTION_KEY não configurada — dados sensíveis salvos em plaintext.");
      }

      const { data, error } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", user.uid)
        .select()
        .single();

      if (error) throw error;

      // Retorna o perfil com dados descriptografados
      const profile = { ...data };
      profile.cpf = safeDecrypt(profile.cpf);
      profile.phone = safeDecrypt(profile.phone);
      profile.birth_date = safeDecrypt(profile.birth_date);

      console.log(`[PROFILE] Dados sensíveis atualizados para user ${user.uid}`);
      res.json({ success: true, profile });
    } catch (err: any) {
      if (err.message?.includes("ENCRYPTION_KEY")) {
        res.status(503).json({ error: err.message });
        return;
      }
      console.error("[PROFILE] Erro ao atualizar perfil:", err.message);
      res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  });

  // ── Delete Account (LGPD Art. 18 — Direito ao Esquecimento) ─────────────────
  app.delete("/api/users/me", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(503).json({ error: "Serviço de exclusão não configurado." });
      return;
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // 1. Busca reservas do usuário (necessário para apagar ticket_items)
      const { data: userReservations } = await adminClient
        .from("reservations")
        .select("id")
        .eq("user_id", user.uid);

      if (userReservations && userReservations.length > 0) {
        const resIds = userReservations.map((r: any) => r.id);
        // Remove ingressos individuais vinculados às reservas
        await adminClient.from("ticket_items").delete().in("reservation_id", resIds);
      }

      // 2. Anonimiza reservas (mantém histórico financeiro, remove PII — LGPD Art. 18)
      await adminClient
        .from("reservations")
        .update({ buyer_name: "Usuário excluído", buyer_email: null, buyer_cpf: null, buyer_phone: null })
        .eq("user_id", user.uid);

      // 3. Remove transferências onde o usuário é remetente
      await adminClient.from("transfer_logs").delete().eq("from_user_id", user.uid);

      // 4. Anonimiza logs de auditoria (remove PII, mantém ação para conformidade)
      await adminClient
        .from("audit_logs")
        .update({ user_id: null, ip_address: null, user_agent: null })
        .eq("user_id", user.uid);

      // 5. Remove dados bancários e candidatura a produtor
      await adminClient.from("banking_details").delete().eq("user_id", user.uid);
      await adminClient.from("producer_applications").delete().eq("user_id", user.uid);

      // 6. Deleta o usuário do Supabase Auth (profiles é deletado em cascata via FK)
      const { error } = await adminClient.auth.admin.deleteUser(user.uid);
      if (error) throw error;

      console.log(`[DELETE] Account and PII erased for user ${user.uid}`);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[DELETE] Failed to delete account:", err.message);
      res.status(500).json({ error: "Erro ao excluir conta. Contate o suporte." });
    }
  });

  // ── LGPD Privacy Policy ───────────────────────────────────────────────────
  app.get("/api/privacy-policy", (_req, res) => {
    res.json({
      policy:
        "Esta plataforma coleta apenas os dados necessários para a emissão de ingressos e prevenção de fraudes. Dados sensíveis (CPF, telefone, data de nascimento) são criptografados com AES-256 antes do armazenamento. Não compartilhamos dados com terceiros sem consentimento explícito.",
      data_collected: ["Nome", "E-mail", "CPF (criptografado)", "Telefone (criptografado)", "Data de nascimento (criptografada)"],
      rights: [
        "Acesso aos dados (LGPD Art. 18, I)",
        "Correção de informações (LGPD Art. 18, III)",
        "Exclusão de conta e dados pessoais (LGPD Art. 18, VI)",
        "Portabilidade (exportar JSON) (LGPD Art. 18, V)",
        "Revogação de consentimento (LGPD Art. 18, IX)",
      ],
      dpo_email: "privacidade@espacomix.com.br",
      lastUpdated: "2026-05-27",
    });
  });

  // ── OTP de verificação de e-mail no cadastro (stateless via HMAC) ─────────
  app.post("/api/auth/send-verify-code", authLimiter, async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exp = Date.now() + 10 * 60 * 1000;
    const ticket = signOtp(email, code, exp);

    const emailCfg = await resolveEmailConfig();

    if (!emailCfg.resendApiKey) {
      console.log(`\n[OTP DEV] ━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[OTP DEV]  E-mail : ${email}`);
      console.log(`[OTP DEV]  Código : ${code}`);
      console.log(`[OTP DEV]  Expira : ${new Date(exp).toLocaleTimeString()}`);
      console.log(`[OTP DEV] ━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      res.json({ sent: true, devMode: true, ticket, exp });
      return;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(emailCfg.resendApiKey);

    try {
      // O SDK do Resend NÃO lança em erro: retorna { data, error }. Precisamos
      // checar `error` explicitamente, senão um envio rejeitado (ex.: domínio
      // não verificado) passaria como sucesso e o usuário nunca receberia o código.
      const { error } = await resend.emails.send({
        from: `${emailCfg.senderName} <${emailCfg.senderAddress}>`,
        to: email,
        subject: "Seu código de verificação — Espaço Mix",
        html: `
          <div style="background:#0a0a0a;padding:40px;font-family:serif;max-width:480px;margin:0 auto;border-radius:12px">
            <h2 style="color:#d4af37;text-align:center;letter-spacing:4px;font-size:18px;margin-bottom:8px">ESPAÇO MIX</h2>
            <p style="color:#fff;text-align:center;font-size:14px;opacity:0.7;margin-bottom:32px">Verificação de Cadastro</p>
            <div style="background:#1a1a1a;border-radius:8px;padding:32px;text-align:center;border:1px solid #2a2a2a">
              <p style="color:#aaa;font-size:13px;margin-bottom:16px">Seu código de verificação é:</p>
              <div style="font-size:40px;font-weight:bold;color:#d4af37;letter-spacing:12px">${code}</div>
              <p style="color:#666;font-size:11px;margin-top:16px">Válido por 10 minutos</p>
            </div>
            <p style="color:#666;text-align:center;font-size:11px;margin-top:24px">Se você não solicitou este código, ignore este e-mail.</p>
          </div>
        `,
      });
      if (error) {
        console.error("[OTP] Resend rejeitou o envio:", error);
        res.status(502).json({ error: `Não foi possível enviar o e-mail: ${(error as any).message ?? (error as any).name ?? "erro do provedor"}` });
        return;
      }
      res.json({ sent: true, ticket, exp });
    } catch (err: any) {
      console.error("[OTP] Erro ao enviar código:", err.message);
      res.status(500).json({ error: "Erro ao enviar e-mail de verificação." });
    }
  });

  app.post("/api/auth/check-verify-code", authLimiter, (req, res) => {
    const { email, code, ticket, exp } = req.body as {
      email?: string; code?: string; ticket?: string; exp?: number;
    };
    if (!email || !code || !ticket || !exp) {
      res.status(400).json({ valid: false, error: "Dados ausentes. Solicite um novo código." });
      return;
    }

    if (Date.now() > Number(exp)) {
      res.status(400).json({ valid: false, error: "Código expirado. Solicite um novo." });
      return;
    }

    const expected = signOtp(email, String(code), Number(exp));
    const ok =
      ticket.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(ticket), Buffer.from(expected));
    if (!ok) {
      res.status(400).json({ valid: false, error: "Código incorreto." });
      return;
    }

    res.json({ valid: true });
  });

  // ── Email - Confirmação de Compra (reenvio) ───────────────────────────────
  // Todos os dados saem do BANCO (nunca do corpo da requisição). Autorizado
  // para o dono da reserva ou admin/developer; exige reserva paga.
  app.post("/api/email/send-confirmation", requireAuth, async (req, res) => {
    const { reservationId } = req.body as { reservationId?: string };
    if (!reservationId || typeof reservationId !== "string") {
      res.status(400).json({ error: "reservationId é obrigatório." });
      return;
    }

    const admin = await getAdminClient();
    if (!admin) {
      res.status(503).json({ error: "Serviço de e-mail não configurado." });
      return;
    }

    try {
      const { data: reservation, error } = await admin
        .from("reservations")
        .select("id, user_id, payment_status")
        .eq("id", reservationId.trim())
        .maybeSingle();
      if (error) throw error;

      const user = (req as any).user;
      let allowed = Boolean(reservation?.user_id && user?.uid === reservation.user_id);
      if (reservation && !allowed && user?.uid) {
        const role = await getProfileRole(user.uid);
        allowed = role === "admin" || role === "developer";
      }
      // 404 genérico: não revela a existência da reserva a terceiros.
      if (!reservation || !allowed) {
        res.status(404).json({ error: "Reserva não encontrada." });
        return;
      }
      if (reservation.payment_status !== "approved") {
        res.status(409).json({ error: "A reserva ainda não está paga." });
        return;
      }

      const result = await sendReservationConfirmation(admin, reservation.id, { force: true });
      if (!result.sent) {
        res.status(500).json({ error: `E-mail não enviado: ${result.reason ?? "falha desconhecida"}` });
        return;
      }
      res.json({ sent: true });
    } catch (err: any) {
      console.error("[EMAIL] Erro ao enviar confirmação:", err.message);
      res.status(500).json({ error: "Erro ao enviar e-mail." });
    }
  });

  // ── Email - Lembretes Automáticos (endpoint para cron externo) ────────────
  // Lembretes via cron. Aceita GET (Vercel Cron, que envia Authorization: Bearer
  // <CRON_SECRET>) e POST (header x-cron-key) — qualquer um com o segredo correto.
  const handleSendReminders = async (req: express.Request, res: express.Response) => {
    const cronKey = process.env.CRON_SECRET;
    const bearer = typeof req.headers.authorization === "string" ? req.headers.authorization.replace(/^Bearer\s+/i, "") : "";
    const provided = (req.headers["x-cron-key"] as string) || bearer;
    if (!cronKey || provided !== cronKey) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }
    try {
      // O cron da Vercel roda de hora em hora (0 * * * *); só disparamos os
      // e-mails na hora escolhida pelo admin no painel (system_config.reminder_cron_hour).
      // Assim, alterar a hora pelo site passa a valer sem editar o código.
      const admin = await getAdminClient();
      let targetHour = 12;
      if (admin) {
        const { data } = await admin.from("system_config").select("reminder_cron_hour").eq("id", "main").maybeSingle();
        if (typeof data?.reminder_cron_hour === "number") targetHour = data.reminder_cron_hour;
      }
      const currentHour = new Date().getUTCHours();
      if (currentHour !== targetHour) {
        res.json({ skipped: true, sent: 0, errors: 0, reason: `Hora atual ${currentHour}h UTC ≠ hora configurada ${targetHour}h UTC.` });
        return;
      }
      const result = await sendReminderEmails();
      res.json(result);
    } catch (err: any) {
      console.error("[EMAIL] Erro ao enviar lembretes:", err.message);
      res.status(500).json({ error: "Erro ao enviar lembretes." });
    }
  };
  app.get("/api/email/send-reminders", handleSendReminders);
  app.post("/api/email/send-reminders", handleSendReminders);

  // Disparo manual de lembretes pelo painel (autenticado como admin — o botão da
  // UI não conhece o CRON_SECRET, então usa o token do admin).
  app.post("/api/admin/trigger-reminders", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const result = await sendReminderEmails();
      res.json(result);
    } catch (err: any) {
      console.error("[EMAIL] Erro ao disparar lembretes:", err.message);
      res.status(500).json({ error: "Erro ao enviar lembretes." });
    }
  });

  // ─── Broadcast de mensagens para compradores de um evento ─────────────────
  app.post("/api/messages/broadcast", requireAuth, requireAdmin, async (req, res) => {
    const { eventId, message, subject } = req.body as { eventId?: number; message?: string; subject?: string };
    if (!eventId || !message?.trim()) {
      res.status(400).json({ error: "eventId e message são obrigatórios." });
      return;
    }
    const safeSubject = escapeHtml((subject || "Aviso importante sobre o seu evento").slice(0, 200));
    const safeMessage = escapeHtml(message.slice(0, 5000));
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: reservations, error } = await adminClient
        .from("reservations")
        .select("buyer_name, buyer_email, event_id")
        .eq("event_id", eventId)
        .eq("payment_status", "approved");

      if (error) throw error;

      const broadcastEmailCfg = await resolveEmailConfig();
      const { Resend: BroadcastResend } = await import("resend");
      const broadcastResend = new BroadcastResend(broadcastEmailCfg.resendApiKey);
      let sent = 0;
      let errors = 0;

      for (const r of reservations ?? []) {
        try {
          await broadcastResend.emails.send({
            from: `${broadcastEmailCfg.senderName} <${broadcastEmailCfg.senderAddress}>`,
            to: r.buyer_email,
            subject: safeSubject,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0d0d0d;color:#fff;border-radius:12px">
              <h2 style="color:#d4af37;margin-bottom:16px">${safeSubject}</h2>
              <p style="color:#ccc;line-height:1.6;white-space:pre-wrap">${safeMessage}</p>
              <hr style="border-color:#333;margin:24px 0"/>
              <p style="color:#666;font-size:12px">Este é um aviso enviado pelo organizador do evento.</p>
            </div>`,
          });
          sent++;
        } catch {
          errors++;
        }
      }
      res.json({ sent, errors, total: reservations?.length ?? 0 });
    } catch (err: any) {
      console.error("[BROADCAST] Erro:", err.message);
      res.status(500).json({ error: "Erro ao enviar mensagens." });
    }
  });

  // ─── Estorno via Mercado Pago ─────────────────────────────────────────────
  app.post("/api/payment/refund", requireAuth, async (req, res) => {
    const { paymentId, reservationId } = req.body as { paymentId?: string; reservationId?: string };
    if (!paymentId || !reservationId) {
      res.status(400).json({ error: "paymentId e reservationId são obrigatórios" });
      return;
    }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // 1. Buscar configurações de cancelamento — fonte única: system_config (id=main),
      // a MESMA tabela que a tela de Configurações grava. Antes lia de uma tabela
      // "settings" com nomes de coluna divergentes, então as regras definidas no
      // site não chegavam ao estorno do Mercado Pago.
      const { data: settings } = await adminClient
        .from("system_config")
        .select("allow_cancellation,refund_type,cancel_max_delay_hours,auto_refund,cancel_fee_percent")
        .eq("id", "main")
        .maybeSingle();
      if (!settings?.allow_cancellation) {
        res.status(403).json({ error: "Cancelamento não permitido nas configurações" });
        return;
      }

      // 2. Buscar reserva e evento para validar prazo
      const { data: reservation } = await adminClient
        .from("reservations")
        .select("*, events(date)")
        .eq("id", reservationId)
        .single();
      if (!reservation) {
        res.status(404).json({ error: "Reserva não encontrada" });
        return;
      }

      // 2b. Autorização: só o dono da reserva ou um admin pode estornar (anti-IDOR)
      const requester = (req as any).user;
      const requesterRole = await getProfileRole(requester.uid);
      const isAdmin = requesterRole === "admin" || requesterRole === "developer";
      if (!isAdmin && (reservation as any).user_id !== requester.uid) {
        res.status(403).json({ error: "Você não tem permissão para estornar esta reserva." });
        return;
      }

      const eventDate = new Date((reservation as any).events?.date);
      const hoursUntil = (eventDate.getTime() - Date.now()) / 3600000;
      if (hoursUntil < (settings.cancel_max_delay_hours ?? 0)) {
        res.status(400).json({ error: "Prazo de cancelamento encerrado" });
        return;
      }

      // 3. Calcular valor conforme refund_type (regra definida no site):
      //    total  → reembolso integral (corpo vazio = full refund no MP)
      //    partial→ desconta a multa de cancelamento (cancel_fee_percent)
      //    no-fee → devolve tudo menos a taxa da plataforma já retida
      const total: number = reservation.total;
      let refundAmount: number | undefined;
      if (settings.refund_type === "partial") {
        const cancelFee = settings.cancel_fee_percent ?? 0;
        refundAmount = total * (1 - cancelFee / 100);
      } else if (settings.refund_type === "no-fee") {
        refundAmount = total - (reservation.platform_fee ?? 0);
      }

      // 4. Chamar API do Mercado Pago
      const mpBody = refundAmount !== undefined ? { amount: refundAmount } : {};
      const refundToken = await getMpAccessToken();
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refundToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mpBody),
        }
      );
      if (!mpRes.ok) {
        const err = await mpRes.json();
        res.status(502).json({ error: "Erro no Mercado Pago", details: err });
        return;
      }

      // 5. Atualizar status da reserva
      await adminClient
        .from("reservations")
        .update({ payment_status: "refunded" })
        .eq("id", reservationId);

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Refund] Erro:", err?.message);
      res.status(500).json({ error: "Erro interno ao processar estorno" });
    }
  });

  // Rotas /api/* não encontradas — deve vir ANTES do middleware Vite
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Error-handler JSON para a API: garante que erros (ex.: JSON malformado no
  // body-parser, exceções não tratadas) respondam JSON em vez da página HTML
  // padrão do Express. Só atua em /api; demais rotas seguem o fluxo normal.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (!req.path.startsWith("/api")) return next(err);
    const status = err?.type === "entity.parse.failed" ? 400 : (err?.status || 500);
    console.error("[API] Erro não tratado:", err?.message ?? err);
    res.status(status).json({ error: status === 400 ? "Requisição inválida (JSON malformado)." : "Erro interno do servidor." });
  });

  return app;
}

// ─── Servidor local (dev + produção standalone) ──────────────────────────────

async function startServer() {
  const app = await createExpressApp();
  const PORT = Number(process.env.PORT ?? 3000);

  // ── Frontend ──────────────────────────────────────────────────────────────
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server running on http://localhost:${PORT} (${isProduction ? "production" : "development"})`
    );
  });
}

// Em serverless (Vercel) o app é exportado por api/index.ts — NÃO subimos um
// listener próprio. startServer() só roda quando executado diretamente (dev/standalone).
if (!process.env.VERCEL) {
  startServer();
}
