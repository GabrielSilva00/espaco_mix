<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Terminal 1 — Backend:
   npm run dev:server

4. Terminal 2 — Frontend:
   npm run dev

5. Instalar dontenv
   npm install dotenv


GITS
1. git pull:  Puxar projeto atualizado
2. git init:  Inicializa um novo repositório Git em uma pasta local.
3. git clone <url>: Clona um repositório remoto para a sua máquina.
4. git config --global user.name "Seu Nome": Define o nome de usuário global.
5. git config --global user.email "seu@email.com": Define o e-mail global.

 
  Para testar o PWA localmente, rode o build de produção (o service worker só funciona em produção):

  npm run build
  npm run preview

  Depois abra http://localhost:4173 no Chrome — o botão de instalação vai aparecer na barra de endereço.

  Fix 2 — RLS do Supabase (você precisa rodar)

  O banco está bloqueando leitura das tabelas events, batches e sectors para visitantes não autenticados. Você precisa rodar o script SQL criado:

  1. Acesse o Supabase Dashboard (https://supabase.com/dashboard)
  2. Vá em SQL Editor → New Query
  3. Cole e execute o conteúdo de scripts/rls-events-public.sql

  Isso cria políticas que permitem a qualquer visitante (sem login) ler eventos que não sejam rascunho — o que é o comportamento correto para uma vitrine pública de
  eventos.

     }

    res.status(400).json({ error: "Provedor de pagamento não reconhecido." });
  });

  
  ---
  Passo 6 — Adicionar o tipo cardToken no request do frontend

  No CheckoutModal.tsx, quando o usuário escolher cartão, você precisará tokenizar com o SDK JS do MP antes de enviar ao servidor. Por agora, para testar apenas PIX, não
   precisa alterar o frontend.

  ---
  Passo 7 — Expor o servidor local para webhook (opcional mas recomendado)

  O Mercado Pago envia uma notificação quando o pagamento muda de status. Para receber localmente:

  # Instale ngrok (se não tiver)
  npm install -g ngrok

  # Em outro terminal, exponha a porta 3000
  ngrok http 3000

  Copie a URL gerada (ex: https://abc123.ngrok.io) e registre no painel do MP:
  Suas integrações → Webhooks → Criar webhook → URL: https://abc123.ngrok.io/api/webhook/mercadopago

  ---
  Passo 8 — Testar um pagamento PIX

  Dados para teste (cartão de crédito)

  ┌──────────┬────────────────────────────────────┐
  │  Campo   │               Valor                │
  ├──────────┼────────────────────────────────────┤
  │ Número   │ 5031 7557 3453 0604 (Mastercard)   │
  ├──────────┼────────────────────────────────────┤
  │ Validade │ qualquer data futura               │
  ├──────────┼────────────────────────────────────┤
  │ CVV      │ 123                                │
  ├──────────┼────────────────────────────────────┤
  │ Nome     │ APRO (aprovado) / OTHE (rejeitado) │
  ├──────────┼────────────────────────────────────┤
  │ CPF      │ 12345678909                        │
  └──────────┴────────────────────────────────────┘

  Fluxo PIX

  1. Inicie os servidores:
  # Terminal 1
  npm run dev:server

  # Terminal 2
  npm run dev
  2. Abra http://localhost:5173
  3. Selecione um evento → escolha ingresso/mesa → avance para o checkout
  4. Escolha PIX e preencha os dados
  5. O QR code retornado é real (de teste) mas o pagamento precisa ser simulado

  Simular aprovação do PIX via API

  curl -X POST \
    "https://api.mercadopago.com/v1/payments/{PAYMENT_ID}/simulate" \
    -H "Authorization: Bearer TEST-seu-access-token" \
    -H "Content-Type: application/json" \
    -d '{"status": "approved"}'

  Substitua {PAYMENT_ID} pelo id retornado no JSON da resposta do servidor.

  ---
  Passo 9 — Verificar logs

  No terminal do npm run dev:server, você verá:

  [PAYMENT] Provider: mercadopago | Mode: pix | User: g***@email.com

  Se aparecer erro [MP] Erro ao criar pagamento, o terminal mostrará a mensagem exata da API do MP para diagnóstico.

  PAYMENT_PROVIDER=mercadopago
  MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxx

  Quando estiver pronto para produção, basta trocar o token para o Access Token de Produção (começa com APP_USR-) e mudar PAYMENT_PROVIDER=mercadopago — o código não
  muda.