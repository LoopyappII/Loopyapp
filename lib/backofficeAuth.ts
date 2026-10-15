import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";

// Lista de emails del STAFF de Looper Cashline SL con acceso al backoffice
// /admin (ve TODOS los Loopys). SEPARADO de ADMIN_BYPASS_EMAILS
// (lib/adminBypass.ts): ese allowlist exime a una cuenta de pagar un Loopy
// puntual; este no tiene nada que ver con pagos. Un email puede estar en
// ninguna, una o ambas listas. Configurar en Vercel/.env.local como
// BACKOFFICE_STAFF_EMAILS, separado por comas, case-insensitive.
export function isBackofficeStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.BACKOFFICE_STAFF_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export type StaffAuthResult =
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; status: number; error: string };

/**
 * Verifica el Bearer token del caller contra Supabase Auth (misma
 * verificación que requireAuthedUser en lib/stripeAuth.ts, copiada inline
 * en vez de importada — mismo criterio que ese archivo usa entre sus dos
 * funciones) y además exige que el email esté en BACKOFFICE_STAFF_EMAILS.
 * Usar esto — nunca lib/stripeAuth.ts — en cualquier ruta bajo
 * app/api/admin/ salvo is-staff/route.ts.
 */
export async function requireStaff(req: NextRequest): Promise<StaffAuthResult> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const email = userData.user.email ?? null;
  if (!isBackofficeStaffEmail(email)) {
    return { ok: false, status: 403, error: "No autorizado para el panel de administración" };
  }

  return { ok: true, userId: userData.user.id, userEmail: email };
}
