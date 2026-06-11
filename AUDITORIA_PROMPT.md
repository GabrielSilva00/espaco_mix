Você é um engenheiro sênior full-stack. Sua missão é auditar, corrigir e elevar à qualidade de produção a plataforma de venda de ingressos **Eventix**, localizada em C:\Gabriel\Portifolio\espaco_mix. O objetivo final é que o site funcione de forma completa e sem falhas, comparável a plataformas como Sympla e Bilheteriadigital.

---

## CONTEXTO DO PROJETO

Stack:
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS
- Backend: Express.js (server.ts, ~2.300 linhas) + serverless Vercel (api/index.ts)
- Banco: Supabase (PostgreSQL com RLS)
- Pagamento: Mercado Pago Orders API (/v1/orders) — PIX e Cartão
- E-mail: Resend ou SMTP (nodemailer) configurado via painel admin
- Deploy: Vercel (plano Hobby, sem crons nativos)

Arquivos principais:
- server.ts — backend Express completo (auth, pagamento, webhook, email, check-in)
- emailService.ts — envio de e-mails (confirmação, lembretes, broadcast)
- src/App.tsx — roteamento e lazy loading do React
- src/context/AppContext.tsx — estado global
- src/modules/payment/CheckoutModal.tsx — fluxo de checkout
- src/modules/booking/BookingView.tsx — página de compra pública
- src/modules/dashboard/DashboardView.tsx — painel admin/produtor
- src/lib/supabase.ts — cliente Supabase e interfaces TypeScript
- src/types/index.ts — tipos centrais

---

## PROBLEMAS CONFIRMADOS PELO USUÁRIO (PRIORIDADE MÁXIMA)

### P1 — QR Code do ingresso retorna "não pago" após pagamento aprovado
O pagamento é aprovado pelo Mercado Pago mas ao bipar o QR code no check-in, o sistema diz que o ingresso ainda não foi pago. Investigar e corrigir:
- O webhook `/api/webhook/mercadopago` recebe a notificação corretamente?
- O webhook valida a assinatura HMAC e não rejeita silenciosamente?
- O webhook atualiza `reservations.payment_status` para "approved" no banco?
- O check-in (`/api/checkin`) verifica o campo certo (`payment_status === 'approved'`)?
- O QR code está codificando o `ticket_items.id` correto?
- O webhook consulta a Orders API corretamente para confirmar o status? (Atenção: o código pode estar consultando `/v1/payments/{id}` legado — se o pagamento foi criado via `/v1/orders`, o ID retornado no webhook pode ser um `order_id`, não um `payment_id`. Verificar qual campo o MP envia na notificação para a Orders API e ajustar a consulta de confirmação).

### P2 — Cliente não recebe ingresso por e-mail após pagamento
O cliente finaliza o pagamento mas não recebe o e-mail de confirmação com o ingresso. Investigar e corrigir:
- O webhook aciona `sendConfirmationEmail()` quando o status muda para "approved"?
- `EMAIL_SENDER_ADDRESS` e `EMAIL_SENDER_NAME` estão configurados? (O servidor pode estar tentando enviar sem remetente válido)
- O `emailService.ts` lida corretamente com falha no envio (não engole erros silenciosamente)?
- O template HTML do e-mail de confirmação inclui o QR code do ingresso e/ou link para visualizá-lo?
- Se usando Resend: o domínio está verificado? O remetente usa o domínio verificado?
- Se usando SMTP: as credenciais estão corretas?
- Adicionar logs adequados para rastrear falhas de envio.

### P3 — Site atualiza e não carrega o banco (falhas de fetch/estado)
Em certas situações o site atualiza/recarrega e não carrega os dados do banco (eventos, reservas, etc). Investigar:
- Os erros de chunk do Vite (lazy loading falha, `retry` e forçar reload) estão causando loops?
- As queries ao Supabase têm tratamento de erro adequado com retry?
- O estado global (AppContext) reseta corretamente sem deixar dados parciais?
- Há race conditions em `useEffect` que causam estados inconsistentes?
- Os Suspense boundaries estão bem posicionados?
- Existe algum caso em que o token Supabase expira e as queries falham silenciosamente?
- O cliente Supabase está sendo inicializado antes de ser usado?

---

## AUDITORIA COMPLETA OBRIGATÓRIA

Além dos problemas confirmados, realize uma auditoria completa em todas as áreas abaixo:

### 1. FLUXO DE COMPRA PONTA A PONTA
Trace e corrija todo o fluxo:
1. Usuário acessa evento em BookingView
2. Seleciona ingressos/mesas/setor
3. Abre CheckoutModal e insere dados
4. Cria reserva (`POST /api/reservations`) com status "pending"
5. Realiza pagamento via Cartão (`POST /api/payment/mercadopago`) ou PIX (`POST /api/payment/pix`)
6. MP processa e envia webhook (`POST /api/webhook/mercadopago`)
7. Webhook atualiza `reservations.payment_status` → "approved"
8. E-mail de confirmação é enviado com ingressos
9. Cliente acessa "Minhas Reservas" e vê ingresso com QR code
10. Portaria escaneia QR code em `/api/checkin` → ingresso validado

Verificar cada etapa: o que pode falhar? O que não está implementado? O que tem lógica errada?

### 2. WEBHOOK MERCADO PAGO (CRÍTICO)
- Verificar qual tipo de notificação o MP envia para pagamentos criados via Orders API (`/v1/orders`): o campo `data.id` da notificação é um `order_id` ou `payment_id`?
- O webhook atual (`/api/webhook/mercadopago`) consulta `/v1/payments/{id}` (API legada). Se o pagamento foi criado via Orders API, o webhook DEVE consultar `GET /v1/orders/{order_id}` e extrair o status de `data.transactions.payments[0].status`
- Corrigir o webhook para suportar ambos os formatos (Orders API e legado) detectando pelo tipo de notificação
- Garantir que `MERCADOPAGO_WEBHOOK_SECRET` ausente não cause rejeição silenciosa — se o secret não estiver configurado, o webhook deve logar um aviso mas ainda processar a notificação (modo permissivo) ou documentar claramente que precisa ser configurado
- Garantir que o webhook atualiza `ticket_items.status` para "active" quando reserva é aprovada (se ainda "pending")
- Garantir que o webhook dispara o envio de e-mail de confirmação

### 3. BANCO DE DADOS (SUPABASE)
Analisar o schema atual e verificar:
- Há campos faltando que causam bugs? (ex: `pix_qr_code`, `pix_copy_paste` em reservations?)
- As políticas RLS permitem que o webhook (service role) atualize `reservations`?
- As políticas RLS permitem que o usuário autenticado leia seus próprios `ticket_items`?
- `system_config` expõe dados sensíveis publicamente? Corrigir RLS
- A tabela `ticket_items` tem todos os campos necessários para gerar e validar QR codes?
- Criar/alterar/remover tabelas e campos conforme necessário
- Escrever e aplicar as migrações SQL necessárias (via `scripts/run-migration.ts` ou script ad-hoc com transaction pooler porta 6543)
- Verificar se a migração `20260609_onboarding_flag.sql` (campo `onboarding_completed` em `system_config`) foi aplicada; se não, aplicar

### 4. SISTEMA DE E-MAIL
- Verificar configuração completa: provider, credenciais, remetente, domínio
- `sendConfirmationEmail()` deve incluir: código da reserva, lista de ingressos, QR codes (como imagem inline ou link), dados do evento (nome, data, local)
- Template responsivo (funciona em clientes de e-mail mobile)
- Tratamento de erro robusto com log detalhado
- Se e-mail falhar, registrar em `audit_logs` para reenvio manual
- Implementar rota de reenvio de e-mail de confirmação no painel admin

### 5. SISTEMA DE CHECK-IN
- QR code deve codificar `ticket_items.id` (verificar se está correto)
- `/api/checkin` deve verificar: ticket existe, `payment_status === 'approved'`, ticket não cancelado, ticket não já usado (checked_in_at is null)
- Retornar erro claro e específico para cada caso (não genérico "ingresso inválido")
- Prevenir double-scan (lock ou dedupe por tempo)
- Interface de portaria deve atualizar em tempo real após check-in

### 6. AUTENTICAÇÃO E SESSÃO
- Token Supabase expira? O frontend renova automaticamente?
- Usuário deslogado não deve ver dados privados
- Redirecionar corretamente após login
- OTP por e-mail: fluxo completo funcional (enviar, verificar, reenviar)?
- Staff token: expiração correta, invalidação quando staff desativado

### 7. UI/UX — DESKTOP
Percorra todas as telas e corrija:
- **Home/Landing:** carregamento de eventos, filtros, busca, imagens quebradas, loading states
- **BookingView:** seleção de ingressos/mesas/setores, countdown de disponibilidade, erro de capacidade
- **CheckoutModal:** cada passo (dados pessoais → OTP → pagamento), validações em tempo real, feedback de erro claro
- **PIX:** QR code visível, timer de expiração, botão "copiar código", polling de status ou webhook realtime
- **Cartão:** campos com máscara, feedback de erro do MP, parcelamento
- **Minhas Reservas:** lista de reservas com status claro, QR code acessível, transferência, cancelamento
- **Dashboard Admin:** métricas corretas, gráficos, listas de reservas, controles de evento
- **Controle de Portaria:** interface de check-in funcional, lista de ingressos, histórico
- Tratar todos os estados: loading, erro, vazio, sucesso
- Mensagens de erro amigáveis (sem stacktraces expostos)
- Modais com scroll adequado para conteúdo longo
- Confirmar ações destrutivas (cancelar ingresso, reembolsar)

### 8. UI/UX — MOBILE (CRÍTICO)
O site deve funcionar perfeitamente em smartphones:
- Navegação: menu hamburguer funcional, sem elementos cortados
- BookingView: rolagem suave, botões com tamanho adequado para toque (min 44px)
- CheckoutModal: campos de formulário não causam zoom indesejado (font-size ≥ 16px em inputs)
- QR code PIX: tamanho adequado na tela, botão de copiar fácil de acessar
- QR code do ingresso: tamanho legível para scanner
- Modais: ocupam tela inteira ou têm scroll adequado
- TabBar/NavBar: não oculta conteúdo importante
- Imagens: responsivas, não causam scroll horizontal
- Testar breakpoints: 375px (iPhone SE), 390px (iPhone 14), 412px (Android médio)
- Botões de ação principal: sempre visíveis sem scroll desnecessário
- Evitar elementos que se sobrepõem

### 9. PERFORMANCE E ESTABILIDADE
- Lazy loading configurado corretamente (chunks não falham em produção)
- Queries ao Supabase otimizadas (evitar N+1)
- Imagens com lazy loading e fallback
- Cache de dados onde adequado (eventos públicos)
- Sem memory leaks em useEffect (cleanup functions)
- Error boundaries em componentes críticos para evitar crash total da página

### 10. SEGURANÇA
- Verificar se endpoint de webhook está acessível publicamente (não requer auth, só HMAC)
- Garantir que nenhuma rota admin está acessível sem autenticação
- Verificar se CORS está configurado corretamente em produção
- Input sanitization em todos os campos de formulário
- Rate limiting adequado em endpoints de pagamento e auth
- Não expor stacktraces ou dados internos nas respostas de erro

### 11. VARIÁVEIS DE AMBIENTE
Verificar se todas as variáveis necessárias estão documentadas e validadas no startup:
- `ENCRYPTION_KEY` (64 hex chars) — obrigatória
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`, `VITE_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET` — documentar como configurar no painel MP
- `EMAIL_SENDER_ADDRESS`, `EMAIL_SENDER_NAME`
- `RESEND_API_KEY` ou configuração SMTP
- `CRON_SECRET`
Adicionar validação no startup do servidor que falha com mensagem clara se variável crítica ausente.

---

## INSTRUÇÕES DE EXECUÇÃO

### Metodologia
1. **Leia primeiro, edite depois.** Leia cada arquivo completamente antes de editar. Nunca edite com base em suposições.
2. **Trace o fluxo completo** de cada problema antes de corrigir. Entenda causa raiz, não apenas sintoma.
3. **Uma correção por vez.** Faça a mudança, verifique que faz sentido, prossiga.
4. **Não introduza regressões.** Ao corrigir um problema, verifique se a mudança quebra outro fluxo.
5. **Sem comentários desnecessários.** Só adicione comentário se o "por quê" for não-óbvio.
6. **Preserve a identidade visual.** Ouro #d4af37, preto/cinza escuro, serif nos títulos — não altere o design intencionalmente.

### Banco de Dados
- Para aplicar migrações SQL use o transaction pooler do Supabase (porta 6543)
- Connection string está em `.env` como `SUPABASE_DB_URL`
- Use `scripts/run-migration.ts` ou script Node com `pg` e `ssl: { rejectUnauthorized: false }`
- Sempre use transações (`BEGIN`/`COMMIT`) para alterações de schema
- Prefira `ALTER TABLE ADD COLUMN IF NOT EXISTS` para não quebrar schema existente

### Testes
- Após cada correção principal, verifique se compila: `npm run lint`
- Para testar o webhook localmente, use ngrok ou localtunnel para expor o servidor local
- Para testar e-mail, use `/api/admin/test-email`
- Para testar pagamento MP, use credenciais de sandbox com test users e cartões de teste documentados em `MERCADOPAGO_SETUP.md`
- Verifique os testes Playwright existentes em `tests/` e execute se relevante

### Prioridade de Execução
Resolva nesta ordem:
1. Webhook MP → atualização de status (P1)
2. Envio de e-mail de confirmação (P2)
3. Check-in com QR code (P1)
4. Falhas de carregamento do banco (P3)
5. Auditoria UI/UX mobile
6. Auditoria UI/UX desktop
7. Todos os demais itens da auditoria

---

## ENTREGÁVEIS ESPERADOS

Ao final, o site deve:
- [ ] Pagamento aprovado pelo MP → `reservation.payment_status` atualizado para "approved" no banco
- [ ] Cliente recebe e-mail de confirmação com QR code(s) após pagamento aprovado
- [ ] QR code do ingresso → check-in valida corretamente como "aprovado"
- [ ] Site carrega dados do banco de forma confiável após refresh/navegação
- [ ] Fluxo completo de compra funcional: seleção → checkout → pagamento → confirmação → ingresso
- [ ] Interface mobile responsiva e usável em smartphones
- [ ] Interface desktop sem erros visuais ou funcionais
- [ ] Sem erros no console do browser (exceto logs informativos)
- [ ] Sem crashes ou tela branca em nenhum fluxo
- [ ] Código compila sem erros TypeScript (`npm run lint` limpo)
