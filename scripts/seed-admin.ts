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

async function seedAdmin() {
  const ADMIN_EMAIL = 'admin@espacomix.internal';
  const ADMIN_PASSWORD = 'admin';

  // 1. Criar (ou reutilizar) o usuário no Supabase Auth
  const { data: authData, error: authError } = await (supabase.auth as any).admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Administrador' },
  });

  if (authError && !authError.message.toLowerCase().includes('already registered')) {
    throw authError;
  }

  const userId: string | undefined = authData?.user?.id;

  // 2. Upsert do perfil admin na tabela profiles
  if (userId) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: ADMIN_EMAIL,
      name: 'Administrador',
      role: 'admin',
      is_approved_event_creator: true,
      created_at: new Date().toISOString(),
    });

    if (profileError) throw profileError;
  }

  console.log('Seed concluído. Login: admin / admin (username via signInWithUsername)');
}

seedAdmin().catch((err) => {
  console.error('Falha ao seedar admin:', err);
  process.exit(1);
});
