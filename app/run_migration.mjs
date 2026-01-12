import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  // Test connection
  const { data, error } = await supabase.from('patterns').select('id').limit(1);
  if (error) {
    console.error('Connection test failed:', error);
    return;
  }
  console.log('Connection OK');
  
  // Check if table exists
  const { data: tables, error: tablesErr } = await supabase
    .from('pattern_similarities')
    .select('pattern_id_1')
    .limit(1);
  
  if (tablesErr) {
    console.log('Table status:', tablesErr.code, '-', tablesErr.message);
  } else {
    console.log('Table already exists with', tables?.length, 'rows sample');
  }
}

run().catch(console.error);
