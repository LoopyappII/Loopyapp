import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { data: sub, error: subError } = await supabaseAdmin
      .from("loop_subscriptions")
      .select("stripe_customer_id")
      .eq("loop_id", auth.loop.id)
      .single();
    if (subError || !sub) {
      return NextResponse.json(
        { error: "Este Loopy todavía no tiene una suscripción" },
        { status: 404 }
      );
    }

    const origin = req.headers.get("origin") || "https://www.directloopy.com";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/loop/${auth.loop.id}/suscripcion`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo abrir el portal de pago: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
