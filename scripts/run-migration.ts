import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

// ════════════════════════════════════════════════════════════════════════════
// Aplica um arquivo .sql de migração no banco Supabase.
// Uso: tsx scripts/run-migration.ts supabase/migrations/<arquivo>.sql
//
// Conecta pelo transaction pooler (porta 6543) via SUPABASE_DB_URL — o host
// direto e a 5432 falham neste projeto.
// ════════════════════════════════════════════════════════════════════════════

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) throw new Error('Defina SUPABASE_DB_URL no .env');

const fileArg = process.argv[2];
if (!fileArg) throw new Error('Informe o caminho do .sql: tsx scripts/run-migration.ts <arquivo.sql>');

const sqlPath = resolve(process.cwd(), fileArg);
const sql = readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`\n🚀 Aplicando: ${fileArg}\n`);
  try {
    await client.query(sql);
    console.log('✅ Migração aplicada com sucesso.');
  } finally {
    await client.end();
  }
}

run().catch(err => { console.error('❌ Falha na migração:', err.message ?? err); process.exit(1); });
