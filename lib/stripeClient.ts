import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  // No lanzamos en tiempo de import para no romper `next build` cuando
  // las env vars todavía no están cargadas — se valida recién al usar
  // el cliente en runtime (las rutas que lo usan devuelven 500 si falta).
  console.warn(
    "STRIPE_SECRET_KEY no está configurada — las rutas de Stripe fallarán en runtime."
  );
}

export const stripe = new Stripe(secretKey || "sk_test_placeholder");
