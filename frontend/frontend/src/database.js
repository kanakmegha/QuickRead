import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qfknfzffarzzyavitdef.supabase.co';
// Use your PROJECT ANON KEY (found in Supabase Settings > API)
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; 

export const supabase_admin = createClient(supabaseUrl, supabaseAnonKey);