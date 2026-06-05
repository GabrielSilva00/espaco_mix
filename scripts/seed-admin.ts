import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = 'admin' | 'developer' | 'client';

async function upsertUser(
  email: string,
  password: string,
  name: string,
  role: Role,
  extra?: Record<string, any>
) {
  const normalizedEmail = email.toLowerCase();

  let userId: string | undefined;
  const { data: createData, error: createError } =
    await (supabase.auth as any).admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

  if (createError) {
    const msg = (createError as any).message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('email_exists')) {
      const { data: list } = await (supabase.auth as any).admin.listUsers({ perPage: 1000 });
      const found = (list?.users ?? []).find((u: any) => u.email === normalizedEmail);
      userId = found?.id;
      if (!userId) throw new Error(`Usuário ${normalizedEmail} não encontrado após conflito`);
      await (supabase.auth as any).admin.updateUserById(userId, { password });
    } else {
      throw createError;
    }
  } else {
    userId = createData?.user?.id;
  }

  if (!userId) throw new Error(`Falha ao obter userId para ${normalizedEmail}`);

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: normalizedEmail,
    name,
    role,
    is_approved_event_creator: role !== 'client',
    phone: extra?.phone ?? '(11) 99999-0000',
    birth_date: extra?.birth_date ?? '1990-01-01',
    nationality: 'br',
    sex: 'M',
    cpf: extra?.cpf,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (profileError) throw profileError;

  console.log(`✅ ${role.padEnd(9)} | ${normalizedEmail} | senha: ${password}`);
}

async function seed() {
  console.log('\n🚀 Criando usuários de produção...\n');

  await upsertUser(
    'acesso@developer.com',
    'acessodeveloper123',
    'Developer',
    'developer',
    { phone: '(11) 99999-0001' }
  );

  await upsertUser(
    'acesso@admin.com',
    'acessoadmin123',
    'Administrador',
    'admin',
    { phone: '(11) 99999-0002' }
  );

  await upsertUser(
    'testuser6796046344632108919@testuser.com',
    'tT7uCeTglU',
    'TESTUSER6796046344632108919',
    'client',
    { phone: '(11) 99999-0003', cpf: '12345678909', birth_date: '1995-05-15' }
  );

  console.log('\n✅ Seed concluído!\n');
  console.log('  DEV   → email: acesso@developer.com | senha: acessodeveloper123');
  console.log('  ADMIN → email: acesso@admin.com     | senha: acessoadmin123');
  console.log('  MP    → email: testuser6796046344632108919@testuser.com | senha: tT7uCeTglU\n');
}

seed().catch(err => { console.error('❌ Falha:', err); process.exit(1); });
