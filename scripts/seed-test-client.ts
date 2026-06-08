import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ════════════════════════════════════════════════════════════════════════════
// Garante um usuário CLIENTE de teste logável com email cliente@comprador.com.
//
// Por que existe: o login do site usa Supabase Auth (auth.signInWithPassword),
// que valida contra a tabela auth.users — NÃO contra public.profiles. Alterar
// apenas profiles.email não muda o email de login. Este script sincroniza o
// auth.users.email com cliente@comprador.com e define uma senha conhecida.
// ════════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'cliente@comprador.com';
const PASSWORD = 'comprador123';
const NAME = 'Cliente Comprador';

async function findAuthUserByEmail(email: string): Promise<string | undefined> {
  // listUsers é paginado; varre páginas até achar (base de teste é pequena).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await (supabase.auth as any).admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (users.length < 1000) break;
  }
  return undefined;
}

async function seed() {
  const email = EMAIL.toLowerCase();
  console.log(`\n🚀 Garantindo cliente de teste: ${email}\n`);

  // 1. O usuário pode já existir em profiles (o email foi editado lá manualmente).
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (profileErr) throw profileErr;

  // 2. Resolver o id do auth.users: prioriza o id da profiles, senão busca por email no auth.
  let userId = profileRow?.id as string | undefined;
  if (!userId) {
    userId = await findAuthUserByEmail(email);
  }

  if (userId) {
    // Atualiza email + senha do usuário existente (sincroniza auth.users com profiles).
    const { error: updErr } = await (supabase.auth as any).admin.updateUserById(userId, {
      email,
      email_confirm: true,
      password: PASSWORD,
      user_metadata: { name: NAME },
    });
    if (updErr) throw updErr;
    console.log(`🔄 auth.users atualizado (id ${userId})`);
  } else {
    // Cria do zero.
    const { data: created, error: createErr } = await (supabase.auth as any).admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME },
    });
    if (createErr) throw createErr;
    userId = created?.user?.id;
    if (!userId) throw new Error('Falha ao obter userId após createUser');
    console.log(`✨ auth.users criado (id ${userId})`);
  }

  // 3. Garante a linha em profiles com role=client e o email correto.
  const { error: upsertErr } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      name: NAME,
      username: 'comprador',
      role: 'client',
      is_approved_event_creator: false,
      phone: '(11) 99999-1234',
      cpf: '12345678909',
      birth_date: '1995-05-15',
      nationality: 'br',
      sex: 'M',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (upsertErr) throw upsertErr;

  console.log('\n✅ Pronto!');
  console.log(`  CLIENTE → email: ${email} | senha: ${PASSWORD}\n`);
}

seed().catch(err => { console.error('❌ Falha:', err); process.exit(1); });
