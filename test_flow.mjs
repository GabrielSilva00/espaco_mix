import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", err => errors.push(err.message));

  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // --- Etapa 1: Modal de privacidade ---
  console.log("=== 1. Modal de privacidade ===");
  const modal = await page.locator("text=Privacidade").count();
  console.log("Modal visivel:", modal > 0);
  
  // Tentar clicar em "Aceitar Tudo" ou similar
  const acceptBtn = page.locator("button").filter({ hasText: /aceitar|accept/i }).first();
  if (await acceptBtn.count() > 0) {
    await acceptBtn.click();
    await page.waitForTimeout(1000);
    console.log("Modal fechada via Aceitar");
  } else {
    // Tentar fechar de outra forma
    const closeBtn = page.locator("button[aria-label='close'], button.close, button:has-text('Fechar')").first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
      console.log("Modal fechada via X");
    }
  }
  await page.screenshot({ path: "test_after_modal.png" });

  // --- Etapa 2: Ver eventos na pagina ---
  console.log("=== 2. Eventos na pagina ===");
  const eventCards = await page.locator("[class*='card'], [class*='event'], [class*='Card']").count();
  console.log("Cards de evento:", eventCards);
  const eventTitles = await page.locator("h2, h3").allTextContents();
  console.log("Titulos:", JSON.stringify(eventTitles.slice(0, 8)));

  // --- Etapa 3: Clicar em "Ver Ingressos" ---
  console.log("=== 3. Clicando em Ver Ingressos ===");
  const verIngBtn = page.locator("button:visible, a:visible").filter({ hasText: /ver ingresso/i }).first();
  if (await verIngBtn.count() > 0) {
    await verIngBtn.click();
    await page.waitForTimeout(2000);
    console.log("Clicado em Ver Ingressos, URL:", page.url());
    await page.screenshot({ path: "test_tickets.png" });
  } else {
    console.log("Botao Ver Ingressos nao encontrado");
  }

  // --- Etapa 4: Voltar e testar Login ---
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  // Fechar modal novamente se aparecer (localStorage nao persiste entre instancias)
  const acceptBtn2 = page.locator("button").filter({ hasText: /aceitar/i }).first();
  if (await acceptBtn2.count() > 0) await acceptBtn2.click();
  await page.waitForTimeout(500);

  console.log("=== 4. Testando botao Entrar ===");
  const loginBtn = page.locator("button, a").filter({ hasText: /entrar|login/i }).first();
  if (await loginBtn.count() > 0) {
    await loginBtn.click();
    await page.waitForTimeout(2000);
    console.log("Clicado em Entrar, URL:", page.url());
    await page.screenshot({ path: "test_login.png" });
    
    // Verificar campos do formulario de login
    const inputs = await page.locator("input:visible").count();
    console.log("Campos de input visiveis:", inputs);
    const inputTypes = await page.locator("input:visible").evaluateAll(
      els => els.map(e => ({ type: e.type, placeholder: e.placeholder }))
    );
    console.log("Inputs:", JSON.stringify(inputTypes));
  } else {
    console.log("Botao Entrar nao encontrado");
  }

  // --- Erros ---
  if (errors.length > 0) {
    console.log("=== ERROS ===");
    errors.slice(0, 5).forEach(e => console.log("ERR:", e));
  } else {
    console.log("=== Sem erros JS ===");
  }

  await browser.close();
  console.log("=== TESTES CONCLUIDOS ===");
})();
