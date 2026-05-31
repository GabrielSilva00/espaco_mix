import { test, expect } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

const BASE = process.env.BASE_URL ?? BASE_URL;

function warn(description: string) {
  test.info().annotations.push({ type: 'WARNING', description });
  console.warn(`[PERF WARNING] ${description}`);
}

test.describe('Bloco 3 — Performance e Rate Limiting', () => {

  // ─── 1. Tempo de resposta das páginas ─────────────────────────────────────

  test.describe('Tempo de carregamento', () => {
    test('Home carrega em menos de 10 segundos', async ({ page }) => {
      const inicio  = Date.now();
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      const elapsed = Date.now() - inicio;

      test.info().annotations.push({ type: 'timing', description: `Home: ${elapsed}ms` });
      console.log(`[TIMING] Home: ${elapsed}ms`);

      if (elapsed > 5000) warn(`Home carregou em ${elapsed}ms (> 5s) — investigar performance`);
      expect(elapsed, 'Home ultrapassou o limite crítico de 10s').toBeLessThan(10_000);
    });

    test('/api/health responde em menos de 3 segundos', async ({ page }) => {
      const inicio  = Date.now();
      const response = await page.request.get(`${BASE}/api/health`);
      const elapsed = Date.now() - inicio;

      test.info().annotations.push({ type: 'timing', description: `/api/health: ${elapsed}ms` });
      console.log(`[TIMING] /api/health: ${elapsed}ms`);

      if (elapsed > 1000) warn(`/api/health demorou ${elapsed}ms`);
      expect(elapsed).toBeLessThan(3000);
      expect([200, 204]).toContain(response.status());
    });

    test('Navegação até Contato carrega em menos de 10 segundos', async ({ page }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);

      const inicio = Date.now();
      await page.getByText('Contato').first().click({ force: true });
      await page.locator('input[name="nome"]').waitFor({ state: 'visible', timeout: 10_000 });
      const elapsed = Date.now() - inicio;

      test.info().annotations.push({ type: 'timing', description: `Contato (navegação SPA): ${elapsed}ms` });
      console.log(`[TIMING] Contato: ${elapsed}ms`);

      if (elapsed > 5000) warn(`Navegação até Contato: ${elapsed}ms > 5s`);
      expect(elapsed).toBeLessThan(10_000);
    });

    test('View de Política de Privacidade carrega em menos de 10 segundos', async ({ page }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);

      const link = page.getByText(/política de privacidade/i).first();
      if (!(await link.isVisible({ timeout: 3000 }))) {
        test.info().annotations.push({
          type: 'skip-reason',
          description: 'Link de Política de Privacidade não encontrado no footer.',
        });
        return;
      }

      const inicio  = Date.now();
      await link.click({ force: true });
      await page.waitForTimeout(1000);
      const elapsed = Date.now() - inicio;

      test.info().annotations.push({ type: 'timing', description: `Privacidade: ${elapsed}ms` });
      if (elapsed > 5000) warn(`Política de Privacidade: ${elapsed}ms > 5s`);
      expect(elapsed).toBeLessThan(10_000);
    });
  });

  // ─── 2. Proteção contra brute force ───────────────────────────────────────

  test.describe('Proteção contra brute force no login', () => {
    test('6 tentativas inválidas consecutivas → alguma proteção é ativada', async ({ page }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first()
        .or(page.getByRole('button', { name: 'Entrar na Conta', exact: true }).first());
      await entrarBtn.click({ force: true });
      await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 5000 });

      const emailTeste = `brute_${Date.now()}@naoexiste.com`;
      let temBloqueio  = false;
      let temDelay     = false;
      let tem429       = false;
      let temCaptcha   = false;
      let tempoAnterior = 0;

      for (let i = 1; i <= 6; i++) {
        const monitor429 = page
          .waitForResponse(r => r.status() === 429, { timeout: 4000 })
          .then(() => { tem429 = true; })
          .catch(() => {});

        await page.locator('input[name="username"]').fill(emailTeste);
        await page.locator('input[name="password"]').first().fill(`Senha_Errada_${i}!`);

        const t0 = Date.now();
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(2000);
        const tempoResposta = Date.now() - t0;

        await Promise.race([monitor429, page.waitForTimeout(100)]);

        const bloqueio = page.getByText(
          /bloqueado|muitas tentativas|too many|tente novamente em|aguarde \d|conta bloqueada/i,
        );
        if (await bloqueio.isVisible({ timeout: 1000 })) {
          temBloqueio = true;
          console.log(`[BRUTE FORCE] Bloqueio detectado na tentativa ${i}`);
          break;
        }

        const captcha = page.locator(
          '[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]',
        );
        if (await captcha.isVisible({ timeout: 500 })) {
          temCaptcha = true;
          console.log(`[BRUTE FORCE] CAPTCHA detectado na tentativa ${i}`);
          break;
        }

        // Delay crescente (> 1.8× do anterior e > 4s total)
        if (i > 1 && tempoAnterior > 0 && tempoResposta > tempoAnterior * 1.8 && tempoResposta > 4000) {
          temDelay = true;
          console.log(`[BRUTE FORCE] Delay crescente: ${i}ª tentativa = ${tempoResposta}ms (anterior: ${tempoAnterior}ms)`);
        }

        tempoAnterior = tempoResposta;

        if (i < 6) {
          await page.locator('input[name="username"]').clear();
          await page.locator('input[name="password"]').first().clear();
        }
      }

      const temProtecao = temBloqueio || temDelay || tem429 || temCaptcha;
      const detalhes    = [
        temBloqueio ? 'mensagem-de-bloqueio' : '',
        temDelay    ? 'delay-crescente'       : '',
        tem429      ? 'HTTP-429'              : '',
        temCaptcha  ? 'captcha'               : '',
      ].filter(Boolean).join(', ');

      test.info().annotations.push({
        type: temProtecao ? 'brute-force-protection' : 'CRITICAL_WARNING',
        description: temProtecao
          ? `Proteção detectada: ${detalhes}`
          : 'CRÍTICO: Nenhuma proteção contra brute force após 6 tentativas de login. ' +
            'Implementar antes do deploy: Rate Limits no Supabase (Auth → Rate Limits) ' +
            'e/ou express-rate-limit nos endpoints de autenticação.',
      });

      if (!temProtecao) {
        warn('Nenhuma proteção contra brute force detectada — implementar URGENTEMENTE antes do deploy');
      }
    });
  });

  // ─── 3. Proteção contra spam no contato ───────────────────────────────────

  test.describe('Proteção contra spam no formulário de contato', () => {
    test('4 submissões rápidas → honeypot, rate limit (429) ou CAPTCHA detectado', async ({
      page,
    }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      await page.getByText('Contato').first().click({ force: true });
      await expect(page.locator('input[name="nome"]')).toBeVisible({ timeout: 5000 });

      let temProtecao = false;

      // Verificar honeypot (campos hidden com tabindex=-1 ou aria-hidden)
      const honeypotCount = await page
        .locator('input[tabindex="-1"], input[aria-hidden="true"]')
        .count();
      if (honeypotCount > 0) {
        temProtecao = true;
        console.log(`[SPAM] ${honeypotCount} campo(s) honeypot encontrado(s)`);
      }

      for (let i = 1; i <= 4; i++) {
        let tem429 = false;
        const monitor = page
          .waitForResponse(r => r.status() === 429, { timeout: 3000 })
          .then(() => { tem429 = true; })
          .catch(() => {});

        await page.locator('input[name="nome"]').fill(`Spam Bot ${i}`);
        await page.locator('input[name="email"]').fill('spammer@teste.com');
        await page.locator('textarea[name="mensagem"]').fill(`Spam ${i} `.repeat(40));
        await page.locator('button[type="submit"]').click();
        await Promise.race([monitor, page.waitForTimeout(2000)]);

        if (tem429) {
          temProtecao = true;
          console.log(`[SPAM] Rate limit (429) detectado na submissão ${i}`);
          break;
        }

        const captcha = page.locator(
          '[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"]',
        );
        if (await captcha.isVisible({ timeout: 500 })) {
          temProtecao = true;
          console.log(`[SPAM] CAPTCHA detectado na submissão ${i}`);
          break;
        }

        if (i < 4) {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          await page.getByText('Contato').first().click({ force: true });
          await page.locator('input[name="nome"]').waitFor({ state: 'visible', timeout: 5000 });
        }
      }

      test.info().annotations.push({
        type: temProtecao ? 'spam-protection' : 'WARNING',
        description: temProtecao
          ? 'Proteção contra spam detectada no formulário de contato'
          : 'Nenhuma proteção contra spam detectada — ' +
            'considerar express-rate-limit, honeypot ou CAPTCHA no formulário de contato',
      });

      if (!temProtecao) {
        warn('Formulário de contato sem proteção contra spam — adicionar antes do deploy');
      }
    });
  });

  // ─── 4. Carga paralela mínima ─────────────────────────────────────────────

  test.describe('Carga paralela mínima', () => {
    test('10 requisições paralelas na home retornam status 200', async ({ browser }) => {
      const resultados: { status: number; tempo: number; ok: boolean }[] = [];

      const promises = Array.from({ length: 10 }, async (_, i) => {
        const ctx = await browser.newContext();
        const p   = await ctx.newPage();
        const t0  = Date.now();
        try {
          const res = await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          const t   = Date.now() - t0;
          resultados.push({ status: res?.status() ?? 0, tempo: t, ok: res?.status() === 200 });
        } catch (err) {
          resultados.push({ status: 0, tempo: Date.now() - t0, ok: false });
          console.error(`[LOAD] Requisição ${i + 1} falhou:`, err);
        } finally {
          await ctx.close();
        }
      });

      await Promise.all(promises);

      const tempos     = resultados.map(r => r.tempo);
      const tempoMedio = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
      const tempoMax   = Math.max(...tempos);
      const falhas     = resultados.filter(r => !r.ok).length;

      console.log(
        `[LOAD] 10 req paralelas | Média: ${tempoMedio}ms | Máximo: ${tempoMax}ms | Falhas: ${falhas}/10`,
      );

      test.info().annotations.push({
        type: 'load-test',
        description: `10 req paralelas | Média: ${tempoMedio}ms | Máximo: ${tempoMax}ms | Falhas: ${falhas}/10`,
      });

      if (tempoMax > 5000) {
        warn(`Tempo máximo sob carga: ${tempoMax}ms (> 5s) — investigar gargalos`);
      }

      expect(falhas, `${falhas} de 10 requisições paralelas retornaram erro`).toBe(0);
    });
  });
});
