// Load test — simula N usuários tentando reservar a mesma mesa
const BASE_URL = 'https://espaco-mix.vercel.app';
const CONCURRENT_USERS = 50;   // requisições simultâneas por onda
const WAVES = 3;                // ondas de requisições
const EVENT_ID = 1;
const TABLE_ID = 1;

async function makeReservation(id) {
  const payload = {
    reservation: {
      event_id: EVENT_ID,
      buyer_name: `Teste ${id}`,
      buyer_email: `loadtest+${id}_${Date.now()}@test.com`,
      buyer_cpf: '000.000.000-00',
      tables: [TABLE_ID],
      single_tickets: 0,
      male_tickets: 0,
      female_tickets: 0,
      ticket_lines: [],
      payment_method: 'pix',
    },
    ticketItems: [],
  };

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    const ms = Date.now() - start;
    return { id, status: res.status, ms, error: body.error || null };
  } catch (err) {
    return { id, status: 0, ms: Date.now() - start, error: err.message };
  }
}

async function runWave(waveNum, count) {
  console.log(`\n🌊 Onda ${waveNum}: ${count} requisições simultâneas...`);
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(makeReservation(`w${waveNum}_u${i}`));
  }
  return Promise.all(promises);
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  LOAD TEST — Espaço Mix (anti double-selling)');
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  Evento: ${EVENT_ID} | Mesa: ${TABLE_ID}`);
  console.log(`  ${CONCURRENT_USERS} users × ${WAVES} ondas = ${CONCURRENT_USERS * WAVES} tentativas`);
  console.log('═══════════════════════════════════════════════');

  const allResults = [];

  for (let w = 1; w <= WAVES; w++) {
    const results = await runWave(w, CONCURRENT_USERS);
    allResults.push(...results);
    // Pausa entre ondas para não bater no rate limiter global
    if (w < WAVES) await new Promise(r => setTimeout(r, 2000));
  }

  // Análise
  const success = allResults.filter(r => r.status === 201 || r.status === 200);
  const conflict = allResults.filter(r => r.status === 409);
  const rateLimited = allResults.filter(r => r.status === 429);
  const errors = allResults.filter(r => r.status !== 201 && r.status !== 200 && r.status !== 409 && r.status !== 429);
  const times = allResults.map(r => r.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] || 0;
  const p95 = times[Math.floor(times.length * 0.95)] || 0;
  const p99 = times[Math.floor(times.length * 0.99)] || 0;

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║           RESULTADO DO LOAD TEST             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Total de requisições:  ${String(allResults.length).padStart(6)}               ║`);
  console.log(`║  ✅ Aceitas (201):      ${String(success.length).padStart(6)}               ║`);
  console.log(`║  🚫 Rejeitadas (409):   ${String(conflict.length).padStart(6)}               ║`);
  console.log(`║  ⏳ Rate limited (429): ${String(rateLimited.length).padStart(6)}               ║`);
  console.log(`║  ❌ Erros:              ${String(errors.length).padStart(6)}               ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Latência p50:  ${String(p50).padStart(5)}ms                    ║`);
  console.log(`║  Latência p95:  ${String(p95).padStart(5)}ms                    ║`);
  console.log(`║  Latência p99:  ${String(p99).padStart(5)}ms                    ║`);
  console.log('╠══════════════════════════════════════════════╣');

  if (success.length === 0) {
    console.log('║  ⚠️  NENHUMA reserva aceita.                 ║');
    console.log('║  Verifique se o evento/mesa existem no banco. ║');
  } else if (success.length === 1) {
    console.log('║  ✅ PERFEITO: apenas 1 reserva aceita!        ║');
    console.log('║  Zero double-selling detectado.               ║');
  } else {
    console.log(`║  🔴 DOUBLE-SELLING: ${success.length} reservas para a mesma mesa!║`);
    console.log('║  A proteção de concorrência FALHOU.           ║');
  }
  console.log('╚══════════════════════════════════════════════╝');

  // Detalhe dos erros
  if (errors.length > 0) {
    console.log('\n─── Detalhes dos erros ───');
    errors.slice(0, 10).forEach(e => {
      console.log(`  [${e.id}] Status ${e.status} (${e.ms}ms): ${e.error}`);
    });
    if (errors.length > 10) console.log(`  ... e mais ${errors.length - 10} erros`);
  }

  // Amostra das respostas aceitas
  if (success.length > 0) {
    console.log('\n─── Reservas aceitas ───');
    success.forEach(s => {
      console.log(`  [${s.id}] Status ${s.status} (${s.ms}ms)`);
    });
  }
}

main().catch(console.error);
