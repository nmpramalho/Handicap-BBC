import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Falta a variável VITE_SUPABASE_URL no ficheiro .env"
  );
}

if (!supabaseKey) {
  throw new Error(
    "Falta a variável VITE_SUPABASE_ANON_KEY no ficheiro .env"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
``