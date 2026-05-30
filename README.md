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

  # Em outro terminal, exponha a porta 3000
  ngrok http 3000


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