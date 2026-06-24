// ============================================================
// Espaço Mix — Teste de Carga (k6)
// Simula 1.000 usuários tentando reservar a mesma mesa
// ============================================================
// Instalação: brew install k6  |  snap install k6  |  choco install k6
// Execução:   k6 run load-test.js
// ============================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ─── Métricas customizadas ──────────────────────────────────────
const successCount = new Counter('reservations_success');
const conflictCount = new Counter('reservations_conflict');
const errorCount = new Counter('reservations_error');
const reservationDuration = new Trend('reservation_duration');

// ─── CONFIGURAÇÃO — ajuste antes de rodar ───────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://espaco-mix.vercel.app';
const EVENT_ID = parseInt(__ENV.EVENT_ID || '1', 10);
const TABLE_ID = parseInt(__ENV.TABLE_ID || '1', 10);

// ─── Cenários ───────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Cenário 1: Flash sale — todos ao mesmo tempo
    flash_sale: {
      executor: 'shared-iterations',
      vus: 200,
      iterations: 1000,
      maxDuration: '120s',
      startTime: '0s',
    },
    // Cenário 2: Carga sustentada — gotejamento constante
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 50,           // 50 requisições por segundo
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
      startTime: '130s',  // começa após o flash sale
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],    // 95% das req < 5s
    reservations_error: ['count<10'],      // menos de 10 erros inesperados
  },
};

// ─── Teste principal ────────────────────────────────────────────
export default function () {
  const email = `loadtest+${__VU}_${__ITER}_${Date.now()}@test.com`;

  const payload = JSON.stringify({
    reservation: {
      event_id: EVENT_ID,
      buyer_name: `Teste VU${__VU}`,
      buyer_email: email,
      buyer_cpf: '000.000.000-00',
      tables: [TABLE_ID],
      single_tickets: 0,
      male_tickets: 0,
      female_tickets: 0,
      ticket_lines: [],
      payment_method: 'pix',
    },
    ticketItems: [],
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/reservations`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s',
  });
  reservationDuration.add(Date.now() - start);

  if (res.status === 200 || res.status === 201) {
    successCount.add(1);
  } else if (res.status === 409) {
    conflictCount.add(1);  // Mesa ocupada ou esgotado — CORRETO
  } else if (res.status === 429) {
    // Rate limited — esperado sob carga pesada
    sleep(2);
  } else {
    errorCount.add(1);
    if (__ITER < 5) {
      console.warn(`[VU${__VU}] Status ${res.status}: ${res.body?.substring(0, 200)}`);
    }
  }

  sleep(0.05 + Math.random() * 0.1);
}

// ─── Relatório final ────────────────────────────────────────────
export function handleSummary(data) {
  const success = data.metrics.reservations_success?.values?.count || 0;
  const conflict = data.metrics.reservations_conflict?.values?.count || 0;
  const errors = data.metrics.reservations_error?.values?.count || 0;
  const p95 = Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0);

  const report = `
╔══════════════════════════════════════════════════╗
║          RESULTADO DO LOAD TEST                  ║
╠══════════════════════════════════════════════════╣
║  Reservas aceitas:    ${String(success).padStart(6)}                    ║
║  Reservas rejeitadas: ${String(conflict).padStart(6)}  (409 — correto) ║
║  Erros inesperados:   ${String(errors).padStart(6)}                    ║
║  Latência p95:        ${String(p95).padStart(5)}ms                   ║
╠══════════════════════════════════════════════════╣
║  ESPERADO: 1 aceita, restante rejeitadas         ║
║  Erros inesperados DEVE ser próximo de 0         ║
║                                                  ║
║  VALIDAÇÃO PÓS-TESTE (SQL Editor do Supabase):   ║
║  SELECT COUNT(*) FROM reservations               ║
║  WHERE event_id = ${EVENT_ID}                            ║
║    AND tables @> '{${TABLE_ID}}'                         ║
║    AND payment_status IN ('approved','pending');  ║
║  → DEVE retornar exatamente 1.                   ║
║  → Se > 1, houve DOUBLE-SELLING!                 ║
╚══════════════════════════════════════════════════╝`;

  console.log(report);

  return {
    'stdout': report,
    'load-test-results.json': JSON.stringify({
      success,
      conflict,
      errors,
      p95_ms: p95,
      double_selling: success > 1 ? 'DETECTED' : 'NONE',
    }, null, 2),
  };
}
