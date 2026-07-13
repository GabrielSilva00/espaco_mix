import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ─── Templates padrão ────────────────────────────────────────────────────────

const PURCHASE_SUBJECT_DEFAULT = 'Confirmação: seu ingresso para {{event_title}}';

const PURCHASE_BODY_DEFAULT = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Ingresso Confirmado</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#0f0f0f;">

    <!-- Cabeçalho preto: logo + número do pedido -->
    <table role="presentation" width="100%" style="background:#000000;border-collapse:collapse;">
      <tr>
        <td style="padding:22px 28px;vertical-align:middle;">{{site_logo_html}}</td>
        <td style="padding:22px 28px;vertical-align:middle;text-align:right;color:#d4af37;font-size:15px;font-weight:bold;letter-spacing:1px;white-space:nowrap;">PEDIDO N&#xba; {{reservation_id}}</td>
      </tr>
    </table>

    <!-- Saudação -->
    <div style="padding:32px 28px 8px;">
      <p style="color:#ffffff;font-size:16px;line-height:1.6;margin:0;">Ol&#xe1;, <strong>{{buyer_name}}</strong>, segue abaixo as informa&#xe7;&#xf5;es do seu ingresso para <strong style="color:#d4af37;">{{event_title}}</strong>.</p>
    </div>

    <!-- Botão de acesso -->
    <div style="padding:20px 28px 8px;text-align:center;">
      <a href="{{access_url}}" style="display:inline-block;background:#d4af37;color:#000000;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:18px 32px;border-radius:10px;">Acessar seu ingresso</a>
    </div>

    <!-- DETALHES DA COMPRA -->
    <div style="padding:24px 28px 8px;">
      <h2 style="color:#ffffff;font-size:15px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #2a2a2a;padding-bottom:10px;margin:0 0 18px;">Detalhes da compra</h2>
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr>
          {{event_image_html}}
          <td style="vertical-align:top;">
            <p style="color:#d4af37;font-size:19px;font-weight:bold;margin:0 0 6px;">{{event_title}}</p>
            <p style="color:#bbbbbb;font-size:13px;margin:0 0 4px;">&#x1F4CD; {{event_location}}</p>
            <p style="color:#bbbbbb;font-size:13px;margin:0 0 14px;">&#x1F4C5; {{event_date}} &nbsp;&bull;&nbsp; {{event_time}}</p>
            <p style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Ingresso(s)</p>
            <p style="color:#ffffff;font-size:14px;margin:0 0 14px;">{{tickets_summary}}</p>
            <p style="color:#ffffff;font-size:15px;margin:0;"><span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total:</span> <strong style="color:#d4af37;font-size:20px;">{{total}}</strong></p>
          </td>
        </tr>
      </table>
    </div>

    <!-- DADOS DO COMPRADOR -->
    <div style="padding:24px 28px 8px;">
      <h2 style="color:#ffffff;font-size:15px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #2a2a2a;padding-bottom:10px;margin:0 0 18px;">Dados do comprador</h2>
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        <tr><td style="color:#ffffff;font-size:14px;font-weight:bold;padding:2px 0;">{{buyer_name}}</td></tr>
        <tr><td style="color:#d4af37;font-size:13px;padding:2px 0;">{{buyer_email}}</td></tr>
        <tr><td style="color:#bbbbbb;font-size:13px;padding:2px 0;"><strong style="color:#888888;">DOC:</strong> {{buyer_document}}</td></tr>
        <tr><td style="color:#bbbbbb;font-size:13px;padding:2px 0;"><strong style="color:#888888;">PAGAMENTO:</strong> {{payment_method}}</td></tr>
        <tr><td style="color:#bbbbbb;font-size:13px;padding:2px 0;"><strong style="color:#888888;">DATA DA COMPRA:</strong> {{purchase_date}}</td></tr>
      </table>
    </div>

    <!-- QR codes dos ingressos -->
    <div style="padding:24px 28px 8px;">
      {{tickets_html}}
    </div>

    <!-- INFORMAÇÕES IMPORTANTES -->
    <div style="background:#000000;padding:32px 28px;margin-top:16px;">
      <h2 style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px;margin:0 0 4px;">INFORMA&#xc7;&#xd5;ES <span style="color:#d4af37;">IMPORTANTES</span></h2>
      <p style="color:#cccccc;font-size:13px;font-weight:bold;margin:0 0 20px;">Leia com aten&#xe7;&#xe3;o antes de prosseguir para garantir uma experi&#xea;ncia tranquila no dia do evento.</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:0 0 16px;">O seu ingresso digital &#xe9; gerado automaticamente pelo {{site_name}} assim que o pagamento da sua compra &#xe9; aprovado. Ele fica dispon&#xed;vel na sua conta no site.</p>
      <p style="color:#d4af37;font-size:14px;font-weight:bold;margin:0 0 6px;">Como acessar seu Ingresso</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:0 0 16px;">Pelo computador, voc&#xea; pode imprimir o ingresso diretamente a partir da sua conta no site. Pelo celular, basta abrir o site do {{site_name}} para visualizar o ingresso na tela; essa forma de apresenta&#xe7;&#xe3;o tamb&#xe9;m &#xe9; aceita na entrada do evento.</p>
      <p style="color:#d4af37;font-size:14px;font-weight:bold;margin:0 0 6px;">O que consta no Ingresso</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:0 0 16px;">O ingresso re&#xfa;ne todas as informa&#xe7;&#xf5;es da sua compra e do evento: local, data, hor&#xe1;rio, setor e um c&#xf3;digo de barras exclusivo que identifica cada ingresso adquirido. Ele &#xe9; o seu &#xfa;nico ingresso; nenhum material f&#xed;sico ser&#xe1; enviado ao seu endere&#xe7;o.</p>
      <p style="color:#d4af37;font-size:14px;font-weight:bold;margin:0 0 6px;">Como apresentar no dia do evento</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:0 0 16px;">Basta mostrar o ingresso impresso em papel comum ou na tela do celular, acompanhado de um documento original com foto (RG, CNH ou equivalente).</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:0 0 4px;">Em caso de d&#xfa;vidas, entre em contato conosco pelos nossos canais de atendimento.{{support_contact}}</p>
      <p style="color:#bbbbbb;font-size:13px;line-height:1.7;margin:16px 0 0;">Agradecemos por escolher o {{site_name}}.</p>
    </div>

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
  // Resolve placeholders {{nome}} de forma tolerante a caixa e espaços:
  // {{EVENT_TITLE}}, {{ event_title }} e {{Event_Title}} resolvem igual.
  // Placeholder desconhecido permanece literal (fallback ?? m).
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) normalized[key.toLowerCase()] = value;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, name) => normalized[name.toLowerCase()] ?? m);
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bloco de ingressos com QR code (mesmo serviço usado nas telas do app — o
// QR codifica o id do ticket_items, validado no check-in).
function buildTicketsHtml(tickets: Array<{ id: string; name: string }>): string {
  if (!tickets.length) return '';
  const cards = tickets
    .map(t => `
        <div style="background:#ffffff;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center;">
          <p style="color:#000000;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;border-bottom:1px solid #e5e5e5;padding-bottom:10px;">${escapeHtml(t.name)}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(t.id)}" alt="QR Code do ingresso" width="160" height="160" style="display:block;margin:0 auto;" />
          <p style="color:#888888;font-size:10px;font-family:monospace;letter-spacing:1px;margin:12px 0 0;word-break:break-all;">${escapeHtml(t.id)}</p>
        </div>`)
    .join('');
  return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#d4af37;font-size:15px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;text-align:center;">Seus ingressos</h3>
        ${cards}
      </div>`;
}

// Resumo textual dos ingressos agrupados por nome ("1x Ingresso Individual,
// 2x Mesa VIP") para o bloco "Detalhes da compra".
function buildTicketsSummary(tickets: Array<{ id: string; name: string }>): string {
  if (!tickets.length) return '—';
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const name = t.name || 'Ingresso';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, qty]) => `${qty}x ${escapeHtml(name)}`)
    .join('<br>');
}

// Nome de arquivo seguro (sem acentos/caracteres especiais) para o anexo PDF.
function slugifyFilename(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'ingresso';
}

// Gera um PDF (1 página) do ingresso com o QR code embutido, para o comprador
// baixar/apresentar na portaria. O QR codifica o id do ticket_items (mesmo
// conteúdo do QR inline do e-mail). Identidade visual: fundo escuro + ouro.
async function buildTicketPdf(
  ticket: { id: string; name: string },
  event: { title: string; date: string; time?: string; location: string },
): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(ticket.id, { width: 600, margin: 1 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 retrato (pt)
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.831, 0.686, 0.216); // #d4af37
  const white = rgb(1, 1, 1);
  const gray = rgb(0.6, 0.6, 0.6);

  // Fundo escuro
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.04, 0.04, 0.04) });

  const centerText = (text: string, y: number, size: number, f = font, color = white) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };

  centerText('ESPAÇO MIX', height - 70, 12, fontBold, gold);
  centerText(event.title.slice(0, 60), height - 110, 22, fontBold, white);
  const dateLine = `${formatDate(event.date)}${event.time ? ` • ${event.time}` : ''}`;
  centerText(dateLine, height - 138, 12, font, gray);
  centerText(event.location.slice(0, 70), height - 158, 12, font, gray);

  // Cartão branco com o QR ao centro
  const cardSize = 320;
  const cardX = (width - cardSize) / 2;
  const cardY = height - 158 - 40 - cardSize;
  page.drawRectangle({ x: cardX, y: cardY, width: cardSize, height: cardSize, color: white });
  const qrImg = await pdf.embedPng(qrPng);
  const qrSize = 260;
  page.drawImage(qrImg, {
    x: (width - qrSize) / 2,
    y: cardY + (cardSize - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  centerText(ticket.name.slice(0, 50), cardY - 40, 16, fontBold, gold);
  centerText(ticket.id, cardY - 62, 9, font, gray);
  centerText('Apresente este QR code na entrada do evento.', cardY - 100, 11, font, gray);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
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
  site_name?: string;
  site_logo_url?: string;
  support_email?: string;
  contact_email?: string;
  contact_phone?: string;
}

async function loadConfig(): Promise<EmailConfig | null> {
  const db = getAdminClient();
  if (!db) return null;
  const { data } = await db
    .from('system_config')
    .select('email_sender_name,email_sender_address,email_purchase_subject,email_purchase_body,email_reminder_subject,email_reminder_body,notify_purchase,notify_reminder,site_name,site_logo_url,support_email,contact_email,contact_phone')
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
  // Remetente configurado (domínio verificado). Em produção NÃO usamos o domínio
  // de teste onboarding@resend.dev como fallback: ele não entrega a partir de um
  // domínio próprio e cai em spam. Falhar claro força a configuração correta.
  const senderAddress = cfg.email_sender_address || process.env.EMAIL_SENDER_ADDRESS || '';
  if (!senderAddress && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Remetente de e-mail não configurado — defina EMAIL_SENDER_ADDRESS (ou email_sender_address no painel) com um domínio verificado no Resend.',
    );
  }
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
    // Fora de produção, mantém o domínio de teste do Resend para facilitar dev/testes.
    senderAddress: senderAddress || 'onboarding@resend.dev',
  };
}

/**
 * Envia um e-mail pelo provedor configurado (Resend ou SMTP).
 * `replyTo` (opcional) define o endereço de resposta — usado, por exemplo, no
 * formulário de contato para que o atendente responda direto ao visitante.
 */
export async function sendMail(
  cfg: ResolvedEmailConfig,
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
  attachments?: Array<{ filename: string; content: Buffer }>,
): Promise<void> {
  const from = `${cfg.senderName} <${cfg.senderAddress}>`;
  const hasAttachments = !!attachments && attachments.length > 0;
  if (cfg.provider === 'smtp' && cfg.smtp.host) {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port || 587,
      secure: !!cfg.smtp.secure,
      auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.password } : undefined,
    });
    await transporter.sendMail({
      from, to, subject, html, replyTo,
      ...(hasAttachments ? { attachments: attachments!.map(a => ({ filename: a.filename, content: a.content })) } : {}),
    });
    return;
  }
  if (!cfg.resendApiKey) throw new Error('Provedor de e-mail não configurado.');
  const resend = new Resend(cfg.resendApiKey);
  const { error } = await resend.emails.send({
    from, to, subject, html,
    ...(replyTo ? { replyTo } : {}),
    ...(hasAttachments ? { attachments: attachments!.map(a => ({ filename: a.filename, content: a.content })) } : {}),
  });
  if (error) throw new Error((error as any).message || 'Falha no envio (Resend).');
}

/** Envio de teste — usado pelo onboarding/Configurações. */
export async function sendTestEmail(to: string): Promise<void> {
  const cfg = await resolveEmailConfig();
  await sendMail(
    cfg,
    to,
    'Teste de envio — Espaço Mix',
    `<div style="font-family:Arial,sans-serif;padding:24px;background:#0a0a0a;color:#fff">
       <h2 style="color:#d4af37">✅ E-mail de teste enviado com sucesso</h2>
       <p>Se você recebeu esta mensagem, a configuração de e-mail (${cfg.provider.toUpperCase()}) está funcionando.</p>
     </div>`,
  );
}

/** Mensagem do formulário de Contato → enviada ao e-mail de atendimento. */
export async function sendContactMessage(params: {
  nome: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  evento?: string;
  mensagem: string;
}): Promise<void> {
  const db = getAdminClient();
  let to = process.env.CONTACT_EMAIL || process.env.EMAIL_SENDER_ADDRESS || '';
  let siteName = 'Espaço Mix';
  if (db) {
    const { data } = await db
      .from('system_config')
      .select('contact_email,support_email,site_name')
      .eq('id', 'main')
      .maybeSingle();
    to = (data?.contact_email || data?.support_email || to) as string;
    siteName = (data?.site_name as string) || siteName;
  }
  if (!to) throw new Error('E-mail de atendimento não configurado.');

  const esc = (v?: string) =>
    String(v ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const row = (label: string, value?: string) =>
    value ? `<tr><td style="color:#888;padding:4px 12px 4px 0;">${label}</td><td style="color:#fff;">${esc(value)}</td></tr>` : '';

  const html = `<div style="font-family:Arial,sans-serif;padding:24px;background:#0a0a0a;color:#fff">
    <h2 style="color:#d4af37;margin:0 0 16px">Nova mensagem de contato — ${esc(siteName)}</h2>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
      ${row('Nome', params.nome)}
      ${row('E-mail', params.email)}
      ${row('Telefone', params.telefone)}
      ${row('Cidade', params.cidade)}
      ${row('Estado', params.estado)}
      ${row('Evento', params.evento)}
    </table>
    <div style="background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;white-space:pre-wrap;color:#ddd;font-size:14px">${esc(params.mensagem)}</div>
  </div>`;

  const cfg = await resolveEmailConfig();
  // Reply-To = e-mail do visitante, para que a resposta vá direto a ele
  // (o From continua o do sistema, exigência dos provedores de e-mail).
  const replyTo = /.+@.+\..+/.test(params.email) ? params.email : undefined;
  await sendMail(cfg, to, `Contato: ${esc(params.nome)} — ${esc(siteName)}`, html, replyTo);
}

/** Convite de transferência de ingresso enviado ao destinatário. */
export async function sendTransferInvitation(params: {
  toEmail: string;
  fromName: string;
  eventTitle: string;
  ticketName: string;
  acceptUrl: string;
}): Promise<void> {
  const cfg = await resolveEmailConfig();
  const { toEmail, fromName, eventTitle, ticketName, acceptUrl } = params;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:16px">
      <h1 style="color:#d4af37;font-size:22px;margin:0 0 8px">Você recebeu um ingresso!</h1>
      <p style="color:#cfcfcf;font-size:14px;line-height:1.6;font-family:Arial,sans-serif">
        <strong style="color:#fff">${fromName}</strong> deseja transferir um ingresso para você.
      </p>
      <div style="background:#111;border:1px solid #d4af3733;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 6px;color:#d4af37;font-size:16px">${eventTitle}</p>
        <p style="margin:0;color:#aaa;font-size:13px;font-family:Arial,sans-serif">${ticketName}</p>
      </div>
      <p style="color:#cfcfcf;font-size:13px;line-height:1.6;font-family:Arial,sans-serif">
        Para receber o ingresso na sua conta, clique no botão abaixo e confirme a transferência.
        Você precisa estar logado com este e-mail (${toEmail}).
      </p>
      <a href="${acceptUrl}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#d4af37;color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:999px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase">
        Aceitar ingresso
      </a>
      <p style="color:#777;font-size:11px;margin-top:24px;font-family:Arial,sans-serif">
        Se você não esperava este convite, basta ignorar este e-mail. O convite expira automaticamente.
      </p>
    </div>`;
  await sendMail(cfg, toEmail, `${fromName} transferiu um ingresso para você — ${eventTitle}`, html);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export interface ConfirmationData {
  buyerName: string;
  buyerEmail: string;
  buyerDocument?: string;
  purchaseDate?: string;
  reservationId: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventLocation: string;
  eventImage?: string;
  total: number;
  paymentMethod: string;
  tickets?: Array<{ id: string; name: string }>;
}

/**
 * Envia o e-mail de confirmação de compra. Lança em caso de falha — quem chama
 * (webhook/rotas) decide registrar em audit_logs e/ou liberar reenvio.
 * Retorna false quando o envio foi pulado por escolha do admin (notify_purchase).
 */
export async function sendConfirmationEmail(data: ConfirmationData): Promise<boolean> {
  const config = await loadConfig();
  if (config?.notify_purchase === false) return false;

  const email = await resolveEmailConfig();
  if (email.provider === 'resend' && !email.resendApiKey) {
    throw new Error('Provedor de e-mail não configurado (Resend sem API key e SMTP ausente).');
  }

  const siteName = config?.site_name || 'Espaço Mix';
  const accessUrl = (process.env.APP_URL || '').trim();
  const logoUrl = config?.site_logo_url || '';
  const siteLogoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteName)}" height="40" style="display:block;max-height:40px;" />`
    : `<span style="color:#d4af37;font-size:22px;font-weight:bold;font-family:Georgia,serif;letter-spacing:1px;">${escapeHtml(siteName)}</span>`;
  const eventImageHtml = data.eventImage
    ? `<td width="150" style="vertical-align:top;padding-right:18px;"><img src="${escapeHtml(data.eventImage)}" alt="${escapeHtml(data.eventTitle)}" width="150" style="display:block;width:150px;border-radius:8px;" /></td>`
    : '';
  const supportBits: string[] = [];
  const supportMail = config?.support_email || config?.contact_email;
  if (supportMail) supportBits.push(escapeHtml(supportMail));
  if (config?.contact_phone) supportBits.push(escapeHtml(config.contact_phone));
  const supportContact = supportBits.length ? ` (${supportBits.join(' • ')})` : '';

  const vars: Record<string, string> = {
    buyer_name: escapeHtml(data.buyerName),
    buyer_email: escapeHtml(data.buyerEmail),
    buyer_document: escapeHtml(data.buyerDocument || 'Não informado'),
    purchase_date: escapeHtml(data.purchaseDate || formatDate(new Date().toISOString().slice(0, 10))),
    event_title: escapeHtml(data.eventTitle),
    event_date: formatDate(data.eventDate),
    event_time: data.eventTime ?? 'A confirmar',
    event_location: escapeHtml(data.eventLocation),
    event_image_html: eventImageHtml,
    reservation_id: escapeHtml(data.reservationId),
    total: `R$ ${data.total.toFixed(2).replace('.', ',')}`,
    payment_method: formatPaymentMethod(data.paymentMethod),
    tickets_html: buildTicketsHtml(data.tickets ?? []),
    tickets_summary: buildTicketsSummary(data.tickets ?? []),
    access_url: escapeHtml(accessUrl),
    site_name: escapeHtml(siteName),
    site_logo_html: siteLogoHtml,
    support_contact: supportContact,
  };

  // Assunto é texto puro: usa os valores SEM escape de HTML (evita "&amp;" etc.).
  const subject = processTemplate(config?.email_purchase_subject ?? PURCHASE_SUBJECT_DEFAULT, {
    ...vars,
    buyer_name: data.buyerName,
    event_title: data.eventTitle,
    event_location: data.eventLocation,
  });
  let bodyTemplate = config?.email_purchase_body ?? PURCHASE_BODY_DEFAULT;
  // Template customizado sem {{tickets_html}}: injetar QRs antes do </body>
  if (config?.email_purchase_body && !bodyTemplate.includes('{{tickets_html}}') && (data.tickets?.length ?? 0) > 0) {
    const qrBlock = buildTicketsHtml(data.tickets ?? []);
    bodyTemplate = bodyTemplate.includes('</body>')
      ? bodyTemplate.replace('</body>', `${qrBlock}</body>`)
      : bodyTemplate + qrBlock;
  }
  const html = processTemplate(bodyTemplate, vars);

  // 1 PDF por ingresso, para o comprador baixar/apresentar na portaria.
  // Os QRs continuam também no corpo do e-mail (tickets_html).
  let attachments: Array<{ filename: string; content: Buffer }> | undefined;
  const tickets = data.tickets ?? [];
  if (tickets.length > 0) {
    const evt = {
      title: data.eventTitle,
      date: data.eventDate,
      time: data.eventTime,
      location: data.eventLocation,
    };
    try {
      attachments = await Promise.all(
        tickets.map(async t => ({
          filename: `ingresso-${slugifyFilename(t.name)}-${t.id.slice(0, 8)}.pdf`,
          content: await buildTicketPdf(t, evt),
        })),
      );
    } catch (err: any) {
      // Falha ao gerar PDF não deve impedir o e-mail (QR já está no corpo).
      console.error('[EMAIL] Falha ao gerar PDF do ingresso:', err?.message);
      attachments = undefined;
    }
  }

  await sendMail(email, data.buyerEmail, subject, html, undefined, attachments);
  const masked = data.buyerEmail.replace(/(^.).*(@.*$)/, '$1***$2');
  console.log(`[EMAIL] Confirmação enviada → ${masked}`);
  return true;
}

export interface ReminderData {
  buyerName?: string;
  buyerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventLocation: string;
  reservationId: string;
}

// Monta assunto+corpo do lembrete a partir do template (custom ou padrão).
// Compartilhado pelo cron (sendReminderEmails) e pelo envio avulso/teste.
function buildReminderContent(
  config: EmailConfig | null,
  data: ReminderData,
): { subject: string; html: string } {
  const vars: Record<string, string> = {
    buyer_name: data.buyerName ?? 'Participante',
    event_title: data.eventTitle,
    event_date: formatDate(data.eventDate),
    event_time: data.eventTime ?? 'A confirmar',
    event_location: data.eventLocation,
    reservation_id: data.reservationId,
    total: '',
  };
  const subject = processTemplate(config?.email_reminder_subject ?? REMINDER_SUBJECT_DEFAULT, vars);
  const html = processTemplate(config?.email_reminder_body ?? REMINDER_BODY_DEFAULT, vars);
  return { subject, html };
}

/**
 * Envia um lembrete avulso para um destinatário específico (ex.: e-mail de
 * teste do painel). Respeita notify_reminder. Retorna false quando pulado.
 */
export async function sendReminderEmailTo(data: ReminderData): Promise<boolean> {
  const config = await loadConfig();
  if (config?.notify_reminder === false) return false;

  const email = await resolveEmailConfig();
  if (email.provider === 'resend' && !email.resendApiKey) {
    throw new Error('Provedor de e-mail não configurado (Resend sem API key e SMTP ausente).');
  }

  const { subject, html } = buildReminderContent(config, data);
  await sendMail(email, data.buyerEmail, subject, html);
  const masked = data.buyerEmail.replace(/(^.).*(@.*$)/, '$1***$2');
  console.log(`[EMAIL] Lembrete avulso enviado → ${masked}`);
  return true;
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

  // status é gravado em inglês no banco (ver STATUS_TO_DB): 'active' = Ativo, 'sales_open' = Vendas liberadas.
  const { data: events } = await db
    .from('events')
    .select('id, title, date, time, location')
    .eq('date', tomorrowDate)
    .in('status', ['active', 'sales_open']);

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

    const { subject, html } = buildReminderContent(config, {
      buyerName: res.buyer_name,
      buyerEmail: res.buyer_email,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventLocation: event.location,
      reservationId: res.id,
    });

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
