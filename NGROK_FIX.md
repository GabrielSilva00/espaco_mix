# 🔧 Solução: Ngrok Desconectando

## ❌ Problema
```
reconnecting (failed to dial ngrok server with address "connect.ngrok-agent.com:443"
```

Ngrok está falhando ao conectar com os servidores dele. Pode ser:
1. **Firewall bloqueando**
2. **Falta de autenticação**
3. **Internet instável**

---

## ✅ Solução Rápida: Testar SEM Ngrok Primeiro

### 1️⃣ Verificar se o backend está rodando
```bash
# Terminal 1
npm run dev:server
# Deve mostrar: "Server running on http://localhost:3000"
```

### 2️⃣ Verificar se o frontend está rodando
```bash
# Terminal 2
npm run dev
# Deve mostrar: "Local: http://localhost:5173"
```

### 3️⃣ Testar a conexão SEM Ngrok
No navegador:
```
http://localhost:5173/admin/settings
```

**Você consegue acessar?** → Se SIM, tudo está funcionando!

---

## 🌐 Para Testar Webhooks com Mercado Pago

Se você precisa que Mercado Pago chegue até você (webhooks), aí SIM precisa de ngrok. Mas para **salvar credenciais e testar pagamentos**, ngrok NÃO é necessário.

### Alternativas a ngrok:
1. **Expose** - `npm install -g expose-cli` (mais estável)
2. **Localtunnel** - `npm install -g localtunnel` (simples)
3. **Cloudflare Tunnel** - Grátis, muito estável

### Usar Localtunnel (mais simples):
```bash
npm install -g localtunnel

# Terminal 3
lt --port 3000
# Vai gerar: https://RANDOM.loca.lt -> http://localhost:3000
```

Copie a URL gerada e use como webhook URL no Mercado Pago.

---

## 🔴 Se MESMO ASSIM quiser usar ngrok

### Método 1: Baixar ngrok fresh
```bash
# Remover versão antiga
Remove-Item "$env:APPDATA\ngrok" -Force -Recurse 2>$null

# Baixar nova versão
choco install ngrok --force
# OU: https://ngrok.com/download
```

### Método 2: Configurar authtoken
Se você tem conta ngrok.com:
```bash
ngrok authtoken SEU_TOKEN_AQUI
```

### Método 3: Usar porta diferente
```bash
ngrok http 3000 --region us --bind-tls=false
```

---

## 📋 Checklist de Debug

- [ ] Backend rodando? `npm run dev:server`
- [ ] Frontend rodando? `npm run dev`
- [ ] Consegue acessar `http://localhost:5173`?
- [ ] Mercado Pago credenciais salvas?
- [ ] Consegue conectar ao testar credenciais?

Se todos os checkboxes estão ✓, **você está pronto para processar pagamentos!**

Webhooks podem ser testados depois com ngrok ou localtunnel.
