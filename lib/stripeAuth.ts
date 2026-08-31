import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";

export type AuthedAdminResult =
  | { ok: true; userId: string; userEmail: string | null; loop: { id: string; admin_id: string } }
  | { ok: false; status: number; error: string };

/**
 * Verifica el Bearer token del caller contra Supabase Auth y confirma
 * que es admin del `loopId` recibido. Centraliza el chequeo de
 * seguridad que usan checkout y portal — nunca duplicarlo inline en una
 * ruta nueva.
 */
export async function requireLoopAdmin(
  req: NextRequest,
  loopId: string | undefined
): Promise<AuthedAdminResult> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, status: 401, error: "No autenticado" };
  }
  if (!loopId) {
    return { ok: false, status: 400, error: "Falta loopId" };
  }

  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("id, admin_id")
    .eq("id", loopId)
    .single();
  if (loopError || !loop) {
    return { ok: false, status: 404, error: "Loopy no encontrado" };
  }
  if (loop.admin_id !== userData.user.id) {
    return {
      ok: false,
      status: 403,
      error: "Solo el admin del Loopy puede gestionar la suscripción",
    };
  }

  return { ok: true, userId: userData.user.id, userEmail: userData.user.email ?? null, loop };
}
