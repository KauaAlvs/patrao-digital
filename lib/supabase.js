import { createClient } from '@supabase/supabase-js';

// Adicione essas variáveis no seu arquivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);