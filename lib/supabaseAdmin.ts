import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY no está configurada — el webhook de Stripe no podrá escribir en la base."
  );
}

// Cliente server-only con la service_role key: bypassea RLS. Nunca
// importar este archivo desde código marcado "use client".
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || "placeholder");
