import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { sendConfirmationEmail, sendReminderEmails, sendTestEmail, resolveEmailConfig, sendTransferInvitation, sendContactMessage } from "./emailService.js";

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

// Impressão digital DETERMINÍSTICA do CPF para checagem de unicidade entre contas.
// Diferente de encryptData (IV aleatório → ciphertext sempre diferente), o HMAC do
// mesmo CPF gera sempre o mesmo hash, permitindo um índice único em profiles.cpf_hash.
// Usa ENCRYPTION_KEY como chave secreta: o hash não é reversível por força bruta
// (apenas 11 dígitos), preservando a privacidade do CPF. Retorna null se o CPF não
// tiver 11 dígitos. Sem ENCRYPTION_KEY válida, cai num SHA-256 simples (ainda
// determinístico, porém menos privado) — em produção a chave é obrigatória.
function hashCpf(cpf: string): string | null {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  const hex = (process.env.ENCRYPTION_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (hex.length === 64 && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return crypto.createHmac("sha256", Buffer.from(hex, "hex")).update(digits).digest("hex");
  }
  return crypto.createHash("sha256").update(digits).digest("hex");
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

// Segredo de assinatura dos tokens de portaria. SEM fallback hardcoded: um
// segredo padrão conhecido permitiria forjar tokens de staff (check-in livre).
// Falha fechada — em produção a SUPABASE_SERVICE_ROLE_KEY sempre existe, então
// isto só dispara em ambiente mal configurado.
function staffSecret(): string {
  const s = process.env.CRON_SECRET || process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error("Nenhum segredo de assinatura configurado (CRON_SECRET / ENCRYPTION_KEY / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return s;
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
  try {
    // staffSecret() pode lançar (sem segredo configurado) → token inválido.
    const expected = crypto.createHmac("sha256", staffSecret()).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
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
function orderStatusToNormalized(status?: string): "approved" | "pending" | "rejected" | "refunded" | "partially_refunded" | "unknown" {
  const map: Record<string, "approved" | "pending" | "rejected" | "refunded" | "partially_refunded"> = {
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
    // Reembolso PARCIAL não deve marcar a reserva inteira como reembolsada:
    // mantém status próprio e o webhook ignora (a rota de cancelamento é quem
    // controla a transição para 'refunded' quando TODOS os ingressos são cancelados).
    partially_refunded: "partially_refunded",
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
//
// IMPORTANTE: `orderId` é o id consultável e ESTÁVEL que persistimos em
// `reservations.payment_id` (re-consultável via /v1/orders/{orderId}). O
// `pay.id` interno da Orders API (formato PAY01...) NÃO é consultável por
// /v1/orders nem /v1/payments — gravá-lo quebrava o polling (400/404). Ele só
// serve para refunds, exposto separadamente como `innerPaymentId`.
type MpPaymentInfo = { externalRef?: string; normalized: string; orderId: string; innerPaymentId: string };

async function resolveMpPayment(mpId: string, accessToken: string): Promise<MpPaymentInfo | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${mpId}`, { headers });
  if (orderRes.ok) {
    const order: any = await orderRes.json();
    const pay = order?.transactions?.payments?.[0] ?? {};
    return {
      externalRef: order?.external_reference ?? undefined,
      normalized: orderStatusToNormalized(pay?.status || order?.status),
      orderId: String(mpId),
      innerPaymentId: String(pay?.id ?? mpId),
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
    orderId: String(mpId),
    innerPaymentId: String(mpId),
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
    payment_id: info.orderId,
    updated_at: new Date().toISOString(),
  });
  query = info.externalRef ? query.eq("id", info.externalRef) : query.eq("payment_id", info.orderId);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`Falha ao atualizar reserva: ${error.message}`);
  const reservationId = (data as any[])?.[0]?.id;
  if (!reservationId) return null;
  return { reservationId: String(reservationId), newStatus };
}

// ─── Estorno via Orders API (/v1/orders/{id}/refund) ─────────────────────────
// O endpoint legado /v1/payments/{id}/refunds NÃO aceita o id ULID (PAY01...) da
// Orders API (404). O refund de uma order vai por /v1/orders/{orderId}/refund.
// Como a regra de negócio sempre retém a taxa administrativa, o estorno é sempre
// PARCIAL — informa o id do pagamento interno e o valor (string, 2 casas).
async function refundMpOrder(
  orderId: string,
  innerPaymentId: string,
  amountCents: number,
  token: string,
  idempotencyKey: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  const amount = (amountCents / 100).toFixed(2);
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      transactions: [{ id: innerPaymentId, amount }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[REFUND] Falha Orders API (order ${orderId}, ${amount}):`, res.status, JSON.stringify(body));
  }
  return { ok: res.ok, status: res.status, body };
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
  // Sem fallback hardcoded: um segredo conhecido permitiria forjar o "ticket" e
  // burlar a verificação do código. Falha fechada (em produção ENCRYPTION_KEY/
  // SERVICE_ROLE_KEY sempre existem).
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Nenhum segredo de assinatura de OTP configurado (ENCRYPTION_KEY / SUPABASE_SERVICE_ROLE_KEY).");
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

// ─── Saneamento de texto livre fornecido pelo usuário (nome, telefone…) ──────
// Defesa em profundidade contra XSS armazenado: esses campos são exibidos em
// PDFs/listas geradas via document.write no navegador do admin. Remove os
// caracteres de marcação (< >) e de controle e limita o tamanho na origem.
function sanitizeName(value: unknown, maxLen = 120): string {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLen);
}

// ─── Limite de tentativas de OTP (persistido em otp_attempts) ────────────────
// O OTP de reset é stateless (HMAC), então o rate-limit por IP não impede o
// brute-force do código de 6 dígitos via rotação de IP. Aqui contamos as falhas
// por e-mail (guardado como hash) numa tabela — funciona em serverless, ao
// contrário de um contador em memória — e bloqueamos após o limite. Em caso de
// indisponibilidade da tabela, falha ABERTO (degrada para só o limite por IP):
// é um controle anti-DoS, não a única barreira de autenticação.
const OTP_MAX_ATTEMPTS = 5;
const OTP_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function emailFingerprint(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function otpAttemptsExceeded(admin: any, email: string, kind = "password_reset"): Promise<boolean> {
  try {
    const since = new Date(Date.now() - OTP_ATTEMPT_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("otp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailFingerprint(email))
      .eq("kind", kind)
      .gte("created_at", since);
    return (count ?? 0) >= OTP_MAX_ATTEMPTS;
  } catch {
    return false;
  }
}

async function recordOtpFailure(admin: any, email: string, kind = "password_reset"): Promise<void> {
  try {
    await admin.from("otp_attempts").insert({ email_hash: emailFingerprint(email), kind });
  } catch { /* melhor-esforço */ }
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

interface TicketLine {
  sectorId?: string;
  single?: number;
  male?: number;
  female?: number;
}

interface OrderSelection {
  eventId?: number | string;
  tables?: unknown;
  singleTickets?: number;
  maleTickets?: number;
  femaleTickets?: number;
  sectorId?: string;
  // Carrinho multi-setor: detalhamento por setor. Quando presente, tem
  // precedência sobre os campos planos acima (mantidos por compatibilidade).
  ticketLines?: TicketLine[];
}

async function computeOrderTotal(sel: OrderSelection): Promise<number> {
  const admin = await getAdminClient();
  if (!admin) throw new Error("Serviço de validação de preço não configurado.");

  if (sel.eventId === undefined || sel.eventId === null || sel.eventId === "") {
    throw new Error("Evento do pedido não informado.");
  }

  const { data: event, error: evErr } = await admin
    .from("events")
    .select("status, price_type, has_tables, table_total, total_bistros, table_price, bistro_price, table_seats, table_layout")
    .eq("id", sel.eventId)
    .maybeSingle();
  if (evErr || !event) throw new Error("Evento não encontrado.");

  // Pausa de emergência: bloqueia qualquer nova compra enquanto o evento estiver
  // pausado (fonte de verdade no servidor — o front apenas reflete o estado).
  if (event.status === "paused") {
    throw new Error("As vendas deste evento estão pausadas no momento.");
  }

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
  const ticketLines = Array.isArray(sel.ticketLines)
    ? sel.ticketLines.filter((l) => l && l.sectorId)
    : [];

  if (ticketLines.length > 0) {
    // Carrinho multi-setor: soma o preço de cada setor a partir dos preços do banco.
    const sectorIds = [...new Set(ticketLines.map((l) => String(l.sectorId)))];
    const { data: sectors } = await admin
      .from("sectors")
      .select("id, price, price_male, price_female, event_id")
      .in("id", sectorIds);
    const byId = new Map<string, any>((sectors ?? []).map((s: any) => [String(s.id), s]));
    for (const line of ticketLines) {
      const sector = byId.get(String(line.sectorId));
      if (!sector) throw new Error("Setor selecionado inválido.");
      if (Number(sector.event_id) !== Number(sel.eventId)) {
        throw new Error("Setor não pertence ao evento.");
      }
      const single = Math.max(0, Math.floor(Number(line.single) || 0));
      const male = Math.max(0, Math.floor(Number(line.male) || 0));
      const female = Math.max(0, Math.floor(Number(line.female) || 0));
      if (event.price_type === "gender") {
        ticketsTotal += male * (sector.price_male ?? 0) + female * (sector.price_female ?? 0);
      } else {
        ticketsTotal += single * (sector.price ?? DEFAULT_TICKET_PRICE);
      }
    }
  } else if (singleTickets > 0 || maleTickets > 0 || femaleTickets > 0) {
    // Caminho legado (1 setor por pedido).
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

// ─── Expiração de reservas pendentes (carrinho) ──────────────────────────────
// Reserva pendente sem payment_id = carrinho abandonado antes de pagar → expira
// em 10 min. Com payment_id = PIX/cartão já iniciado → mantém a mesa pela janela
// do PIX (30 min, coincide com o polling do front que encerra em ~30 min).
const PENDING_CART_EXPIRY_MS = 15 * 60 * 1000; // fallback se a config não responder
const PENDING_PAYMENT_EXPIRY_MS = 30 * 60 * 1000;

// Janela de expiração do carrinho = system_config.cart_expiration_minutes (cache 60s).
let _cartExpiryCache: { at: number; ms: number } | null = null;
async function getCartExpiryMs(admin: any): Promise<number> {
  if (_cartExpiryCache && Date.now() - _cartExpiryCache.at < 60_000) return _cartExpiryCache.ms;
  let minutes = PENDING_CART_EXPIRY_MS / 60000;
  try {
    if (admin) {
      const { data } = await admin
        .from("system_config")
        .select("cart_expiration_minutes")
        .eq("id", "main")
        .maybeSingle();
      if (typeof data?.cart_expiration_minutes === "number" && data.cart_expiration_minutes > 0) {
        minutes = data.cart_expiration_minutes;
      }
    }
  } catch { /* usa fallback */ }
  const ms = minutes * 60 * 1000;
  _cartExpiryCache = { at: Date.now(), ms };
  return ms;
}

function isPendingExpired(
  r: { created_at?: string | null; payment_id?: string | null },
  cartMs: number = PENDING_CART_EXPIRY_MS,
): boolean {
  if (!r?.created_at) return false;
  const created = new Date(r.created_at).getTime();
  if (!Number.isFinite(created)) return false;
  // Pagamento já iniciado mantém a mesa pela janela do PIX (ou pela config, se maior).
  const window = r.payment_id ? Math.max(PENDING_PAYMENT_EXPIRY_MS, cartMs) : cartMs;
  return Date.now() - created > window;
}

// ─── Métodos de pagamento ATIVOS da conta MP (cacheado) ──────────────────────
// Fonte da verdade para o payment_method.id: a conta pode suportar só certos
// métodos (ex.: débito apenas 'debelo'). Resolver pela conta evita o erro
// "value must be 'debelo'" causado por mapas de bandeira (debvisa/debmaster) que
// não existem nesta conta. Cache de 10 min (em instância warm da serverless).
let _pmCache: { at: number; debit: string[]; credit: string[] } | null = null;
async function getAccountPaymentMethods(accessToken: string): Promise<{ debit: string[]; credit: string[] }> {
  if (_pmCache && Date.now() - _pmCache.at < 10 * 60 * 1000) {
    return { debit: _pmCache.debit, credit: _pmCache.credit };
  }
  try {
    const resp = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const list = await resp.json();
    const active = Array.isArray(list) ? list.filter((m: any) => m?.status === "active") : [];
    const debit = active.filter((m: any) => m.payment_type_id === "debit_card").map((m: any) => String(m.id));
    const credit = active.filter((m: any) => m.payment_type_id === "credit_card").map((m: any) => String(m.id));
    _pmCache = { at: Date.now(), debit, credit };
    return { debit, credit };
  } catch (e: any) {
    console.error("[MERCADOPAGO] Falha ao listar payment_methods da conta:", e?.message ?? e);
    return { debit: [], credit: [] };
  }
}

// ─── Mesas ocupadas de um evento (reservas pagas OU pendentes) ───────────────
// Retorna apenas NÚMEROS de mesa (sem dados pessoais) — usado para bloquear
// dupla reserva no checkout e marcar mesas como indisponíveis no mapa.
// Reservas pendentes expiradas (carrinho abandonado) são ignoradas e marcadas
// como 'cancelled' (cleanup lazy — o plano Vercel é Hobby, sem cron), liberando
// a mesa para outros compradores.
async function getOccupiedTables(admin: any, eventId: number | string): Promise<number[]> {
  const cartMs = await getCartExpiryMs(admin);
  const { data, error } = await admin
    .from("reservations")
    .select("id, tables, payment_status, payment_id, created_at")
    .eq("event_id", eventId)
    .in("payment_status", ["approved", "pending"]);
  if (error) throw error;
  const set = new Set<number>();
  const expiredIds: string[] = [];
  (data ?? []).forEach((r: any) => {
    if (r.payment_status === "pending" && isPendingExpired(r, cartMs)) {
      expiredIds.push(r.id);
      return; // mesa não conta como ocupada
    }
    (Array.isArray(r.tables) ? r.tables : []).forEach((t: any) => set.add(Number(t)));
  });
  if (expiredIds.length > 0) {
    admin.from("reservations").update({ payment_status: "cancelled" }).in("id", expiredIds)
      .then(() => { /* lazy cleanup */ })
      .catch((e: any) => console.error("[CART-EXPIRY] Falha ao cancelar pendentes:", e?.message ?? e));
  }
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
    } else if (!isProduction) {
      // Dev fallback: aceita qualquer token não-vazio quando Supabase não está
      // configurado. NUNCA em produção — lá a ausência de config é falha fechada.
      (req as any).user = { uid: "dev-user", email: "dev@localhost" };
    } else {
      res.status(503).json({ error: "Serviço de autenticação não configurado." });
      return;
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
    if (password.length < 6) {
      res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
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

  // ── Salvar evento + lotes + setores (service role, bypassa RLS) ────────────
  // Somente admin/developer (requireAdmin). created_by vem do token, nunca do
  // cliente. Reúne evento, batches e sectors em uma única operação.
  app.post("/api/events", requireAuth, requireAdmin, async (req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }

    const { event, batches } = (req.body ?? {}) as { event?: any; batches?: any[] };
    if (!event || typeof event !== "object") {
      res.status(400).json({ error: "Dados do evento ausentes." });
      return;
    }

    const uid = (req as any).user?.uid;

    try {
      // 1. Upsert do evento principal — created_by sempre do token autenticado
      const { batches: _ignored, ...eventData } = event;
      const { data: savedEvent, error: evErr } = await admin
        .from("events")
        .upsert({ ...eventData, created_by: uid, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (evErr) throw evErr;

      const currentBatchIds: string[] = [];
      const currentSectorIds: string[] = [];
      const savedBatches: any[] = [];

      if (Array.isArray(batches) && batches.length > 0) {
        for (const batch of batches) {
          const { sectors, id, name, startDate, endDate, sort_order } = batch as any;

          // 2. Upsert do lote (camelCase → snake_case)
          const { data: savedBatch, error: bErr } = await admin
            .from("batches")
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

          let savedSectors: any[] = [];
          if (Array.isArray(sectors) && sectors.length > 0) {
            // 3. Upsert dos setores (camelCase → snake_case)
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
            const { data: upsertedSectors, error: sErr } = await admin
              .from("sectors")
              .upsert(sectorsToUpsert)
              .select();
            if (sErr) throw sErr;
            savedSectors = upsertedSectors ?? [];
            sectors.forEach((s: any) => currentSectorIds.push(s.id));
          }

          savedBatches.push({ ...savedBatch, sectors: savedSectors });
        }
      }

      // 4. Remover lotes e setores excluídos na UI
      if (currentSectorIds.length > 0) {
        await admin.from("sectors").delete().eq("event_id", savedEvent.id)
          .not("id", "in", `(${currentSectorIds.join(",")})`);
      } else {
        await admin.from("sectors").delete().eq("event_id", savedEvent.id);
      }
      if (currentBatchIds.length > 0) {
        await admin.from("batches").delete().eq("event_id", savedEvent.id)
          .not("id", "in", `(${currentBatchIds.join(",")})`);
      } else {
        await admin.from("batches").delete().eq("event_id", savedEvent.id);
      }

      res.status(200).json({ ...savedEvent, batches: savedBatches });
    } catch (e: any) {
      console.error("[EVENTS] Falha ao salvar evento:", e?.message ?? e);
      res.status(500).json({ error: e?.message ?? "Não foi possível salvar o evento." });
    }
  });

  app.get("/api/staff", requireAuth, requireAdmin, async (_req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.json({ staff: [] }); return; }
    try {
      // Retorna ativos e inativos para o admin poder reativar/excluir.
      const { data, error } = await admin
        .from("staff_accounts")
        .select("id, name, username, event_ids, is_active")
        .order("name");
      if (error) throw error;
      res.json({ staff: data ?? [] });
    } catch (e: any) {
      console.error("[STAFF] Falha ao listar:", e?.message ?? e);
      res.json({ staff: [] });
    }
  });

  // Exclusão REAL: permitida apenas se o colaborador nunca foi vinculado a um
  // evento (event_ids vazio). Caso contrário, responde 409 — o admin deve inativar.
  app.delete("/api/staff/:id", requireAuth, requireAdmin, async (req, res) => {
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const { data: staff, error: selErr } = await admin
        .from("staff_accounts")
        .select("id, event_ids")
        .eq("id", req.params.id)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!staff) { res.status(404).json({ error: "Colaborador não encontrado." }); return; }
      const linked = Array.isArray(staff.event_ids) && staff.event_ids.length > 0;
      if (linked) {
        res.status(409).json({ error: "Colaborador já vinculado a eventos. Inative-o em vez de excluir." });
        return;
      }
      const { error } = await admin.from("staff_accounts").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true, deleted: true });
    } catch (e: any) {
      console.error("[STAFF] Falha ao excluir:", e?.message ?? e);
      res.status(500).json({ error: "Não foi possível excluir o colaborador." });
    }
  });

  app.patch("/api/staff/:id", requireAuth, requireAdmin, async (req, res) => {
    const { name, username, password, is_active } = req.body as { name?: string; username?: string; password?: string; is_active?: boolean };
    const admin = await getAdminClient();
    if (!admin) { res.status(503).json({ error: "Serviço não configurado." }); return; }
    try {
      const updates: Record<string, string | boolean> = {};
      if (name?.trim()) updates.name = name.trim();
      if (username?.trim()) updates.username = username.trim().toLowerCase().replace(/\s+/g, '_');
      if (password && password.length >= 6) {
        updates.password = await hashPassword(password);
      }
      if (typeof is_active === "boolean") updates.is_active = is_active;
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
      // Migração transparente: se a senha estava em plaintext legado, re-hasheia
      // agora que sabemos que confere (não trava contas antigas e elimina o
      // fallback plaintext conta a conta no primeiro login).
      if (!String(staff.password).startsWith("scrypt:")) {
        try {
          await admin.from("staff_accounts").update({ password: await hashPassword(password) }).eq("id", staff.id);
        } catch (e: any) {
          console.error("[STAFF] Falha ao re-hashear senha legada:", e?.message ?? e);
        }
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

  // ── Formulário de Contato → e-mail de atendimento ───────────────────────────
  app.post("/api/contact", authLimiter, async (req, res) => {
    const b = (req.body ?? {}) as Record<string, string>;
    const nome = String(b.nome ?? "").trim();
    const email = String(b.email ?? "").trim();
    const mensagem = String(b.mensagem ?? "").trim();
    if (!nome || !email || !mensagem) {
      res.status(400).json({ error: "Nome, e-mail e mensagem são obrigatórios." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }
    try {
      await sendContactMessage({
        nome, email, mensagem,
        telefone: String(b.telefone ?? "").trim(),
        cidade: String(b.cidade ?? "").trim(),
        estado: String(b.estado ?? "").trim(),
        evento: String(b.evento ?? "").trim(),
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[CONTACT] Falha ao enviar mensagem:", e?.message ?? e);
      res.status(502).json({ error: "Não foi possível enviar sua mensagem agora. Tente novamente mais tarde." });
    }
  });

  // ── Login por nome de usuário (resolve + autentica no servidor) ─────────────
  // Resolve username → e-mail INTERNAMENTE e autentica server-side, devolvendo a
  // sessão. Nunca expõe o e-mail ao cliente (evita enumeração username → e-mail)
  // e nunca distingue "usuário inexistente" de "senha incorreta".
  app.post("/api/auth/login-username", authLimiter, async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || typeof username !== "string" || !username.trim() || !password) {
      res.status(400).json({ error: "Usuário e senha são obrigatórios." });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      res.status(503).json({ error: "Serviço de autenticação não configurado." });
      return;
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("email")
        .ilike("username", username.trim())
        .maybeSingle();

      const email = (profile as any)?.email as string | undefined;
      // Mensagem genérica e idêntica para usuário inexistente OU senha incorreta.
      const genericError = () => res.status(401).json({ error: "Usuário ou senha incorretos." });
      if (!email) { genericError(); return; }

      const authClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.session) { genericError(); return; }

      // Devolve apenas os tokens da sessão; o cliente faz supabase.auth.setSession.
      res.json({
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
      });
    } catch (err: any) {
      console.error("[AUTH] Erro no login por username:", err.message);
      res.status(500).json({ error: "Erro ao autenticar." });
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

    const buyerName = sanitizeName(reservation.buyer_name);
    const buyerEmail = String(reservation.buyer_email ?? "").trim().slice(0, 254);
    const buyerCpf = String(reservation.buyer_cpf ?? "").trim();
    const buyerPhone = sanitizeName(reservation.buyer_phone, 40);
    if (!buyerName || !buyerEmail) {
      res.status(400).json({ error: "Nome e e-mail do comprador são obrigatórios." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      res.status(400).json({ error: "E-mail do comprador inválido." });
      return;
    }
    // CPF é opcional (convidado/estrangeiro). O frontend envia "000.000.000-00"
    // como sentinela de "sem CPF" — tratado como ausente. Só validamos quando um
    // CPF real é informado, para não aceitar dado malformado.
    const buyerCpfDigits = buyerCpf.replace(/\D/g, "");
    const cpfProvided = buyerCpfDigits.length > 0 && !/^0+$/.test(buyerCpfDigits);
    if (cpfProvided && !validateCpf(buyerCpfDigits)) {
      res.status(400).json({ error: "CPF do comprador inválido." });
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
      ticketLines: Array.isArray(reservation.ticket_lines) ? reservation.ticket_lines : undefined,
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
          buyer_phone: buyerPhone || null,
          tables: Array.isArray(reservation.tables) ? reservation.tables : [],
          single_tickets: Math.max(0, Math.floor(Number(reservation.single_tickets) || 0)),
          male_tickets: Math.max(0, Math.floor(Number(reservation.male_tickets) || 0)),
          female_tickets: Math.max(0, Math.floor(Number(reservation.female_tickets) || 0)),
          ticket_lines: Array.isArray(reservation.ticket_lines) ? reservation.ticket_lines : null,
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
          name: sanitizeName(t?.name ?? "Ingresso", 80),
          is_table: Boolean(t?.is_table),
          table_number: t?.table_number ?? null,
          occupant_index: t?.occupant_index ?? null,
          owner_name: sanitizeName(t?.owner_name),
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
          .select("allow_cancellation")
          .eq("id", "main")
          .maybeSingle();
        const cfg = settings.data;

        if (!cfg?.allow_cancellation) {
          res.status(400).json({ error: "Cancelamento de ingressos não está habilitado no momento." });
          return;
        }

        // Reembolso obrigatório retendo a taxa administrativa (platform_fee).
        // Cálculo em CENTAVOS INTEIROS para não acumular erro de ponto flutuante.
        const totalCents = Math.round(total * 100);
        const feeCents = Math.round(((reservation as any).platform_fee ?? 0) * 100);
        const refundableCents = Math.max(totalCents - feeCents, 0);
        // Proporcional pelo nº ORIGINAL de ingressos (não pelo ativo decrescente,
        // que super-estornaria em cancelamentos sucessivos).
        const shareCents = Math.max(Math.round(refundableCents / totalTickets), 0);

        const orderId = (reservation as any).payment_id;
        if (!orderId) {
          refundStatus = "manual_required";
          refundError = "Pagamento sem identificador — estorno manual necessário.";
        } else if (shareCents <= 0) {
          // Taxa administrativa >= valor do ingresso: nada a estornar.
          refundStatus = "not_applicable";
        } else {
          try {
            const mpToken = await getMpAccessToken();
            const info = await resolveMpPayment(String(orderId), mpToken);
            const innerPaymentId = info?.innerPaymentId ?? String(orderId);
            const result = await refundMpOrder(
              String(orderId), innerPaymentId, shareCents, mpToken,
              `refund-${reservation.id}-${ticket.id}`,
            );
            if (result.ok) {
              refundAmount = shareCents / 100;
              refundStatus = "processed";
            } else {
              refundStatus = "failed";
              refundError = typeof result.body === "object" ? JSON.stringify(result.body) : String(result.body);
              try {
                await admin.from("audit_logs").insert({
                  user_id: user.uid,
                  action: "refund_failed",
                  entity_type: "reservation",
                  entity_id: reservation.id,
                  changes: { orderId: String(orderId), innerPaymentId, refundCents: shareCents, status: result.status, error: result.body },
                });
              } catch { /* auditoria é melhor-esforço */ }
              // Estorno falhou — NÃO cancela o ingresso (sem falha silenciosa).
              res.status(422).json({ error: "Não foi possível processar o estorno. Tente novamente ou contate o suporte.", refundStatus, refundError });
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
                changes: { orderId: String(orderId), refundCents: shareCents, error: refundError },
              });
            } catch { /* auditoria é melhor-esforço */ }
            // Estorno falhou — NÃO cancela o ingresso (sem falha silenciosa).
            res.status(422).json({ error: `Erro ao processar estorno: ${refundError}`, refundStatus, refundError });
            return;
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
      paymentMethodId,
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
      paymentMethodId?: string;
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
      // A Orders API exige o payment_method.id EXATO que a conta MP suporta.
      // Para débito isso é crítico: a conta pode ter só 'debelo' (sem debvisa/
      // debmaster), então mandar 'debmaster' faz o MP rejeitar com
      // "value must be 'debelo'". A fonte da verdade são os payment_methods da
      // própria conta (getAccountPaymentMethods) — não a regex de bandeira nem
      // o getPaymentMethods do front (que pode falhar/vir vazio).
      const creditMap: Record<string, string> = { visa: 'visa', mastercard: 'master', amex: 'amex', elo: 'elo' };
      const debitMap: Record<string, string> = { visa: 'debvisa', mastercard: 'debmaster', elo: 'debelo' };
      const brandKey = (cardBrand || 'visa').toLowerCase();
      const fallbackBrandId = isDebit ? (debitMap[brandKey] ?? 'debelo') : (creditMap[brandKey] ?? 'visa');
      // Só aceita o id vindo do front se o TIPO bater (débito começa com 'deb').
      const frontId = (typeof paymentMethodId === 'string' && paymentMethodId.trim())
        ? paymentMethodId.trim()
        : '';
      const frontIdMatchesType = frontId
        ? (isDebit ? frontId.startsWith('deb') : !frontId.startsWith('deb'))
        : false;

      const account = await getAccountPaymentMethods(accessToken);
      let brandId: string;
      if (isDebit) {
        // Preferência: front (se válido) → mapa de bandeira; mas só vale se a
        // conta suportar esse id. Se não, e a conta tiver um único método de
        // débito, usa ele. Último recurso: o mapa de fallback.
        const preferred = frontIdMatchesType ? frontId : fallbackBrandId;
        brandId = account.debit.includes(preferred)
          ? preferred
          : (account.debit.length === 1 ? account.debit[0] : fallbackBrandId);
      } else {
        const preferred = frontIdMatchesType ? frontId : fallbackBrandId;
        brandId = (account.credit.length === 0 || account.credit.includes(preferred))
          ? preferred
          : fallbackBrandId;
      }
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

      console.log(`[MERCADOPAGO] Processando pagamento (orders): R$ ${amount} | Método: ${paymentMethod} | payment_method.id: ${brandId} (front: ${paymentMethodId ?? '—'}, fallback: ${fallbackBrandId}, conta débito: [${account.debit.join(',')}]) | payer.email: ${payload.payer.email}`);

      const response = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
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
            last_name: (guestData?.name || "").split(" ").slice(1).join(" ") || "Espaço Mix",
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
            last_name: ((reservation as any).buyer_name || "").split(" ").slice(1).join(" ") || "Espaço Mix",
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
      } else if (isProduction) {
        // Em produção, processar webhooks sem verificar assinatura é inaceitável.
        // Falha fechada: descarta a notificação (o status real ainda é a rede de
        // segurança via polling com ?refresh=1). Configure MERCADOPAGO_WEBHOOK_SECRET.
        console.error("[WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET ausente em produção — notificação descartada.");
        res.status(200).json({ received: true });
        return;
      } else {
        console.warn("[WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura não verificada (dev).");
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
      console.log(`[WEBHOOK] ${info.orderId} → ${updated.newStatus} (reserva ${updated.reservationId})`);

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
        if (cpf) {
          // Unicidade de CPF: bloqueia se outra conta já usa este CPF. O índice
          // único em cpf_hash é a garantia final (corrida concorrente é capturada
          // no catch como 23505); esta checagem dá uma mensagem amigável antes.
          const cpfHash = hashCpf(cpf);
          if (cpfHash) {
            const { data: dupe } = await adminClient
              .from("profiles")
              .select("id")
              .eq("cpf_hash", cpfHash)
              .neq("id", user.uid)
              .maybeSingle();
            if (dupe) {
              res.status(409).json({ error: "Este CPF já está cadastrado em outra conta." });
              return;
            }
          }
          updates.cpf = encKey ? encryptData(cpf) : cpf;
          updates.cpf_hash = cpfHash;
        } else {
          updates.cpf = null;
          updates.cpf_hash = null;
        }
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
      // Violação do índice único de CPF (corrida concorrente que escapou da checagem).
      if (err?.code === "23505" || /duplicate key|cpf_hash/i.test(err?.message ?? "")) {
        res.status(409).json({ error: "Este CPF já está cadastrado em outra conta." });
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
    const { email, cpf } = req.body as { email?: string; cpf?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    // ── Bloqueia cadastro com e-mail ou CPF já existentes (antes de criar a conta) ──
    // Choke point dos dois fluxos de cadastro (AuthView e checkout): se barrarmos
    // aqui, nenhuma conta duplicada chega a ser criada no Supabase Auth.
    {
      const admin = await getAdminClient();
      if (admin) {
        const normalizedEmail = email.trim().toLowerCase();
        const { data: emailDupe } = await admin
          .from("profiles")
          .select("id")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        if (emailDupe) {
          res.status(409).json({ error: "Este e-mail já está cadastrado. Faça login para continuar." });
          return;
        }

        const cpfHash = cpf ? hashCpf(cpf) : null;
        if (cpfHash) {
          const { data: cpfDupe } = await admin
            .from("profiles")
            .select("id")
            .eq("cpf_hash", cpfHash)
            .maybeSingle();
          if (cpfDupe) {
            res.status(409).json({ error: "Este CPF já está cadastrado em outra conta." });
            return;
          }
        }
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
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

  app.post("/api/auth/check-verify-code", authLimiter, async (req, res) => {
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

    // Anti brute-force do código de 6 dígitos: limita tentativas erradas por
    // e-mail (o rate-limit por IP é contornável por rotação). Degrada de forma
    // graciosa se o admin client não estiver disponível (mesmo desenho do reset).
    const admin = await getAdminClient();
    if (admin && (await otpAttemptsExceeded(admin, email, "email_verify"))) {
      res.status(429).json({ valid: false, error: "Muitas tentativas. Solicite um novo código e aguarde alguns minutos." });
      return;
    }

    const expected = signOtp(email, String(code), Number(exp));
    const ok =
      ticket.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(ticket), Buffer.from(expected));
    if (!ok) {
      if (admin) await recordOtpFailure(admin, email, "email_verify");
      res.status(400).json({ valid: false, error: "Código incorreto." });
      return;
    }

    res.json({ valid: true });
  });

  // ── Recuperação de senha (OTP stateless via HMAC) ─────────────────────────
  // Diferente do cadastro, aqui o e-mail PRECISA existir. Para não vazar quais
  // e-mails têm conta (enumeração), respondemos sempre 200 com ticket/exp, mas
  // só enviamos o código quando há conta — quem não tem conta nunca recebe o
  // código e, portanto, não consegue avançar.
  app.post("/api/auth/send-reset-code", authLimiter, async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const code = String(crypto.randomInt(100000, 1000000));
    const exp = Date.now() + 10 * 60 * 1000;
    const ticket = signOtp(normalizedEmail, code, exp);

    const admin = await getAdminClient();
    let accountExists = false;
    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      accountExists = Boolean(profile);
    }

    // Conta inexistente: devolve ticket/exp (anti-enumeração) sem enviar código.
    if (!accountExists) {
      res.json({ sent: true, ticket, exp });
      return;
    }

    const emailCfg = await resolveEmailConfig();

    if (!emailCfg.resendApiKey) {
      console.log(`\n[RESET DEV] ━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[RESET DEV]  E-mail : ${normalizedEmail}`);
      console.log(`[RESET DEV]  Código : ${code}`);
      console.log(`[RESET DEV]  Expira : ${new Date(exp).toLocaleTimeString()}`);
      console.log(`[RESET DEV] ━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      res.json({ sent: true, devMode: true, ticket, exp });
      return;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(emailCfg.resendApiKey);

    try {
      const { error } = await resend.emails.send({
        from: `${emailCfg.senderName} <${emailCfg.senderAddress}>`,
        to: normalizedEmail,
        subject: "Recuperação de senha — Espaço Mix",
        html: `
          <div style="background:#0a0a0a;padding:40px;font-family:serif;max-width:480px;margin:0 auto;border-radius:12px">
            <h2 style="color:#d4af37;text-align:center;letter-spacing:4px;font-size:18px;margin-bottom:8px">ESPAÇO MIX</h2>
            <p style="color:#fff;text-align:center;font-size:14px;opacity:0.7;margin-bottom:32px">Recuperação de Senha</p>
            <div style="background:#1a1a1a;border-radius:8px;padding:32px;text-align:center;border:1px solid #2a2a2a">
              <p style="color:#aaa;font-size:13px;margin-bottom:16px">Seu código para redefinir a senha é:</p>
              <div style="font-size:40px;font-weight:bold;color:#d4af37;letter-spacing:12px">${code}</div>
              <p style="color:#666;font-size:11px;margin-top:16px">Válido por 10 minutos</p>
            </div>
            <p style="color:#666;text-align:center;font-size:11px;margin-top:24px">Se você não solicitou a recuperação, ignore este e-mail.</p>
          </div>
        `,
      });
      if (error) {
        console.error("[RESET] Resend rejeitou o envio:", error);
        res.status(502).json({ error: `Não foi possível enviar o e-mail: ${(error as any).message ?? (error as any).name ?? "erro do provedor"}` });
        return;
      }
      res.json({ sent: true, ticket, exp });
    } catch (err: any) {
      console.error("[RESET] Erro ao enviar código:", err.message);
      res.status(500).json({ error: "Erro ao enviar e-mail de recuperação." });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    const { email, code, ticket, exp, newPassword } = req.body as {
      email?: string; code?: string; ticket?: string; exp?: number; newPassword?: string;
    };
    if (!email || !code || !ticket || !exp || !newPassword) {
      res.status(400).json({ error: "Dados ausentes. Solicite um novo código." });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (Date.now() > Number(exp)) {
      res.status(400).json({ error: "Código expirado. Solicite um novo." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const admin = await getAdminClient();
    if (!admin) {
      res.status(503).json({ error: "Serviço indisponível no momento." });
      return;
    }

    // Anti brute-force: bloqueia o e-mail após muitas tentativas erradas dentro
    // da janela do código (o rate-limit por IP não basta — vide otpAttemptsExceeded).
    if (await otpAttemptsExceeded(admin, normalizedEmail)) {
      res.status(429).json({ error: "Muitas tentativas. Solicite um novo código e aguarde alguns minutos." });
      return;
    }

    const expected = signOtp(normalizedEmail, String(code), Number(exp));
    const ok =
      ticket.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(ticket), Buffer.from(expected));
    if (!ok) {
      await recordOtpFailure(admin, normalizedEmail);
      res.status(400).json({ error: "Código incorreto." });
      return;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (!profile?.id) {
      res.status(400).json({ error: "Não foi possível redefinir a senha." });
      return;
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
    if (updErr) {
      console.error("[RESET] Falha ao atualizar senha:", updErr.message);
      res.status(500).json({ error: "Não foi possível redefinir a senha. Tente novamente." });
      return;
    }

    res.json({ ok: true });
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
      // A hora configurada pelo admin é interpretada em horário de Brasília
      // (UTC−3, fixo — sem horário de verão desde 2019), não em UTC.
      const currentHour = (new Date().getUTCHours() - 3 + 24) % 24;
      if (currentHour !== targetHour) {
        res.json({ skipped: true, sent: 0, errors: 0, reason: `Hora atual ${currentHour}h (Brasília) ≠ hora configurada ${targetHour}h.` });
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
        .select("allow_cancellation,cancel_max_delay_hours")
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

      // 3. Valor a estornar = total − taxa administrativa (sempre retida),
      //    em CENTAVOS INTEIROS para evitar erro de ponto flutuante.
      const totalCents = Math.round(((reservation as any).total ?? 0) * 100);
      const feeCents = Math.round(((reservation as any).platform_fee ?? 0) * 100);
      const refundCents = Math.max(totalCents - feeCents, 0);
      if (refundCents <= 0) {
        // Nada a estornar (taxa >= total) — apenas marca como reembolsada.
        await adminClient.from("reservations").update({ payment_status: "refunded" }).eq("id", reservationId);
        res.json({ success: true, refundAmount: 0 });
        return;
      }

      // 4. Estorno pela Orders API (paymentId = id da ORDER salvo na reserva).
      const refundToken = await getMpAccessToken();
      const info = await resolveMpPayment(String(paymentId), refundToken);
      const innerPaymentId = info?.innerPaymentId ?? String(paymentId);
      const result = await refundMpOrder(
        String(paymentId), innerPaymentId, refundCents, refundToken,
        `refund-full-${reservationId}`,
      );
      if (!result.ok) {
        console.error("[Refund] Erro Mercado Pago:", JSON.stringify(result.body));
        res.status(502).json({ error: "Erro no Mercado Pago ao processar o estorno." });
        return;
      }

      // 5. Atualizar status da reserva
      await adminClient
        .from("reservations")
        .update({ payment_status: "refunded" })
        .eq("id", reservationId);

      res.json({ success: true, refundAmount: refundCents / 100 });
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
