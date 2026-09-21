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
  if (pending.user_id) {
    return NextResponse.json({ error: "Esta invitación ya fue aceptada" }, { status: 409 });
  }

  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("id, invite_code")
    .eq("id", pending.loop_id)
    .single();
  if (loopError || !loop || loop.invite_code !== body.inviteCode) {
    return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("loop_members")
    .update({ user_id: auth.userId })
    .eq("id", body.pmId)
    .is("user_id", null);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ loopId: pending.loop_id });
}
