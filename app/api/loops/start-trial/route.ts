import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";
import { isAdminBypassEmail } from "@/lib/adminBypass";

const TRIAL_DAYS = 1;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const loopId = auth.loop.id;

  // Mismo camino que app/api/stripe/checkout/route.ts: un admin en
  // ADMIN_BYPASS_EMAILS nunca pasa por Stripe, ni siquiera para el trial de
  // 1 día — queda con acceso permanente desde el momento en que crea el
  // Loopy, sin pasar nunca por /activar.
  if (isAdminBypassEmail(auth.userEmail)) {
    const { error } = await supabaseAdmin.from("loop_subscriptions").upsert(
      {
        loop_id: loopId,
        stripe_customer_id: `admin_bypass_${loopId}`,
        stripe_subscription_id: `admin_bypass_${loopId}`,
        status: "admin_bypass",
      },
      { onConflict: "loop_id" }
    );
    if (error) {
      return NextResponse.json(
        { error: `No se pudo activar el acceso de administrador: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ bypass: true });
  }

  // Elegibilidad por cuenta: si este admin ya tuvo un trial sin tarjeta en
  // cualquier Loopy anterior (vigente o vencido), este Loopy nuevo no
  // recibe otro — sin esto, se podrían crear Loopys sin fin para tener
  // siempre "un día gratis" nuevo.
  const { data: ownLoops, error: ownLoopsError } = await supabaseAdmin
    .from("loops")
    .select("id")
    .eq("admin_id", auth.userId);
  if (ownLoopsError) {
    return NextResponse.json(
      { error: `No se pudo verificar elegibilidad para el trial: ${ownLoopsError.message}` },
      { status: 500 }
    );
  }
  const ownLoopIds = (ownLoops || []).map((l) => l.id as string);

  let alreadyUsedTrial = false;
  if (ownLoopIds.length > 0) {
    const { data: priorTrial, error: priorTrialError } = await supabaseAdmin
      .from("loop_subscriptions")
      .select("loop_id")
      .in("loop_id", ownLoopIds)
      .eq("status", "trialing_no_card")
      .limit(1);
    if (priorTrialError) {
      return NextResponse.json(
        { error: `No se pudo verificar elegibilidad para el trial: ${priorTrialError.message}` },
        { status: 500 }
      );
    }
    alreadyUsedTrial = (priorTrial || []).length > 0;
  }

  if (alreadyUsedTrial) {
    return NextResponse.json({ trial: false, reason: "already_used" });
  }

  const { data: existingRow, error: existingRowError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("loop_id")
    .eq("loop_id", loopId)
    .maybeSingle();
  if (existingRowError) {
    return NextResponse.json(
      { error: `No se pudo verificar el estado del Loopy: ${existingRowError.message}` },
      { status: 500 }
    );
  }
  if (existingRow) {
    // Ya existe una fila para este Loopy específico (trial ya activo,
    // convertido a pago real, o cualquier otro estado) — nunca la
    // pisamos. Esto también cierra el caso "mismo loop" de la carrera
    // entre el chequeo de elegibilidad y el insert: llamar de nuevo a
    // este endpoint para un Loopy que ya tiene fila es un no-op seguro.
    return NextResponse.json({ trial: false, reason: "already_has_subscription" });
  }

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabaseAdmin.from("loop_subscriptions").upsert(
    {
      loop_id: loopId,
      stripe_customer_id: `trial_no_card_${loopId}`,
      stripe_subscription_id: `trial_no_card_${loopId}`,
      status: "trialing_no_card",
      trial_end: trialEnd,
    },
    { onConflict: "loop_id" }
  );
  if (insertError) {
    return NextResponse.json(
      { error: `No se pudo activar el trial: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ trial: true, trialEnd });
}
