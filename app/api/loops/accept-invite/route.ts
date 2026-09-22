import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuthedUser } from "@/lib/stripeAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { pmId?: string; inviteCode?: string };
  const auth = await requireAuthedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!body.pmId || !body.inviteCode) {
    return NextResponse.json({ error: "Falta pmId o inviteCode" }, { status: 400 });
  }

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("loop_members")
    .select("id, loop_id, user_id")
    .eq("id", body.pmId)
    .single();
  if (pendingError || !pending) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  }

  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("id, invite_code")
    .eq("id", pending.loop_id)
    .single();
  if (loopError || !loop || loop.invite_code !== body.inviteCode) {
    return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
  }

  // Ya reclamada por este mismo usuario — p. ej. el trigger de auto-vínculo
  // por teléfono (docs/superpowers/specs/2026-08-24-loopy-familia-alta-miembros-design.md)
  // ya vinculó esta fila al registrarse con el mismo número al que se envió
  // la invitación, antes de que este endpoint corra. Idempotente: no es un
  // error, es el caso más común en producción (el admin manda el link de
  // WhatsApp al mismo número que ya cargó).
  if (pending.user_id === auth.userId) {
    return NextResponse.json({ loopId: pending.loop_id });
  }
  if (pending.user_id) {
    return NextResponse.json({ error: "Esta invitación ya fue aceptada" }, { status: 409 });
  }

  // Si el caller ya es miembro de este Loopy por otra vía (p. ej. se unió
  // por código antes de tocar el link), no lo dejamos quedar duplicado.
  const { data: existingMembership } = await supabaseAdmin
    .from("loop_members")
    .select("id")
    .eq("loop_id", pending.loop_id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (existingMembership) {
    return NextResponse.json({ loopId: pending.loop_id });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("loop_members")
    .update({ user_id: auth.userId })
    .eq("id", body.pmId)
    .is("user_id", null)
    .select("id");
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Esta invitación ya fue aceptada" }, { status: 409 });
  }

  return NextResponse.json({ loopId: pending.loop_id });
}
