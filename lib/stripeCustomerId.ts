/**
 * Normaliza un stripe_customer_id guardado en loop_subscriptions antes de
 * pasarlo a stripe.checkout.sessions.create. Las filas de trial sin
 * tarjeta (app/api/loops/start-trial/route.ts) y de admin bypass
 * (app/api/stripe/checkout/route.ts) guardan un id sintético
 * (`trial_no_card_<loopId>` / `admin_bypass_<loopId>`) en esa misma
 * columna, porque es `not null` — pero esos ids nunca existieron en
 * Stripe. Pasar uno tal cual a Stripe revienta con "No such customer".
 * Solo un id real de Stripe (siempre con prefijo `cus_`) es válido para
 * reusar como `customer` en una sesión de checkout nueva.
 */
export function resolveStripeCustomerId(rawCustomerId: string | null | undefined): string | null {
  if (!rawCustomerId) return null;
  return rawCustomerId.startsWith("cus_") ? rawCustomerId : null;
}
