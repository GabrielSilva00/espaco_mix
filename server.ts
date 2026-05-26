import express from "express";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

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

// ─── Server ─────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const PORT = Number(process.env.PORT ?? 3000);
  const appUrl = process.env.APP_URL;
  const paymentProvider = process.env.PAYMENT_PROVIDER ?? (isProduction ? "disabled" : "mock");
  const allowMockPayments = process.env.ALLOW_MOCK_PAYMENTS === "true";

  if (isProduction && !appUrl) {
    throw new Error("APP_URL é obrigatória em produção para configurar CORS.");
  }

  // ── Security Headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'", "https://*.supabase.co"],
              fontSrc: ["'self'", "data:"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
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

  app.use(globalLimiter);

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

  // ── Payment Intent ────────────────────────────────────────────────────────
  app.post("/api/create-payment-intent", paymentLimiter, requireAuth, async (req, res) => {
    const { items, guestData, paymentMethod } = req.body as {
      items?: unknown[];
      guestData?: { name?: string; email?: string; cpf?: string };
      paymentMethod?: string;
    };

    const allowedMethods = new Set(["pix", "credit_card", "debit_card", "boleto"]);

    if (isProduction && paymentProvider === "mock" && !allowMockPayments) {
      res.status(503).json({
        error: "Pagamento indisponível: provedor real não configurado em produção.",
      });
      return;
    }

    if (paymentProvider === "disabled") {
      res.status(503).json({ error: "Pagamento desabilitado no servidor." });
      return;
    }

    if (!guestData?.email || !guestData?.name) {
      res.status(400).json({ error: "Dados do comprador ausentes ou inválidos." });
      return;
    }

    if (!paymentMethod || !allowedMethods.has(paymentMethod)) {
      res.status(400).json({ error: "Forma de pagamento não selecionada ou inválida." });
      return;
    }

    const guestName = String(guestData.name).trim();
    const guestEmail = String(guestData.email).trim().toLowerCase();

    if (guestName.length < 2 || guestName.length > 120) {
      res.status(400).json({ error: "Nome do comprador inválido." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      res.status(400).json({ error: "E-mail do comprador inválido." });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Nenhum item informado para pagamento." });
      return;
    }

    if (guestData.cpf && !validateCpf(guestData.cpf)) {
      res.status(400).json({ error: "CPF do comprador inválido." });
      return;
    }

    const maskedEmail = guestEmail.replace(/(^.).*(@.*$)/, "$1***$2");
    console.log(`[PAYMENT] Provider: ${paymentProvider} | Mode: ${paymentMethod} | User: ${maskedEmail}`);

    const response = {
      id: "tr_" + Math.random().toString(36).substring(7),
      status: "pending",
      method: paymentMethod,
    };

    // TODO: integrate real gateway when PAYMENT_PROVIDER is set to stripe/mercadopago.
    if (paymentMethod === "pix") {
      res.json({
        ...response,
        pix: {
          qr_code: "00020101021226...",
          qr_code_base64: "",
          copy_paste: "00020101021226850014br.gov.bcb.pix0123yourkeyhere...",
        },
      });
    } else {
      res.json({
        ...response,
        clientSecret: "pi_fake_secret_" + Math.random().toString(36).substring(7),
        paymentUrl: "https://example.com/pay",
      });
    }
  });

  // ── Admin Routes ──────────────────────────────────────────────────────────
  app.get("/api/admin/settings", requireAuth, (req, res) => {
    const user = (req as any).user;
    // Role check must be done server-side after verifying the Firebase token.
    // In production, store the user role in Firestore and check it here.
    console.log(`[ADMIN] Settings accessed by ${user?.uid}`);
    res.json({ message: "Admin settings fetched." });
  });

  app.post("/api/producer/rejection-email", requireAuth, (req, res) => {
    const { userId, email, name, reason } = req.body as {
      userId?: string;
      email?: string;
      name?: string;
      reason?: string;
    };

    if (!userId || !email || !reason || reason.trim().length < 20) {
      res.status(400).json({ error: "Dados invalidos para envio de rejeicao." });
      return;
    }

    const safeEmail = String(email).replace(/(^.).*(@.*$)/, "$1***$2");
    console.log(`[APPROVAL] Rejection email queued for ${safeEmail} (${name ?? userId})`);
    res.status(202).json({ success: true });
  });

  // ── LGPD Privacy Policy ───────────────────────────────────────────────────
  app.get("/api/privacy-policy", (_req, res) => {
    res.json({
      policy:
        "Esta plataforma coleta apenas os dados necessários para a emissão de ingressos e prevenção de fraudes. Seus dados são armazenados de forma segura e não são compartilhados com terceiros sem seu consentimento explícito.",
      data_collected: ["Nome", "E-mail", "CPF"],
      rights: ["Acesso aos dados", "Exclusão de conta", "Correção de informações"],
      lastUpdated: "2026-05-06",
    });
  });

  // Rotas /api/* não encontradas — deve vir ANTES do middleware Vite
  // (em dev, o Vite intercepta rotas desconhecidas e retorna 200 com index.html)
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // ── Frontend ──────────────────────────────────────────────────────────────
  if (!isProduction) {
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

startServer();
