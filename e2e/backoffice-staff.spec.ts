import { test, expect, type Page } from "@playwright/test";
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
    if (ORIGINAL_ENV === undefined) {
      delete process.env.BACKOFFICE_STAFF_EMAILS;
    } else {
      process.env.BACKOFFICE_STAFF_EMAILS = ORIGINAL_ENV;
    }
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

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";
const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token ?? null;
    } catch {
      return null;
    }
  }, SUPABASE_STORAGE_KEY);
}

// Copiado de e2e/stripe-billing.spec.ts (mismo proyecto real de Supabase,
// "Confirm email" ON) — ver ese archivo para el razonamiento completo.
async function confirmEmailViaMailinator(page: Page, email: string) {
  const localPart = email.split("@")[0];
  const inboxUrl = `https://www.mailinator.com/api/v2/domains/public/inboxes/${encodeURIComponent(localPart)}`;

  let msgId: string | undefined;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await page.request.get(inboxUrl);
      const data = await res.json();
      const msgs: Array<{ id: string; subject: string }> = data.msgs || [];
      const confirmMsg = msgs.find((m) => /confirm/i.test(m.subject)) ?? msgs[0];
      if (confirmMsg) {
        msgId = confirmMsg.id;
        break;
      }
    } catch {
      // Cuerpo vacío/inválido ocasional de la API pública de mailinator —
      // se trata como "todavía no llegó" y se sigue sondeando.
    }
    await page.waitForTimeout(3000);
  }
  if (!msgId) {
    throw new Error(`No confirmation email arrived at ${email} via mailinator.com within ~3min`);
  }

  const msgUrl = `https://www.mailinator.com/api/v2/domains/public/messages/${msgId}`;
  let msgData: { parts?: Array<{ headers?: Record<string, string>; body?: string }> } | undefined;
  for (let i = 0; i < 5; i++) {
    try {
      const msgRes = await page.request.get(msgUrl);
      msgData = await msgRes.json();
      break;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  if (!msgData) {
    throw new Error(`mailinator.com never returned a parseable body for message ${msgId}`);
  }
  const htmlPart = (msgData.parts || []).find((p: { headers?: Record<string, string> }) =>
    (p.headers?.["content-type"] || "").includes("text/html")
  );
  const html: string = htmlPart?.body || "";
  const linkMatch = html.match(/https:\/\/[^"'\s]*\/auth\/v1\/verify\?[^"'\s]*/);
  if (!linkMatch) {
    throw new Error(`Confirmation email for ${email} had no /auth/v1/verify link in its body`);
  }
  const verifyUrl = linkMatch[0].replace(/&amp;/g, "&");
  const verifyRes = await page.request.get(verifyUrl, { maxRedirects: 0 });
  expect(verifyRes.status(), "Supabase /auth/v1/verify should accept the token").toBeLessThan(400);
}

// Copiado de e2e/stripe-billing.spec.ts — ver ese archivo para el
// razonamiento sobre .pressSequentially() en el campo de teléfono.
async function signUpAndLogin(page: Page, email: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  const wentToMap = await page
    .waitForURL(/\/loop\/[^/]+\/mapa/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!wentToMap) {
    await expect(page.getByText("¡Cuenta creada!")).toBeVisible({ timeout: 5000 });
    await confirmEmailViaMailinator(page, email);

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Acceder" }).click();
    await expect(page).toHaveURL(/\/dashboard|\/loop\/[^/]+\/mapa/, { timeout: 15000 });
  }
}

test.describe("Backoffice staff gate (browser)", () => {
  test("cuenta recién creada (nunca en BACKOFFICE_STAFF_EMAILS por construcción): is-staff da false y /admin da No autorizado", async ({ page }) => {
    await signUpAndLogin(page, `qa.loopy.backoffice.${stamp}@mailinator.com`);
    const token = await getAccessToken(page);
    expect(token).toBeTruthy();

    const res = await page.request.get("/api/admin/is-staff", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.isStaff).toBe(false);

    await page.goto("/admin");
    await expect(page.getByText("No autorizado")).toBeVisible({ timeout: 10000 });
  });
});
