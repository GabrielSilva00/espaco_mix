# 🎫 Guia de Integração Mercado Pago

## ✅ O que foi implementado

1. **Painel Admin de Configurações** (Aba "Pagamentos")
   - Configura Access Token e Public Key
   - Teste de conexão em tempo real
   - Geração automática de webhook URL
   - Toggle entre modo teste e produção

2. **Captura de Dados de Cartão** (Checkout)
   - Campos formatados e validados
   - Suporte a 1, 2 ou 3 parcelações
   - Validação Luhn do cartão
   - Feedback visual de erros

3. **Backend Mercado Pago**
   - Endpoint `/api/admin/test-mercadopago` - Testar credenciais
   - Endpoint `/api/payment/mercadopago` - Processar pagamento
   - Endpoint `/api/webhook/mercadopago` - Receber notificações
   - Rate limiting em pagamentos

4. **Utilitários de Cartão** (`src/lib/cardUtils.ts`)
   - Validação Luhn
   - Validação de data e CVV
   - Formatação de números
   - Detecção de bandeira

---

## 🚀 Passo a Passo de Uso

### 1️⃣ Obter Credenciais do Mercado Pago

1. Acesse: **https://www.mercadopago.com.br/developers/panel**
2. Faça login com sua conta
3. Clique em **"Suas integrações"**
4. Copie a **Public Key** (comeca com `TEST-`)
5. Copie o **Access Token** (começa com `TEST-`)

### 2️⃣ Configurar no Seu Site

1. Abra seu site e faça login como **ADMIN**
2. Vá para **Painel de Controle** → **Aba "Pagamentos"** → **Mercado Pago**
3. Cole o **Access Token** no campo apropriado
4. Cole a **Public Key** no campo apropriado
5. Clique em **"Gerar"** para criar a URL do Webhook
6. Clique em **"Testar Conexão"** para validar
7. Clique em **"Salvar Configurações"**

### 3️⃣ Registrar Webhook (Opcional, para receber notificações)

1. No painel do Mercado Pago, vá a **Suas integrações** → **Webhooks**
2. Clique em **"Adicionar novo webhook"**
3. Cole a URL gerada (aparece na configuração)
4. Eventos: selecione `payment.created` e `payment.updated`
5. Salve

### 4️⃣ Testar um Pagamento

1. Abra seu site (http://localhost:5173)
2. Selecione um evento
3. Vá para checkout
4. Escolha **"Cartão de Crédito"**
5. Preencha com dados de teste:

```
Número:  5031 7557 3453 0604
Nome:    APRO (aprovado) ou OTHE (rejeitado)
Validade: 11/25 (qualquer data futura)
CVV:     123
Parcelação: 1x
```

6. Clique em **"Confirmar e Pagar"**
7. A transação será processada

---

## 🔄 Fluxo de Pagamento

```
Frontend (Checkout)
    ↓
Usuário preenche dados do cartão
    ↓
Validação no frontend (Luhn, CVV, etc)
    ↓
Backend: /api/payment/mercadopago
    ↓
Mercado Pago API
    ↓
Status: approved | rejected | pending
    ↓
Webhook de notificação (opcional)
    ↓
Banco de dados atualizado
```

---

## 🎯 Modo Teste vs Produção

### 📌 TESTE (Desenvolvimento)

- **Use credenciais com prefixo `TEST-`**
- Nenhuma cobrança real
- Perfeito para desenvolvimento
- URL Webhook: `http://localhost:3000/...` (não funciona com webhook)

Cartões de teste:
- ✅ Aprovado: `5031 7557 3453 0604`
- ❌ Rejeitado: `5031 7557 3453 0604` com nome `OTHE`
- ⏳ Pendente: Use nome `PENDING`

### 🟢 PRODUÇÃO (Go Live)

- **Use credenciais com prefixo `APP_USR-`**
- Cobranças reais serão processadas
- Ative o toggle "Ambiente: PRODUÇÃO" no painel
- Webhook será notificado em seu domínio real

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxx
```

---

## 📊 Integração no Seu Código

### Validar Cartão (Frontend)

```tsx
import { validateCardData } from '@/lib/cardUtils';

const cardData = {
  number: "5031755734530604",
  holderName: "APRO",
  expiryMonth: "11",
  expiryYear: "25",
  cvv: "123",
  installments: "1"
};

const validation = validateCardData(cardData);
if (!validation.isValid) {
  console.log(validation.errors); // { number: "...", cvv: "..." }
}
```

### Processar Pagamento (Backend)

```bash
curl -X POST http://localhost:3000/api/payment/mercadopago \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardToken": "tokenized_card_data",
    "amount": 99.90,
    "description": "Ingresso - Evento XYZ",
    "paymentMethod": "credit_card",
    "installments": "2",
    "guestData": {
      "name": "João Silva",
      "email": "joao@example.com",
      "cpf": "123.456.789-00"
    }
  }'
```

---

## 🛡️ Segurança

✅ **O que está protegido:**
- Dados de cartão nunca são salvos no seu servidor
- Validação server-side obrigatória
- Rate limiting em endpoints de pagamento
- CPF validado antes de qualquer transação
- Criptografia AES-256 para dados sensíveis

⚠️ **Não fazer:**
- ❌ Enviar dados brutos de cartão ao servidor
- ❌ Salvar CVV ou dados completos do cartão
- ❌ Usar credenciais em arquivos versionados
- ❌ Expor Public Key em variáveis públicas

---

## 🆘 Troubleshooting

### "Credenciais inválidas"
- Verifique se os tokens estão corretos
- Tokens de TESTE começam com `TEST-`
- Tokens de PRODUÇÃO começam com `APP_USR-`
- Não misture credenciais de diferentes ambientes

### "Webhook não está funcionando"
- Use `ngrok` para testar localmente: `ngrok http 3000`
- Copie a URL gerada e registre no Mercado Pago
- Webhook local só funciona com ngrok (não com localhost)

### "Pagamento recusado"
- Use cartões de teste do Mercado Pago
- Verifique se o valor é > R$ 0
- Valide CPF antes de enviar
- Verifique logs do servidor: `npm run dev:server`

### "Public Key não está sendo usada"
- Public Key é usada apenas para validação no frontend
- Para processar pagamentos, use Access Token no backend
- Public Key pode ficar em variáveis VITE_ (frontend)
- Access Token DEVE estar em .env (backend only)

---

## 📚 Documentação

- **Mercado Pago**: https://www.mercadopago.com.br/developers/pt/reference
- **Pagamentos**: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-integration
- **Webhooks**: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/reference

---

## 💡 Próximos Passos

1. **Tokenização Real**: Integrar SDK do MP para tokenizar cartões
2. **Armazenamento**: Salvar pagamentos no banco de dados
3. **Notificações**: Processar webhooks para confirmar vendas
4. **Dashboard**: Mostrar histórico de pagamentos no admin
5. **Reembolsos**: Implementar devolução de pagamentos

---

**Desenvolvido com ❤️ para Espaço Mix**
