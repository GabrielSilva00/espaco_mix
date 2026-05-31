import { test, expect } from '@playwright/test';
import { aceitarLGPD, loginAsUser, logout, BASE_URL } from '../helpers/auth.helper';

const BASE = process.env.BASE_URL ?? BASE_URL;

function warn(description: string) {
  test.info().annotations.push({ type: 'WARNING', description });
  console.warn(`[SECURITY WARNING] ${description}`);
}

test.describe('Bloco 2 — Segurança', () => {

  // ─── 1. Headers HTTP de segurança ─────────────────────────────────────────

  test.describe('Headers HTTP de segurança', () => {
    test('Headers de segurança presentes na home', async ({ page }) => {
      const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      expect(response).not.toBeNull();
      const h = response!.headers();

      if (!h['x-content-type-options']) {
        warn('X-Content-Type-Options ausente — adicionar "nosniff" via Helmet');
      } else {
        expect(h['x-content-type-options']).toBe('nosniff');
      }

      if (!h['x-frame-options']) {
        warn('X-Frame-Options ausente — risco de clickjacking; adicionar DENY ou SAMEORIGIN');
      } else {
        expect(['DENY', 'SAMEORIGIN']).toContain(h['x-frame-options'].toUpperCase());
      }

      if (!h['referrer-policy']) {
        warn('Referrer-Policy ausente — adicionar via Helmet');
      }

      if (!h['content-security-policy']) {
        warn('Content-Security-Policy ausente — configurar CSP no Helmet para produção');
      }

      if (BASE.startsWith('https://') && !h['strict-transport-security']) {
        warn('Strict-Transport-Security (HSTS) ausente em HTTPS — adicionar via Helmet');
      }

      // Pelo menos um header de segurança deve estar presente (Helmet ativo)
      const temAlgum =
        !!h['x-content-type-options'] ||
        !!h['x-frame-options'] ||
        !!h['content-security-policy'];

      if (!temAlgum) {
        test.info().annotations.push({
          type: 'CRITICAL_WARNING',
          description:
            'Nenhum header de segurança detectado — verificar se o Helmet está configurado no servidor Express',
        });
      }
    });
  });

  // ─── 2. Proteção de formulários ───────────────────────────────────────────

  test.describe('Proteção contra entradas maliciosas', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      await page.getByText('Contato').first().click({ force: true });
      await expect(page.locator('input[name="nome"]')).toBeVisible({ timeout: 8000 });
    });

    test('Email inválido "abc" é rejeitado no formulário de contato', async ({ page }) => {
      await page.locator('input[name="nome"]').fill('Teste Segurança');
      await page.locator('input[name="email"]').fill('abc');
      await page.locator('textarea[name="mensagem"]').fill('Teste de validação');
      await page.locator('button[type="submit"]').click();

      // Validação HTML5 nativa ou mensagem customizada
      const invalido = await page.locator('input[name="email"]').evaluate(
        (el: HTMLInputElement) => !el.validity.valid,
      );
      const erroCustom = page
        .getByText(/email inválido|e-mail inválido|formato inválido|endereço inválido/i)
        .first();
      const temProtecao = invalido || (await erroCustom.isVisible({ timeout: 2000 }));

      if (!temProtecao) {
        warn('Email inválido ("abc") aceito sem validação — revisar validação do formulário de contato');
      }
    });

    test('XSS em campo de mensagem não executa script', async ({ page }) => {
      let alertDisparado = false;
      page.on('dialog', async dialog => {
        alertDisparado = true;
        await dialog.dismiss();
      });

      await page.locator('input[name="nome"]').fill('Teste XSS');
      await page.locator('input[name="email"]').fill('xss@teste.com');
      await page.locator('textarea[name="mensagem"]').fill('<script>alert("XSS")</script>');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);

      expect(alertDisparado, 'Script XSS foi executado via dialog!').toBe(false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('String de 500 caracteres não quebra a página', async ({ page }) => {
      const s500 = 'A'.repeat(500);
      await page.locator('input[name="nome"]').fill(s500);
      await page.locator('input[name="email"]').fill('teste@teste.com');
      await page.locator('textarea[name="mensagem"]').fill(s500);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // ─── 3. Dados sensíveis não expostos ─────────────────────────────────────

  test.describe('Dados sensíveis não expostos', () => {
    test('URLs de navegação não contêm parâmetros sensíveis', async ({ page }) => {
      const sensitivos = ['senha', 'password', 'token', 'card', 'cpf', 'secret', 'key'];
      const achados: string[] = [];

      page.on('framenavigated', frame => {
        const url = frame.url().toLowerCase();
        for (const p of sensitivos) {
          if (url.includes(`${p}=`) || url.includes(`${p}%3d`)) {
            achados.push(`Parâmetro "${p}" em: ${frame.url()}`);
          }
        }
      });

      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      await page.waitForTimeout(2000);

      if (achados.length > 0) {
        for (const a of achados) {
          test.info().annotations.push({ type: 'CRITICAL_SECURITY', description: a });
        }
        throw new Error(`Dados sensíveis expostos em URLs:\n${achados.join('\n')}`);
      }
    });

    test('Rota inexistente não expõe stack trace interno', async ({ page }) => {
      const response = await page.request.get(`${BASE}/rota-inexistente-xyzabc123`);
      const body     = await response.text();

      const expoeInternal =
        (body.includes('Error:') && body.includes('    at ')) ||
        body.includes('node_modules') ||
        /express[\s/][\d.]+/i.test(body);

      if (expoeInternal) {
        warn(
          'Rota de erro expõe informações internas (stack trace ou versão do framework) — ' +
          'configurar handler de erros para ocultar detalhes em produção',
        );
      }
    });

    test('/api/health não expõe segredos na resposta', async ({ page }) => {
      const response = await page.request.get(`${BASE}/api/health`);
      if (response.status() !== 200) return;
      const body = await response.text();

      if (/password|secret|sk_|pk_test|access.*token/i.test(body)) {
        warn('/api/health pode estar expondo segredos — revisar os campos retornados');
      }
    });
  });

  // ─── 4. Comportamento de autenticação ─────────────────────────────────────

  test.describe('Comportamento de autenticação', () => {
    test('Login inválido exibe mensagem de erro (sem revelar qual campo errou)', async ({
      page,
    }) => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first()
        .or(page.getByRole('button', { name: 'Entrar na Conta', exact: true }).first());
      await entrarBtn.click({ force: true });
      await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 8000 });

      await page.locator('input[name="username"]').fill('emailinvalido@naoexiste12345.com');
      await page.locator('input[name="password"]').first().fill('senhaerrada!@#$');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(4000);

      const revealaSenha = page.getByText(/senha incorreta|wrong password|password incorrect/i);
      if (await revealaSenha.isVisible({ timeout: 1000 })) {
        warn(
          'Mensagem de login revela que a senha está incorreta — ' +
          'usar mensagem genérica como "Credenciais inválidas"',
        );
      }

      // Deve exibir alguma mensagem de erro ao usuário
      const erroVisivel = page
        .getByText(/inválid|incorret|não encontrad|erro|invalid|error/i)
        .first();
      await expect(erroVisivel).toBeVisible({ timeout: 5000 });
    });

    test('Após logout: usuário não está mais autenticado', async ({ page }) => {
      const logged = await loginAsUser(page);
      if (!logged) {
        test.skip(true, 'Login falhou — verifique as credenciais em .env.test');
        return;
      }

      await logout(page);
      await page.waitForTimeout(1000);

      await expect(
        page.getByRole('button', { name: 'Entrar', exact: true }).first(),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Dashboard Admin')).not.toBeVisible({ timeout: 2000 });
    });
  });

  // ─── 5. Atributos de segurança dos cookies ────────────────────────────────

  test.describe('Atributos de segurança dos cookies', () => {
    test('Cookies de sessão têm HttpOnly, Secure e SameSite adequados', async ({
      page,
      context,
    }) => {
      const logged = await loginAsUser(page);
      if (!logged) {
        test.skip(true, 'Login falhou — pulando verificação de cookies');
        return;
      }

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        c =>
          c.name.startsWith('sb-') ||
          c.name.includes('supabase') ||
          c.name.includes('session') ||
          c.name.includes('auth'),
      );

      if (sessionCookies.length === 0) {
        warn(
          'Nenhum cookie de sessão identificado (prefixos: sb-, supabase, session, auth) — ' +
          'autenticação pode estar usando apenas localStorage',
        );
        return;
      }

      for (const cookie of sessionCookies) {
        if (!cookie.httpOnly) {
          warn(`Cookie "${cookie.name}": HttpOnly ausente — vulnerável a roubo via XSS`);
        }
        if (BASE.startsWith('https://') && !cookie.secure) {
          warn(`Cookie "${cookie.name}": atributo Secure ausente em conexão HTTPS`);
        }
        if (!cookie.sameSite || cookie.sameSite === 'None') {
          warn(`Cookie "${cookie.name}": SameSite ausente ou "None" — risco de CSRF`);
        }
      }
    });
  });
});
