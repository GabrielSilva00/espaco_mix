import 'dotenv/config';
import { Client } from 'pg';

// ════════════════════════════════════════════════════════════════════════════
// Confere (somente leitura) se as migrações do repo foram aplicadas no banco.
// Uso: tsx scripts/check-schema.ts
// Conecta pelo transaction pooler (porta 6543) via SUPABASE_DB_URL — o host
// direto e a 5432 falham neste projeto.
// ════════════════════════════════════════════════════════════════════════════

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) throw new Error('Defina SUPABASE_DB_URL no .env');

type Check = { label: string; sql: string };

const checks: Check[] = [
  // 20260606_rls_hardening.sql
  {
    label: '20260606 trigger trg_protect_reservation_financials',
    sql: `SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_reservation_financials'`,
  },
  {
    label: '20260606 policy ticket_items_insert_own',
    sql: `SELECT 1 FROM pg_policies WHERE tablename = 'ticket_items' AND policyname = 'ticket_items_insert_own'`,
  },
  // 20260607_profile_signup_fields.sql
  {
    label: '20260607 profiles.birth_date é text',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'birth_date' AND data_type = 'text'`,
  },
  {
    label: '20260607 índice único profiles_username_unique',
    sql: `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_username_unique'`,
  },
  // 20260609_admin_config_secrets.sql
  {
    label: '20260609 tabela app_secrets',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_secrets'`,
  },
  {
    label: '20260609 system_config.email_provider',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_config' AND column_name = 'email_provider'`,
  },
  // 20260609_onboarding_flag.sql
  {
    label: '20260609 system_config.onboarding_completed',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_config' AND column_name = 'onboarding_completed'`,
  },
  // 20260611_payment_email_rls.sql
  {
    label: '20260611 reservations.confirmation_email_sent_at',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'confirmation_email_sent_at'`,
  },
  {
    label: '20260611 view system_config_public',
    sql: `SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'system_config_public'`,
  },
];

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    let missing = 0;
    for (const check of checks) {
      const { rowCount } = await client.query(check.sql);
      const ok = (rowCount ?? 0) > 0;
      if (!ok) missing++;
      console.log(`${ok ? '✅ OK    ' : '❌ FALTA '} ${check.label}`);
    }

    // Diagnóstico extra: policies de leitura ativas em system_config
    const { rows } = await client.query(
      `SELECT policyname, roles, qual FROM pg_policies WHERE tablename = 'system_config' AND cmd = 'SELECT'`
    );
    console.log('\nPolicies de SELECT em system_config:');
    for (const r of rows) console.log(`  • ${r.policyname} roles=${r.roles} qual=${r.qual}`);
    if (rows.length === 0) console.log('  (nenhuma)');

    console.log(missing === 0 ? '\n✅ Schema completo.' : `\n⚠️  ${missing} item(ns) faltando.`);
  } finally {
    await client.end();
  }
}

run().catch(err => { console.error('❌ Falha na checagem:', err.message ?? err); process.exit(1); });
