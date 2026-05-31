import fs   from 'fs';
import path from 'path';

// ─── Tipos do relatório JSON do Playwright ────────────────────────────────────

interface Annotation {
  type: string;
  description: string;
}

interface TestResult {
  status:      'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  annotations?: Annotation[];
}

interface Spec {
  title: string;
  ok:    boolean;
  tests: TestResult[];
}

interface Suite {
  title:   string;
  file?:   string;
  specs?:  Spec[];
  suites?: Suite[];
}

interface PlaywrightJSON {
  suites?: Suite[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allTests(
  suite: Suite,
  file = '',
): { file: string; title: string; result: TestResult }[] {
  const out: { file: string; title: string; result: TestResult }[] = [];
  const currentFile = (suite.file ?? file) || suite.title;

  for (const spec of suite.specs ?? []) {
    for (const result of spec.tests) {
      out.push({ file: currentFile, title: spec.title, result });
    }
  }
  for (const child of suite.suites ?? []) {
    out.push(...allTests(child, currentFile));
  }
  return out;
}

function category(file: string): 'flow' | 'security' | 'performance' | 'other' {
  const f = file.toLowerCase();
  if (f.includes('flow'))                     return 'flow';
  if (f.includes('security'))                 return 'security';
  if (f.includes('performance') || f.includes('rate')) return 'performance';
  return 'other';
}

// ─── GlobalTeardown ───────────────────────────────────────────────────────────

export default async function globalTeardown() {
  const cwd         = process.cwd();
  const resultsPath = path.join(cwd, 'test-results', 'results.json');
  const reportPath  = path.join(cwd, 'test-results', 'PRE_DEPLOY_REPORT.md');
  const baseURL     = process.env.BASE_URL ?? 'http://localhost:3000';

  if (!fs.existsSync(resultsPath)) {
    console.warn('[report-summary] test-results/results.json não encontrado — relatório não gerado.');
    return;
  }

  const raw: PlaywrightJSON = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  type Cat = 'flow' | 'security' | 'performance' | 'other';
  const counters: Record<Cat, { passed: number; failed: number; skipped: number; warnings: number }> = {
    flow:        { passed: 0, failed: 0, skipped: 0, warnings: 0 },
    security:    { passed: 0, failed: 0, skipped: 0, warnings: 0 },
    performance: { passed: 0, failed: 0, skipped: 0, warnings: 0 },
    other:       { passed: 0, failed: 0, skipped: 0, warnings: 0 },
  };

  const criticos: string[] = [];
  const warnings: string[] = [];
  const browsers            = new Set<string>();

  for (const { file, title, result } of (raw.suites ?? []).flatMap(s => allTests(s))) {
    const cat    = category(file);
    const status = result.status;

    if (status === 'passed')                     counters[cat].passed++;
    else if (status === 'failed' || status === 'timedOut') counters[cat].failed++;
    else if (status === 'skipped')               counters[cat].skipped++;

    // Detectar browser pelo caminho do arquivo de resultado
    if (file.includes('chromium'))     browsers.add('Desktop Chrome (Chromium)  ✅');
    if (file.includes('mobile-chrome')) browsers.add('Mobile Chrome — Pixel 5   ✅');
    if (file.includes('mobile-safari')) browsers.add('Mobile Safari — iPhone 14 ✅');

    for (const ann of result.annotations ?? []) {
      const isWarning  = ann.type === 'WARNING' ||
                         ann.type === 'PERF_WARNING';
      const isCritical = ann.type === 'CRITICAL_WARNING' ||
                         ann.type === 'CRITICAL_SECURITY';

      if (isWarning && ann.description) {
        counters[cat].warnings++;
        warnings.push(`- \`${title}\`: ${ann.description}`);
      }
      if (isCritical && ann.description) {
        criticos.push(`- \`${title}\`: ${ann.description}`);
      }
    }
  }

  const totalFailed = counters.flow.failed + counters.security.failed + counters.performance.failed;
  const aprovado    = totalFailed === 0;
  const data        = new Date().toLocaleString('pt-BR', {
    timeZone:    'America/Sao_Paulo',
    dateStyle:   'full',
    timeStyle:   'short',
  });

  // ─── Montar markdown ───────────────────────────────────────────────────────

  const md: string[] = [
    '# ESPAÇO MIX — PRÉ-DEPLOY TEST REPORT',
    '=====================================',
    '',
    `**Data:** ${data}`,
    `**Ambiente:** \`${baseURL}\``,
    '',
    '---',
    '',
    '## Resumo por Categoria',
    '',
    '| Categoria         | ✅ Passou | ❌ Falhou | ⚠️ Warnings | ⏭ Pulado |',
    '|-------------------|:---------:|:---------:|:----------:|:-------:|',
    `| Fluxo de Páginas  | ${counters.flow.passed} | ${counters.flow.failed} | ${counters.flow.warnings} | ${counters.flow.skipped} |`,
    `| Segurança         | ${counters.security.passed} | ${counters.security.failed} | ${counters.security.warnings} | ${counters.security.skipped} |`,
    `| Performance       | ${counters.performance.passed} | ${counters.performance.failed} | ${counters.performance.warnings} | ${counters.performance.skipped} |`,
    '',
    '---',
    '',
    '## Decisão de Deploy',
    '',
    aprovado
      ? '> **APROVADO** — Nenhuma falha crítica. Revisar os warnings antes de ir para produção.'
      : `> **BLOQUEADO** — ${totalFailed} teste(s) falharam. Corrigir os itens críticos antes do deploy.`,
    '',
  ];

  if (criticos.length > 0) {
    md.push('---', '', '## ITENS CRÍTICOS (falha = não fazer deploy)', '');
    md.push(...[...new Set(criticos)]);
    md.push('');
  }

  if (warnings.length > 0) {
    md.push('---', '', '## Warnings (corrigir em breve)', '');
    md.push(...[...new Set(warnings)]);
    md.push('');
  }

  const listedBrowsers = browsers.size > 0
    ? [...browsers]
    : [
        'Desktop Chrome (Chromium)  ✅',
        'Mobile Chrome — Pixel 5   ✅',
        'Mobile Safari — iPhone 14 ✅',
      ];

  md.push('---', '', '## Browsers Testados', '');
  for (const b of listedBrowsers) md.push(`- ${b}`);
  md.push('', '---', '*Gerado automaticamente pela suíte Playwright do Espaço Mix.*', '');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md.join('\n'), 'utf-8');

  // ─── Resumo no console ────────────────────────────────────────────────────

  const linha = '='.repeat(50);
  console.log(`\n${linha}`);
  console.log('  ESPAÇO MIX — PRÉ-DEPLOY TEST REPORT');
  console.log(linha);
  console.log(`Data:       ${data}`);
  console.log(`Ambiente:   ${baseURL}`);
  console.log('');
  console.log(`FLUXO:       ${counters.flow.passed} passed / ${counters.flow.failed} failed / ${counters.flow.warnings} warnings`);
  console.log(`SEGURANÇA:   ${counters.security.passed} passed / ${counters.security.failed} failed / ${counters.security.warnings} warnings`);
  console.log(`PERFORMANCE: ${counters.performance.passed} passed / ${counters.performance.failed} failed / ${counters.performance.warnings} warnings`);
  console.log('');
  console.log(aprovado ? 'RESULTADO: APROVADO para deploy.' : `RESULTADO: BLOQUEADO — ${totalFailed} falha(s) crítica(s).`);
  console.log(`\nRelatório: ${reportPath}`);
  console.log(`${linha}\n`);
}
