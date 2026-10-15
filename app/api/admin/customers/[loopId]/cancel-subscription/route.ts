import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/backofficeAuth";
import { cancelStripeSubscriptionIdempotent } from "@/lib/stripeCancel";
import { resolveStripeCustomerId } from "@/lib/stripeCustomerId";

export async function POST(req: NextRequest, { params }: { params: { loopId: string } }) {
  const auth = await requireStaff(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const loopId = params.loopId;

  const { data: sub, error: subError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("loop_id", loopId)
    .maybeSingle();
  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }
  if (!sub) {
    return NextResponse.json({ error: "Este Loopy no tiene una suscripción" }, { status: 404 });
  }
  if (sub.status === "canceled") {
    return NextResponse.json({ canceled: true, alreadyCanceled: true });
  }

  const isRealStripeSubscription = !!resolveStripeCustomerId(sub.stripe_customer_id);
  if (isRealStripeSubscription) {
    const cancelResult = await cancelStripeSubscriptionIdempotent(sub.stripe_subscription_id);
    if (!cancelResult.ok) {
      return NextResponse.json(
        { error: `No se pudo cancelar en Stripe: ${cancelResult.error}` },
        { status: 500 }
      );
    }
  }

  // Escribimos el estado local nosotros mismos, no esperamos al webhook: una
  // fila sintética (admin_bypass_/trial_no_card_) nunca va a disparar un
  // webhook de Stripe (no hay nada real allá), y aun para una suscripción
  // real preferimos que el staff vea "cancelada" al instante.
  const { error: updateError } = await supabaseAdmin
    .from("loop_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("loop_id", loopId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ canceled: true, alreadyCanceled: false });
}
