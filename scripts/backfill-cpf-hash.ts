import 'dotenv/config';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ════════════════════════════════════════════════════════════════════════════
// Backfill de profiles.cpf_hash para contas já existentes.
// Uso: npx tsx scripts/backfill-cpf-hash.ts
//
// Por que: a unicidade de CPF (migração 20260616_cpf_unique.sql) usa a coluna
// cpf_hash = HMAC-SHA256(CPF, ENCRYPTION_KEY). Contas criadas ANTES da migração
// têm cpf_hash NULL, então não estariam protegidas. Este script decifra o CPF
// guardado (enc:...) e calcula o hash, replicando exatamente a lógica do servidor.
//
// Importante: usa a MESMA ENCRYPTION_KEY do servidor — rode com o .env de produção.
// Se houver CPFs duplicados pré-existentes, o índice único impedirá o 2º update:
// o script os reporta no final para resolução manual.
// ════════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) {
  throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

function getEncKey(): Buffer | null {
  const hex = (process.env.ENCRYPTION_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

function decryptCpf(value: string, key: Buffer): string {
  if (!value.startsWith('enc:')) return value; // plaintext legado
  const parts = value.split(':');
  const iv = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(parts[2], 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function hashCpf(cpf: string): string | null {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return null;
  const hex = (process.env.ENCRYPTION_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (hex.length === 64 && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return crypto.createHmac('sha256', Buffer.from(hex, 'hex')).update(digits).digest('hex');
  }
  return crypto.createHash('sha256').update(digits).digest('hex');
}

async function main() {
  const key = getEncKey();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, cpf, cpf_hash');
  if (error) throw error;

  let updated = 0, skipped = 0;
  const conflicts: string[] = [];

  for (const p of profiles ?? []) {
    if (p.cpf_hash) { skipped++; continue; }        // já tem hash
    if (!p.cpf) { skipped++; continue; }            // sem CPF (estrangeiro)

    let plain: string;
    try {
      plain = key ? decryptCpf(p.cpf, key) : p.cpf;
    } catch {
      console.warn(`[backfill] Falha ao decifrar CPF do perfil ${p.id} — pulando.`);
      skipped++;
      continue;
    }

    const ch = hashCpf(plain);
    if (!ch) { skipped++; continue; }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ cpf_hash: ch })
      .eq('id', p.id);

    if (upErr) {
      if ((upErr as any).code === '23505') {
        conflicts.push(`${p.id} (${p.email})`);
      } else {
        console.error(`[backfill] Erro ao atualizar ${p.id}:`, upErr.message);
      }
      continue;
    }
    updated++;
  }

  console.log(`\n[backfill] Concluído: ${updated} atualizados, ${skipped} pulados.`);
  if (conflicts.length) {
    console.log(`\n[backfill] ⚠ CPFs DUPLICADOS detectados (resolução manual necessária):`);
    conflicts.forEach((c) => console.log(`  - ${c}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
