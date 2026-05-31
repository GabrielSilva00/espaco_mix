import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capturar erros de console
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// Capturar erros de página
page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

// 1. Abrir a página inicial
console.log('1. Abrindo página inicial...');
const t1 = Date.now();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
console.log(`   Carregou em ${Date.now() - t1}ms`);

await page.screenshot({ path: 'C:\Users\FELIPE~1\AppData\Local\Temp\screen_01_home.png' });

// 2. Navegar para login
console.log('2. Clicando em login...');
await page.click('button:has-text("Entrar"), a:has-text("Entrar"), [aria-label*="login"], [aria-label*="Login"]').catch(() => {
  // Tentar outro seletor
  return page.click('button:has-text("Admin"), button:has-text("admin")').catch(() => {
    console.log('   Botão de login não encontrado, navegando diretamente');
  });
});

await page.screenshot({ path: 'C:\Users\FELIPE~1\AppData\Local\Temp\screen_02_after_click.png' });

console.log('\nErros de console:', consoleErrors.length > 0 ? consoleErrors : 'Nenhum');
await browser.close();
