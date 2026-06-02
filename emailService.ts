import { Resend } from 'resend';
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[EMAIL] RESEND_API_KEY não configurada — confirmação ignorada');
    return;
  }

  const config = await loadConfig();
  if (config?.notify_purchase === false) return;

  const senderName = config?.email_sender_name ?? 'Espaço Mix';
  const senderAddress = config?.email_sender_address ?? 'onboarding@resend.dev';

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

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: `${senderName} <${senderAddress}>`,
    to: data.buyerEmail,
    subject,
    html,
  });

  const masked = data.buyerEmail.replace(/(^.).*(@.*$)/, '$1***$2');
  console.log(`[EMAIL] Confirmação enviada → ${masked}`);
}

export async function sendReminderEmails(): Promise<{ sent: number; errors: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[EMAIL] RESEND_API_KEY não configurada — lembretes ignorados');
    return { sent: 0, errors: 0 };
  }

  const db = getAdminClient();
  if (!db) return { sent: 0, errors: 0 };

  const config = await loadConfig();
  if (config?.notify_reminder === false) return { sent: 0, errors: 0 };

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

  const resend = new Resend(apiKey);
  const senderName = config?.email_sender_name ?? 'Espaço Mix';
  const senderAddress = config?.email_sender_address ?? 'onboarding@resend.dev';

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
      await resend.emails.send({
        from: `${senderName} <${senderAddress}>`,
        to: res.buyer_email,
        subject,
        html,
      });
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
