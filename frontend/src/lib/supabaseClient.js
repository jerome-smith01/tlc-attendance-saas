import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Security: In production builds, we do NOT expose which vars are missing
// to avoid leaking infrastructure details. Full error goes to console only.
if (!supabaseUrl || !supabaseAnon) {
  const msg = import.meta.env.DEV
    ? '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create frontend/.env.local.'
    : 'Application configuration error. Please contact support.';
  console.error('[TLC] Supabase client init failed. Check environment variables.');
  throw new Error(msg);
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
