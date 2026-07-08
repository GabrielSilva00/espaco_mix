# Guia — E-mail do Formulário de Contato em Produção

O código do formulário de contato está correto (aguarda a resposta do Resend, trata
erro e só mostra "Mensagem enviada!" em sucesso). Quando o e-mail **não chega**, a
causa é quase sempre **configuração de remetente/domínio/DNS**, não o código.

Siga os passos abaixo, na ordem.

## 1. Verificar o domínio `espacomix.com.br` no Resend
1. Acesse o painel do Resend → **Domains** → **Add Domain** → `espacomix.com.br`.
2. O Resend gera os registros DNS. Publique **todos** no provedor de DNS do domínio:
   - **SPF** (TXT) — autoriza o Resend a enviar pelo domínio.
   - **DKIM** (CNAME/TXT) — assina as mensagens.
   - **DMARC** (TXT em `_dmarc.espacomix.com.br`) — política de alinhamento
     (ex.: `v=DMARC1; p=none; rua=mailto:contato@espacomix.com.br`).
3. Aguarde o status ficar **Verified** no painel (pode levar alguns minutos/horas).

> Sem domínio verificado, o Resend recusa o envio ou a mensagem cai em spam.

## 2. Definir o remetente (`from`) — `sac@` (no-reply)
Todos os e-mails **automáticos** (confirmações, avisos de evento, lembretes) saem
deste remetente. Use `sac@espacomix.com.br` — funciona como **no-reply** (o sistema
não coloca `Reply-To` nesses e-mails). Use **sempre** um endereço do domínio
verificado — **nunca** `onboarding@resend.dev`.

Configure em **um** dos dois lugares:
- **Vercel → Settings → Environment Variables:**
  - `EMAIL_SENDER_NAME=Espaço Mix`
  - `EMAIL_SENDER_ADDRESS=sac@espacomix.com.br`
- **ou** no **painel admin → Configurações → E-mail** (`email_sender_address`).

> Em produção, se o remetente não estiver configurado, o envio **falha com erro
> claro** (não usamos mais o domínio de teste como fallback).

## 3. Definir a caixa do formulário de contato — `contato@` (conversa)
As mensagens do formulário de contato são para **conversa com o usuário**. Elas
chegam nesta caixa com `Reply-To` = e-mail do visitante, então o atendente responde
direto a ele. Use `contato@espacomix.com.br` em
**painel admin → Configurações → `contact_email`** (ou env `CONTACT_EMAIL`).

Precedência aplicada pelo servidor:
`system_config.contact_email` → `support_email` → env `CONTACT_EMAIL` → `EMAIL_SENDER_ADDRESS`.

> Resumo: **`sac@`** = envios automáticos (no-reply); **`contato@`** = conversa
> (formulário de contato). Ambos os endereços são do mesmo domínio verificado, então
> não precisam de verificação individual no Resend — basta o domínio estar verificado.

## 4. Confirmar a chave do Resend
`RESEND_API_KEY` deve estar presente na Vercel (ou o segredo criptografado em
`app_secrets` via painel). Sem ela, o envio lança "Provedor de e-mail não configurado".

## 5. Ajustar `APP_URL` (casa com o CORS)
Na Vercel, `APP_URL` deve ser **exatamente** `https://espacomix.com.br` — **sem barra
final**. O CORS em produção aceita apenas as origens exatas de `APP_URL` (múltiplas
separadas por vírgula, ex.: apex + www) e **rejeita** qualquer `*.vercel.app`.

## 6. Conferir a entrega no Resend
Painel do Resend → **Logs/Emails**: verifique se as mensagens saíram e se houve
**bounce** ou marcação de **spam**. Ajuste SPF/DKIM/DMARC se necessário.

## 7. Redeploy (corrige os itens visuais antigos)
O deploy atual em produção pode estar **defasado**. Itens como o rodapé
("Pagamentos"/"Recepção"), a URL sem acento e a ausência de pré-preenchimento de
login **já estão corretos no código** — basta **republicar** na Vercel para que
apareçam no site.

---

## Observabilidade
- Sucessos/falhas de envio do contato agora ficam registrados em `audit_logs`
  (`contact_email_sent` / `contact_email_failed`), visíveis via auditoria.
- Falhas no client aparecem em **Dashboard → Logs do Sistema** (painel in-memory).
