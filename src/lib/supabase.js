import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://nmbxopltqeilhzplwcgs.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYnhvcGx0cWVpbGh6cGx3Y2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTI4NzAsImV4cCI6MjEwNjk2ODg3MH0.j1Q6MGzf2TgnqZaqU6diorEbBJ6NJrAod2zKOQi4PgI';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl =
  rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== ''
    ? rawUrl.trim()
    : FALLBACK_SUPABASE_URL;

const supabaseAnonKey =
  rawKey && typeof rawKey === 'string' && rawKey.trim() !== ''
    ? rawKey.trim()
    : FALLBACK_SUPABASE_ANON_KEY;

let client;
try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
} catch (err) {
  console.error('[Supabase] Failed to initialize client:', err);
  client = createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = client;
