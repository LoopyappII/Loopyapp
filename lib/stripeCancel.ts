import { stripe } from "@/lib/stripeClient";

export type CancelResult = { ok: true } | { ok: false; error: string };

/**
 * Cancela una suscripción de Stripe de forma idempotente: si Stripe ya
 * no la tiene (código "resource_missing" — se canceló por otra vía, o
 * nunca existió), lo trata como éxito, no como error. Cualquier otro
 * error (red, rate limit, auth real) devuelve {ok:false} — el llamador
 * debe abortar en ese caso, nunca asumir que la cancelación ocurrió.
 */
export async function cancelStripeSubscriptionIdempotent(
  stripeSubscriptionId: string
): Promise<CancelResult> {
  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return { ok: true };
  } catch (err) {
    const stripeErr = err as { code?: string; message?: string };
    if (stripeErr.code === "resource_missing") {
      return { ok: true };
    }
    return { ok: false, error: stripeErr.message || "Error desconocido de Stripe" };
  }
}
