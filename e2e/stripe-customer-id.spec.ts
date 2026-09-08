import { test, expect } from "@playwright/test";
import { resolveStripeCustomerId } from "../lib/stripeCustomerId";

/**
 * Prueba pura de lib/stripeCustomerId.ts — sin browser, sin red, sin base
 * de datos. Regresión directa del hallazgo C1 de la revisión final de
 * rama: un stripe_customer_id sintético (trial_no_card_/admin_bypass_)
 * pasado tal cual a Stripe revienta el checkout con "No such customer".
 */
test.describe("resolveStripeCustomerId", () => {
  test("un id real de Stripe (cus_...) se mantiene", () => {
    expect(resolveStripeCustomerId("cus_abc123")).toBe("cus_abc123");
  });

  test("un id sintético de trial sin tarjeta se descarta", () => {
    expect(resolveStripeCustomerId("trial_no_card_loop123")).toBeNull();
  });

  test("un id sintético de admin bypass se descarta", () => {
    expect(resolveStripeCustomerId("admin_bypass_loop123")).toBeNull();
  });

  test("null y undefined se mantienen null", () => {
    expect(resolveStripeCustomerId(null)).toBeNull();
    expect(resolveStripeCustomerId(undefined)).toBeNull();
  });

  test("string vacío se trata como ausente", () => {
    expect(resolveStripeCustomerId("")).toBeNull();
  });
});
