import { test, expect } from "@playwright/test";
import { hasLoopAccess, needsActivation } from "../lib/types";

/**
 * Prueba pura de lib/types.ts — sin browser, sin red, sin base de datos.
 * Vive en e2e/ solo porque es el único testDir configurado en
 * playwright.config.ts; a diferencia del resto de este directorio, corre
 * instantáneo y de forma determinística. Existe porque el vencimiento real
 * de "trialing_no_card" (Sección B del spec de 2026-09-07) no se puede
 * cubrir de forma realista con un test end-to-end: nadie puede esperar un
 * día real a que un trial venza en medio de una corrida de Playwright.
 * Import relativo (no "@/lib/types") a propósito: el alias "@/*" nunca fue
 * ejercitado por Playwright en este repo antes de este archivo.
 */
test.describe("hasLoopAccess / needsActivation", () => {
  test("sin estado: sin acceso, hace falta activar", () => {
    expect(hasLoopAccess(null)).toBe(false);
    expect(needsActivation(null)).toBe(true);
  });

  test("trialing_no_card con trial_end futuro: acceso, no hace falta activar", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(hasLoopAccess("trialing_no_card", future)).toBe(true);
    expect(needsActivation("trialing_no_card", future)).toBe(false);
  });

  test("trialing_no_card con trial_end pasado: sin acceso, hace falta activar", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(hasLoopAccess("trialing_no_card", past)).toBe(false);
    expect(needsActivation("trialing_no_card", past)).toBe(true);
  });

  test("trialing_no_card sin trial_end (fila inconsistente): sin acceso, hace falta activar", () => {
    expect(hasLoopAccess("trialing_no_card", null)).toBe(false);
    expect(needsActivation("trialing_no_card", null)).toBe(true);
  });

  test("admin_bypass: acceso permanente, nunca hace falta activar", () => {
    expect(hasLoopAccess("admin_bypass")).toBe(true);
    expect(needsActivation("admin_bypass")).toBe(false);
  });

  test("trialing/active/past_due (Stripe real): acceso, nunca hace falta activar", () => {
    for (const status of ["trialing", "active", "past_due"] as const) {
      expect(hasLoopAccess(status)).toBe(true);
      expect(needsActivation(status)).toBe(false);
    }
  });

  test("canceled/unpaid/incomplete/incomplete_expired/paused: sin acceso, y van a /suscripcion (no a /activar)", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(hasLoopAccess(status)).toBe(false);
      expect(needsActivation(status)).toBe(false);
    }
  });
});
