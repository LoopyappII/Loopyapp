"use client";

import { supabase } from "@/lib/supabaseClient";
import type { LoopMode } from "@/lib/types";

const DEFAULT_LOOP_NAME = "Mi Loopy";
const DEFAULT_LOOP_MODE: LoopMode = "mirror";

async function callStartTrial(loopId: string, accessToken: string): Promise<boolean> {
  return fetch("/api/loops/start-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ loopId }),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

export async function createDefaultLoop(
  userId: string,
  accessToken: string
): Promise<{ loopId: string } | { error: string }> {
  const { data: loop, error } = await supabase
    .from("loops")
    .insert({ name: DEFAULT_LOOP_NAME, mode: DEFAULT_LOOP_MODE, admin_id: userId })
    .select()
    .single();
  if (error || !loop) {
    return { error: error?.message || "No se pudo crear el Loopy" };
  }

  const { error: memberError } = await supabase.from("loop_members").insert({
    loop_id: loop.id,
    user_id: userId,
    role: "admin",
  });
  if (memberError) {
    return { error: memberError.message };
  }

  // Un solo reintento, mismo patrón que app/dashboard/page.tsx: un blip de
  // red transitorio no debería costarle el día gratis a nadie — start-trial
  // es un no-op seguro si el Loopy ya tiene fila (ver
  // app/api/loops/start-trial/route.ts).
  const started = await callStartTrial(loop.id, accessToken);
  if (!started) {
    await callStartTrial(loop.id, accessToken);
  }

  return { loopId: loop.id };
}

export async function acceptInvite(
  pmId: string,
  inviteCode: string,
  accessToken: string
): Promise<{ loopId: string } | { error: string }> {
  try {
    const res = await fetch("/api/loops/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pmId, inviteCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "No se pudo aceptar la invitación" };
    }
    return { loopId: data.loopId };
  } catch {
    return { error: "No se pudo aceptar la invitación" };
  }
}
