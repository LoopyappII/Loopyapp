import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";
import { isAdminBypassEmail } from "@/lib/adminBypass";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const loopId = auth.loop.id;

  // Admin en ADMIN_BYPASS_EMAILS: se activa el Loopy sin pasar por Stripe.
  // Nunca se llama a la API de Stripe ni se cobra nada. La respuesta no
  // lleva `url` (a propósito): el dashboard ya navega directo al Loopy
  // cuando no hay `url` en la respuesta, y la pantalla de suscripción
  // redirige explícitamente al ver `bypass: true`.
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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Falta configurar STRIPE_PRICE_ID" }, { status: 500 });
  }

  const origin = req.headers.get("origin") || "https://www.directloopy.com";

  try {
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
      // Campo nativo de Stripe, opcional (sin `required`): solo colecta ID
      // fiscal de EMPRESA (ej. es_cif — CIF español, no DNI personal), y
      // Stripe decide solo cuándo mostrarlo según la ubicación de quien
      // paga. Una familia lo deja en blanco y sigue de largo.
      tax_id_collection: { enabled: true },
      client_reference_id: loopId,
      metadata: { loop_id: loopId },
      success_url: `${origin}/loop/${loopId}/familia?checkout=success`,
      cancel_url: `${origin}/loop/${loopId}/familia?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo iniciar el pago: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
