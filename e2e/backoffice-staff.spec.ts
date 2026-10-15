import { test, expect } from "@playwright/test";
import { isBackofficeStaffEmail } from "../lib/backofficeAuth";

/**
 * Prueba pura de lib/backofficeAuth.ts — sin browser, sin red, sin base de
 * datos, igual que e2e/has-loop-access.spec.ts. Import relativo a
 * propósito, igual que ese archivo.
 *
 * requireStaff() NO se prueba acá: necesita un NextRequest real con header
 * Authorization y una llamada real a Supabase Auth — eso lo cubre el test
 * de browser que agrega la Task 2 de este plan a este mismo archivo, más
 * el checklist de QA manual.
 *
 * Nota para quien edite lib/backofficeAuth.ts: ese archivo NO debe
 * importar "server-only" (a diferencia de lib/supabaseAdmin.ts /
 * lib/stripeClient.ts) — ese paquete lanza una excepción en tiempo de
 * import fuera del build de Next.js, lo que rompería este test en cuanto
 * Playwright lo importe.
 */
test.describe("isBackofficeStaffEmail", () => {
  const ORIGINAL_ENV = process.env.BACKOFFICE_STAFF_EMAILS;

  test.afterEach(() => {
    process.env.BACKOFFICE_STAFF_EMAILS = ORIGINAL_ENV;
  });

  test("sin variable de entorno configurada: nadie es staff", () => {
    delete process.env.BACKOFFICE_STAFF_EMAILS;
    expect(isBackofficeStaffEmail("sebastian@directloopy.com")).toBe(false);
  });

  test("email en la lista: es staff, case-insensitive y tolerando espacios", () => {
    process.env.BACKOFFICE_STAFF_EMAILS = "staff@directloopy.com, Otro@Directloopy.com";
    expect(isBackofficeStaffEmail("STAFF@directloopy.com")).toBe(true);
    expect(isBackofficeStaffEmail("otro@directloopy.com")).toBe(true);
  });

  test("email fuera de la lista: no es staff", () => {
    process.env.BACKOFFICE_STAFF_EMAILS = "staff@directloopy.com";
    expect(isBackofficeStaffEmail("cliente@gmail.com")).toBe(false);
  });

  test("null/undefined: no es staff", () => {
    process.env.BACKOFFICE_STAFF_EMAILS = "staff@directloopy.com";
    expect(isBackofficeStaffEmail(null)).toBe(false);
    expect(isBackofficeStaffEmail(undefined)).toBe(false);
  });
});
