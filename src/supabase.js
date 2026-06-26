import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only create the client if both values are present and look valid
// If not configured, supabase will be null and all db functions
// will return empty results, falling back to SEED data automatically
export const supabase = (
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.startsWith('eyJ')
)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null