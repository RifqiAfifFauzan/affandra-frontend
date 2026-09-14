import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://slsgtouxyedqasciuajj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GhFdv7-LmyJA9ULfkJbRlg_et-sCaI6'; // Salin full key dari tombol salin di sampingnya

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);