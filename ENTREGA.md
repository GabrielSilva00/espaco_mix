# 📦 Guia de Entrega — Deixar o site funcionando

A maior parte da configuração é feita **dentro do próprio site**, na primeira vez
que você entrar como administrador. Este guia tem só o essencial.

---

## 1. Entre como administrador e siga o passo a passo

1. Abra o site e, no **rodapé**, clique em **"Acesso Master"**.
2. Faça login com o usuário e senha de administrador.
3. Na primeira entrada, o site abre uma **configuração inicial em 4 etapas**.
   Preencha tudo (você pode pular e terminar depois em **Configurações**):
   - **Seus dados:** nome, e-mail e **troque a senha padrão**.
   - **Site/Empresa:** nome do site, logo, razão social, CNPJ, endereço, contatos.
   - **Pagamento (Mercado Pago):** cole o **Access Token** e a **Public Key** de
     **produção** (começam com `APP_USR-`). A tela mostra a **URL do Webhook** para
     você copiar.
   - **E-mail:** escolha **Resend** ou **SMTP**, informe a chave/dados e o remetente.
     Use o botão **"Testar envio"** para confirmar que chega.

> Tudo que você salva aqui passa a valer **na hora** (fica guardado com segurança
> no banco). Para editar depois: **Configurações** (no menu do Acesso Master).

---

## 2. Configurar o Webhook no Mercado Pago

Sem isso, o cliente paga mas o ingresso pode não liberar.

1. Acesse **https://www.mercadopago.com.br/developers/panel** (conta que recebe o dinheiro).
2. Em **Webhooks / Notificações**, cole a URL que aparece na tela de Pagamento do
   site (algo como `https://SEU-DOMINIO.com.br/api/webhook/mercadopago`).
3. Marque os eventos de **Pagamentos**.

---

## 3. Lembretes automáticos (opcional)

Em **Configurações → Lembretes Automáticos** você define a hora e pode disparar um
teste. O agendamento diário já vem no arquivo `vercel.json` do projeto.

---

## 4. Variáveis técnicas (uma vez, com o desenvolvedor)

Estas ficam na **Vercel** (Settings → Environment Variables) e são responsabilidade
do desenvolvedor — você não precisa mexer no dia a dia:

| Variável | Para quê |
|----------|----------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Banco de dados |
| `ENCRYPTION_KEY` | Protege os segredos (CPF, tokens) — 64 caracteres |
| `CRON_SECRET` | Protege o disparo automático de lembretes |
| `APP_URL` | Endereço final do site |

> Depois de qualquer mudança nessas variáveis, faça **Redeploy** na Vercel.

---

## ✅ Teste final

1. Faça uma compra de teste (PIX ou cartão).
2. Confira: o pagamento **aprovou** e o **e-mail de confirmação chegou**.

Deu certo nos dois? O site está pronto. Em caso de dúvida técnica, fale com o
desenvolvedor.
