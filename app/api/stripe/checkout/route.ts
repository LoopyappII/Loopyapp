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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Falta configurar STRIPE_PRICE_ID" }, { status: 500 });
  }

  const origin = req.headers.get("origin") || "https://www.directloopy.com";
  const loopId = auth.loop.id;

  const { data: existingSub } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id")
    .eq("loop_id", loopId)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existingSub?.stripe_customer_id || undefined,
    customer_email: existingSub?.stripe_customer_id ? undefined : auth.userEmail || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 1,
      metadata: { loop_id: loopId },
    },
    client_reference_id: loopId,
    metadata: { loop_id: loopId },
    success_url: `${origin}/loop/${loopId}/familia?checkout=success`,
    cancel_url: `${origin}/loop/${loopId}/familia?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
