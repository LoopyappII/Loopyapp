import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Falta configurar el webhook" }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      // Solo trae los IDs — nunca llamamos de vuelta a Stripe acá. El
      // status real llega enseguida vía customer.subscription.created
      // (Stripe dispara ambos eventos casi simultáneamente).
      const session = event.data.object as Stripe.Checkout.Session;
      const loopId = session.metadata?.loop_id;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      if (loopId && customerId && subscriptionId) {
        await supabaseAdmin.from("loop_subscriptions").upsert(
          {
            loop_id: loopId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "incomplete",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "loop_id" }
        );
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const loopId = subscription.metadata?.loop_id;
      // Desde la API "Basil" de Stripe, current_period_end vive en el
      // subscription item, no en la subscription — seguimos sin llamar
      // de vuelta a Stripe, solo leemos lo que ya trae el evento.
      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
      const row = {
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      };
      if (loopId) {
        await supabaseAdmin
          .from("loop_subscriptions")
          .upsert({ loop_id: loopId, ...row }, { onConflict: "loop_id" });
      } else {
        // Sin metadata (no debería pasar si Task 3 la setea siempre) —
        // fallback por subscription_id para no perder la actualización.
        await supabaseAdmin
          .from("loop_subscriptions")
          .update(row)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const loopId = subscription.metadata?.loop_id;
      const update = { status: "canceled" as const, updated_at: new Date().toISOString() };
      if (loopId) {
        await supabaseAdmin.from("loop_subscriptions").update(update).eq("loop_id", loopId);
      } else {
        await supabaseAdmin
          .from("loop_subscriptions")
          .update(update)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Desde la API "Basil" de Stripe, el id de subscription vive en
      // invoice.parent.subscription_details.subscription (antes era
      // invoice.subscription directo) — sigue viniendo en el propio
      // evento, sin llamar de vuelta a Stripe.
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
      if (subscriptionId) {
        await supabaseAdmin
          .from("loop_subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
