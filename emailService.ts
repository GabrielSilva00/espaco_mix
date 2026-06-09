import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ─── Templates padrão ────────────────────────────────────────────────────────

const PURCHASE_SUBJECT_DEFAULT = 'Confirmação: seu ingresso para {{event_title}}';

const PURCHASE_BODY_DEFAULT = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Ingresso Confirmado</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#d4af37;font-size:26px;font-weight:bold;margin:0;">&#x2705; Ingresso Confirmado!</h1>
    </div>
    <div style="background:#111111;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
      <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">Ol&#xe1;, <strong>{{buyer_name}}</strong>!</p>
      <p style="color:#aaaaaa;font-size:14px;margin:0 0 28px;">Seu pagamento foi aprovado com sucesso. Veja os detalhes abaixo:</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="color:#d4af37;font-size:20px;margin:0 0 20px;">{{event_title}}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;">&#x1F4C5; Data</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right;">{{event_date}}</td>
          </tr>
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;">&#x1F550; Hor&#xe1;rio</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right;">{{event_time}}</td>
          </tr>
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;">&#x1F4CD; Local</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right;">{{event_location}}</td>
          </tr>
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;">&#x1F4B3; Pagamento</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;text-align:right;">{{payment_method}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#d4af37;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="color:#000000;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;font-weight:bold;">C&#xf3;digo da Reserva</p>
        <p style="color:#000000;font-size:22px;font-weight:bold;margin:0;letter-spacing:3px;">{{reservation_id}}</p>
      </div>
      <div style="border-top:1px solid #2a2a2a;padding-top:16px;display:flex;justify-content:space-between;">
        <span style="color:#888888;font-size:14px;">Total pago</span>
        <span style="color:#d4af37;font-size:20px;font-weight:bold;">{{total}}</span>
      </div>
    </div>
    <p style="color:#555555;font-size:12px;text-align:center;margin-top:24px;line-height:1.6;">
      Apresente este e-mail ou o c&#xf3;digo da reserva na entrada do evento.<br>
      Em caso de d&#xfa;vidas, entre em contato com o suporte.
    </p>
  </div>
</body>
</html>`;

const REMINDER_SUBJECT_DEFAULT = 'Lembrete: {{event_title}} é amanhã!';

const REMINDER_BODY_DEFAULT = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Lembrete de Evento</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#d4af37;font-size:26px;font-weight:bold;margin:0;">&#x23F0; Seu evento é amanhã!</h1>
    </div>
    <div style="background:#111111;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
      <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">Ol&#xe1;, <strong>{{buyer_name}}</strong>!</p>
      <p style="color:#aaaaaa;font-size:14px;margin:0 0 28px;">N&#xe3;o se esque&#xe7;a! Voc&#xea; tem um ingresso confirmado para amanh&#xe3;:</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="color:#d4af37;font-size:20px;margin:0 0 20px;">{{event_title}}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;">&#x1F4C5; Data</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right;">{{event_date}}</td>
          </tr>
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;">&#x1F550; Hor&#xe1;rio</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right;">{{event_time}}</td>
          </tr>
          <tr>
            <td style="color:#888888;font-size:13px;padding:8px 0;">&#x1F4CD; Local</td>
            <td style="color:#ffffff;font-size:13px;padding:8px 0;text-align:right;">{{event_location}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#d4af37;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="color:#000000;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;font-weight:bold;">C&#xf3;digo da Reserva</p>
        <p style="color:#000000;font-size:22px;font-weight:bold;margin:0;letter-spacing:3px;">{{reservation_id}}</p>
      </div>
      <p style="color:#cccccc;font-size:14px;text-align:center;margin:0;">Chegue cedo para garantir seu lugar! At&#xe9; amanh&#xe3;.</p>
    </div>
    <p style="color:#555555;font-size:12px;text-align:center;margin-top:24px;">
      Voc&#xea; est&#xe1; recebendo este email pois tem um ingresso confirmado para este evento.
    </p>
  </div>
</body>
</html>`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function processTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (tpl, [key, value]) => tpl.replaceAll(`{{${key}}}`, value),
    template
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    boleto: 'Boleto Bancário',
  };
  return map[method] ?? method;
}

function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

interface EmailConfig {
  email_sender_name?: string;
  email_sender_address?: string;
  email_purchase_subject?: string;
  email_purchase_body?: string;
  email_reminder_subject?: string;
  email_reminder_body?: string;
  notify_purchase?: boolean;
  notify_reminder?: boolean;
}

async function loadConfig(): Promise<EmailConfig | null> {
  const db = getAdminClient();
  if (!db) return null;
  const { data } = await db
    .from('system_config')
    .select('email_sender_name,email_sender_address,email_purchase_subject,email_purchase_body,email_reminder_subject,email_reminder_body,notify_purchase,notify_reminder')
    .eq('id', 'main')
    .single();
  return data;
}

// ─── Provedor de e-mail (Resend ou SMTP) ─────────────────────────────────────
// As credenciais entram pelo painel (Acesso Master) e ficam no banco: os
// SEGREDOS criptografados em app_secrets; a config (provedor/SMTP/remetente) em
// system_config. Fallback para as variáveis de ambiente (compatibilidade).

function decryptSecret(value?: string | null): string {
  if (!value) return '';
  if (!value.startsWith('enc:')) return value;
  try {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) return '';
    const [, ivHex, data] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(hex, 'hex'), Buffer.from(ivHex, 'hex'));
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return '';
  }
}

export interface ResolvedEmailConfig {
  provider: 'resend' | 'smtp';
  resendApiKey: string;
  smtp: { host?: string; port?: number; user?: string; password?: string; secure?: boolean };
  senderName: string;
  senderAddress: string;
}

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  const db = getAdminClient();
  let cfg: any = {}, secrets: any = {};
  if (db) {
    const [{ data: c }, { data: s }] = await Promise.all([
      db.from('system_config').select('email_provider,smtp_host,smtp_port,smtp_user,smtp_secure,email_sender_name,email_sender_address').eq('id', 'main').maybeSingle(),
      db.from('app_secrets').select('resend_api_key,smtp_password').eq('id', 'main').maybeSingle(),
    ]);
    cfg = c ?? {}; secrets = s ?? {};
  }
  const provider: 'resend' | 'smtp' = cfg.email_provider === 'smtp' ? 'smtp' : 'resend';
  return {
    provider,
    resendApiKey: decryptSecret(secrets.resend_api_key) || process.env.RESEND_API_KEY || '',
    smtp: {
      host: cfg.smtp_host || process.env.SMTP_HOST,
      port: cfg.smtp_port || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined),
      user: cfg.smtp_user || process.env.SMTP_USER,
      password: decryptSecret(secrets.smtp_password) || process.env.SMTP_PASSWORD || '',
      secure: cfg.smtp_secure ?? true,
    },
    senderName: cfg.email_sender_name || process.env.EMAIL_SENDER_NAME || 'Espaço Mix',
    senderAddress: cfg.email_sender_address || process.env.EMAIL_SENDER_ADDRESS || 'onboarding@resend.dev',
  };
}

/** Envia um e-mail pelo provedor configurado (Resend ou SMTP). */
export async function sendMail(cfg: ResolvedEmailConfig, to: string, subject: string, html: string): Promise<void> {
  const from = `${cfg.senderName} <${cfg.senderAddress}>`;
  if (cfg.provider === 'smtp' && cfg.smtp.host) {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port || 587,
      secure: !!cfg.smtp.secure,
      auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.password } : undefined,
    });
    await transporter.sendMail({ from, to, subject, html });
    return;
  }
  if (!cfg.resendApiKey) throw new Error('Provedor de e-mail não configurado.');
  const resend = new Resend(cfg.resendApiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error((error as any).message || 'Falha no envio (Resend).');
}

/** Envio de teste — usado pelo onboarding/Configurações. */
export async function sendTestEmail(to: string): Promise<void> {
  const cfg = await resolveEmailConfig();
  await sendMail(
    cfg,
    to,
    'Teste de envio — Eventix',
    `<div style="font-family:Arial,sans-serif;padding:24px;background:#0a0a0a;color:#fff">
       <h2 style="color:#d4af37">✅ E-mail de teste enviado com sucesso</h2>
       <p>Se você recebeu esta mensagem, a configuração de e-mail (${cfg.provider.toUpperCase()}) está funcionando.</p>
     </div>`,
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export interface ConfirmationData {
  buyerName: string;
  buyerEmail: string;
  reservationId: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventLocation: string;
  total: number;
  paymentMethod: string;
}

export async function sendConfirmationEmail(data: ConfirmationData): Promise<void> {
  const config = await loadConfig();
  if (config?.notify_purchase === false) return;

  const email = await resolveEmailConfig();
  if (email.provider === 'resend' && !email.resendApiKey) {
    console.log('[EMAIL] Provedor de e-mail não configurado — confirmação ignorada');
    return;
  }

  const vars: Record<string, string> = {
    buyer_name: data.buyerName,
    event_title: data.eventTitle,
    event_date: formatDate(data.eventDate),
    event_time: data.eventTime ?? 'A confirmar',
    event_location: data.eventLocation,
    reservation_id: data.reservationId,
    total: `R$ ${data.total.toFixed(2).replace('.', ',')}`,
    payment_method: formatPaymentMethod(data.paymentMethod),
  };

  const subject = processTemplate(config?.email_purchase_subject ?? PURCHASE_SUBJECT_DEFAULT, vars);
  const html = processTemplate(config?.email_purchase_body ?? PURCHASE_BODY_DEFAULT, vars);

  try {
    await sendMail(email, data.buyerEmail, subject, html);
    const masked = data.buyerEmail.replace(/(^.).*(@.*$)/, '$1***$2');
    console.log(`[EMAIL] Confirmação enviada → ${masked}`);
  } catch (err: any) {
    console.error('[EMAIL] Falha ao enviar confirmação:', err?.message ?? err);
  }
}

export async function sendReminderEmails(): Promise<{ sent: number; errors: number }> {
  const db = getAdminClient();
  if (!db) return { sent: 0, errors: 0 };

  const config = await loadConfig();
  if (config?.notify_reminder === false) return { sent: 0, errors: 0 };

  const email = await resolveEmailConfig();
  if (email.provider === 'resend' && !email.resendApiKey) {
    console.log('[EMAIL] Provedor de e-mail não configurado — lembretes ignorados');
    return { sent: 0, errors: 0 };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const { data: events } = await db
    .from('events')
    .select('id, title, date, time, location')
    .eq('date', tomorrowDate)
    .in('status', ['Ativo', 'Vendas liberadas']);

  if (!events || events.length === 0) return { sent: 0, errors: 0 };

  const eventIds = (events as any[]).map((e: any) => e.id);

  const { data: reservations } = await db
    .from('reservations')
    .select('id, buyer_name, buyer_email, event_id')
    .in('event_id', eventIds)
    .eq('payment_status', 'approved')
    .eq('reminder_sent', false);

  if (!reservations || reservations.length === 0) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;
  const sentIds: string[] = [];

  for (const res of reservations as any[]) {
    if (!res.buyer_email) continue;
    const event = (events as any[]).find((e: any) => e.id === res.event_id);
    if (!event) continue;

    const vars: Record<string, string> = {
      buyer_name: res.buyer_name ?? 'Participante',
      event_title: event.title,
      event_date: formatDate(event.date),
      event_time: event.time ?? 'A confirmar',
      event_location: event.location,
      reservation_id: res.id,
      total: '',
    };

    const subject = processTemplate(config?.email_reminder_subject ?? REMINDER_SUBJECT_DEFAULT, vars);
    const html = processTemplate(config?.email_reminder_body ?? REMINDER_BODY_DEFAULT, vars);

    try {
      await sendMail(email, res.buyer_email, subject, html);
      sentIds.push(res.id);
      sent++;
    } catch (err: any) {
      console.error(`[EMAIL] Erro no lembrete reserva ${res.id}:`, err.message);
      errors++;
    }
  }

  if (sentIds.length > 0) {
    await db.from('reservations').update({ reminder_sent: true }).in('id', sentIds);
  }

  console.log(`[EMAIL] Lembretes: ${sent} enviados, ${errors} erros`);
  return { sent, errors };
}
