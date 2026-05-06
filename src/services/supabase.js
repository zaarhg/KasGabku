import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL belum diisi di file .env');
}

if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY belum diisi di file .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});