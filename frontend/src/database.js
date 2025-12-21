import { createClient } from '@supabase/supabase-js';

// We use the exact names from your reference, prefixed for React
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!url || !key) {
    console.error("Supabase environment variables are missing!");
}

export const supabase_admin = createClient(url, key);
export const supabase = supabase_admin;