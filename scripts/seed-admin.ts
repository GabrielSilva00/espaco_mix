import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    'Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY) no .env'
  );
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createOrUpdateUser(
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'developer' | 'client'
) {
  let userId: string | undefined;

  try {
    const { data: authData } = await (supabase.auth as any).admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    userId = authData?.user?.id;
  } catch (err: any) {
    const alreadyExists =
      err.code === 'email_exists' ||
      err.message?.toLowerCase().includes('already registered');
    if (!alreadyExists) throw err;
    // Usuário já existe no Auth — atualiza somente o perfil pelo email
  }

  const isApprovedCreator = role !== 'client';

  if (userId) {
    // Remove perfil órfão com mesmo email mas id diferente (se existir)
    await supabase.from('profiles').delete().eq('email', email).neq('id', userId);

    // Usuário recém-criado: upsert completo com id
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      name,
      role,
      is_approved_event_creator: isApprovedCreator,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  } else {
    // Usuário já existia: garante role correto pelo email
    const { error } = await supabase
      .from('profiles')
      .update({ role, is_approved_event_creator: isApprovedCreator })
      .eq('email', email);
    if (error) throw error;
  }

  console.log(`✓ ${role.toUpperCase()} | ${email} | senha: ${password}`);
}

async function seed() {
  console.log('Criando/atualizando usuários especiais...\n');

  await createOrUpdateUser(
    'admin@espacomix.internal',
    'admin',
    'Administrador',
    'admin'
  );

  await createOrUpdateUser(
    'dev@espacomix.com',
    'dev123',
    'Developer',
    'developer'
  );

  await createOrUpdateUser(
    'TESTUSER6796046344632108919@testuser.com',
    'tT7uCeTglU',
    'Conta Teste MP',
    'client'
  );

  console.log('\nSeed concluído!');
  console.log('Login admin: usuário "admin" | senha "admin"');
  console.log('Login dev:   usuário "dev@espacomix.com" | senha "dev123"');
  console.log('Login MP:    usuário "TESTUSER6796046344632108919@testuser.com" | senha "tT7uCeTglU"');
}

seed().catch((err) => {
  console.error('Falha ao seedar:', err);
  process.exit(1);
});
