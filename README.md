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