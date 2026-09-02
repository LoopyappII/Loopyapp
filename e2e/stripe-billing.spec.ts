import { test, expect, type Page } from "@playwright/test";
import Stripe from "stripe";

/**
 * Corre contra la app real y el proyecto Supabase real de Loopy — mismo
 * patrón y mismas limitaciones que e2e/loop-nav-shell.spec.ts (ver el
 * comentario al inicio de ese archivo: signups reales vía mailinator,
 * 1.2-2.9 min por corrida, timeout de test en 420s). Además depende de
 * que la tabla `loop_subscriptions` exista en esa base — ver
 * docs/superpowers/specs/2026-08-31-loop-subscriptions.sql. Hasta que
 * esa migración se corra a mano en el Supabase Dashboard, el test 2 y el
 * test 3 de este archivo fallan con un error de "tabla no existe", no
 * por un bug de código (el test 1 no toca esa tabla).
 *
 * No usa credenciales reales de Stripe: STRIPE_WEBHOOK_SECRET (la misma
 * variable que ya carga app/api/stripe/webhook/route.ts) solo necesita
 * ser cualquier string fijo en .env.local — se usa únicamente para
 * firmar localmente los payloads de prueba con el mismo algoritmo que
 * Stripe usa para verificar. No hay ninguna llamada de red a Stripe en
 * este archivo.
 */

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";
const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const WEBHOOK_SECRET_TEST = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_fixed_for_e2e";

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

/**
 * This Supabase project has "Confirm email" ON (verified directly against
 * the real project via the Auth REST API before writing this): signUp()
 * returns no session, and a fresh account can't log in until its email is
 * confirmed ("Email not confirmed" error). The mailinator.com addresses
 * used above exist for exactly this — mailinator's public inbox API (no
 * auth required) lets us fetch the real confirmation email Supabase sends
 * and follow the real verify link, with no admin/service-role shortcut.
 */
async function confirmEmailViaMailinator(page: Page, email: string) {
  const localPart = email.split("@")[0];
  const inboxUrl = `https://www.mailinator.com/api/v2/domains/public/inboxes/${encodeURIComponent(localPart)}`;

  // This project uses Supabase's built-in (non-custom-SMTP) email service,
  // which queues/backs off under load rather than delivering instantly —
  // observed delays up to ~2 minutes when running this suite repeatedly in
  // a short window. Poll generously rather than assuming a fixed SLA.
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
      // mailinator's public API occasionally returns an empty/invalid body
      // (rate limiting or a transient hiccup) — treat as "not arrived yet"
      // and keep polling rather than failing the whole run on a fluke.
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

  // The confirmation happens server-side on this GET; the app's
  // redirect_to (loopy.company) doesn't need to actually resolve, so don't
  // follow the 303.
  const verifyRes = await page.request.get(verifyUrl, { maxRedirects: 0 });
  expect(verifyRes.status(), "Supabase /auth/v1/verify should accept the token").toBeLessThan(400);
}

/**
 * app/signup/page.tsx's Nombre/Email/Contraseña inputs have <label> text but
 * no `placeholder` and no `for`/`id` pairing with their labels, so
 * getByPlaceholder/getByLabel can't find them. They're selected by `type`
 * (email/password) or, for the untyped Nombre input, by DOM order (it's the
 * form's first <input>, before the phone widget's inputs).
 *
 * The Teléfono field is react-phone-number-input (PhoneInput), which renders
 * a country <select> plus a controlled <input type="tel" placeholder="+34
 * 600 000 000">. Its onChange re-formats the value against the previous one
 * on every keystroke, so a single `.fill()` (which sets the whole value in
 * one shot) can leave the library's internal formatter state out of sync.
 * `.pressSequentially()` sends real per-character key events instead, which
 * this library needs.
 */
async function signUpAndLogin(page: Page, email: string, name: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  const wentToDashboard = await page
    .waitForURL(/\/dashboard/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!wentToDashboard) {
    // Confirmation required: app/signup/page.tsx shows the "revisa tu
    // email" card instead of redirecting (data.session was null).
    await expect(page.getByText("¡Cuenta creada!")).toBeVisible({ timeout: 5000 });
    await confirmEmailViaMailinator(page, email);

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Acceder" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }
}

async function createLoop(page: Page, loopName: string) {
  await page.getByPlaceholder(/nombre del loopy/i).fill(loopName);
  await page.getByRole("button", { name: "Crear Loopy" }).click();
  // Sin STRIPE_PRICE_ID/STRIPE_SECRET_KEY reales cargados hoy, la llamada a
  // /api/stripe/checkout en handleCreateLoop devuelve error y el frontend
  // cae al fallback de router.push a /familia — el layout gatea el acceso
  // ahí mismo (sin fila en loop_subscriptions), así que el destino real
  // termina siendo /suscripcion. Esperar cualquiera de los dos evita que
  // el test dependa de cuál gana la carrera.
  await page.waitForURL(/\/loop\/[^/]+\/(familia|suscripcion)/, { timeout: 30000 });
  const loopId = page.url().match(/\/loop\/([^/]+)\//)?.[1];
  if (!loopId) throw new Error(`No se pudo extraer loopId de ${page.url()}`);
  return loopId;
}

test.describe("Stripe billing", () => {
  test("un no-admin no puede crear una Checkout Session para el Loopy de otro", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signUpAndLogin(adminPage, `qa.loopy.stripe.admin.${stamp}@mailinator.com`, "QA Admin");
    const loopId = await createLoop(adminPage, `QA Stripe ${stamp}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signUpAndLogin(otherPage, `qa.loopy.stripe.other.${stamp}@mailinator.com`, "QA Otro");
    const otherToken = await getAccessToken(otherPage);
    expect(otherToken).toBeTruthy();

    const res = await otherPage.request.post("/api/stripe/checkout", {
      headers: { Authorization: `Bearer ${otherToken}` },
      data: { loopId },
    });
    expect(res.status()).toBe(403);

    await adminContext.close();
    await otherContext.close();
  });

  test("el webhook actualiza loop_subscriptions con eventos firmados localmente", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signUpAndLogin(adminPage, `qa.loopy.stripe.wh.${stamp}@mailinator.com`, "QA Webhook");
    const loopId = await createLoop(adminPage, `QA Webhook ${stamp}`);

    const fakeCustomerId = `cus_e2e_${stamp}`;
    const fakeSubscriptionId = `sub_e2e_${stamp}`;

    function sign(payload: string) {
      return Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET_TEST });
    }

    // NOTA: el shape acá sigue la API "Basil" de Stripe, confirmada contra
    // el código real de app/api/stripe/webhook/route.ts (Task 2, ya
    // aprobado) — current_period_end vive en items.data[0], no en la
    // subscription directa como en versiones viejas de la API.
    const subscriptionEvent = {
      id: `evt_e2e_${stamp}`,
      object: "event",
      type: "customer.subscription.created",
      data: {
        object: {
          id: fakeSubscriptionId,
          object: "subscription",
          customer: fakeCustomerId,
          status: "trialing",
          trial_end: Math.floor(Date.now() / 1000) + 86400,
          items: {
            object: "list",
            data: [
              {
                id: `si_e2e_${stamp}`,
                object: "subscription_item",
                current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              },
            ],
          },
          metadata: { loop_id: loopId },
        },
      },
    };
    const payload = JSON.stringify(subscriptionEvent);

    const res = await adminPage.request.post("/api/stripe/webhook", {
      headers: { "stripe-signature": sign(payload), "content-type": "application/json" },
      data: payload,
    });
    expect(res.ok()).toBeTruthy();

    const token = await getAccessToken(adminPage);
    const subRes = await adminPage.request.get(
      `${SUPABASE_URL}/rest/v1/loop_subscriptions?loop_id=eq.${loopId}&select=status,stripe_subscription_id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    expect(subRes.ok()).toBeTruthy();
    const rows = await subRes.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("trialing");
    expect(rows[0].stripe_subscription_id).toBe(fakeSubscriptionId);

    // Ahora sí tiene acceso: reentrar al Loopy no debe rebotar a /suscripcion
    await adminPage.goto(`/loop/${loopId}/familia`);
    await expect(adminPage).toHaveURL(new RegExp(`/loop/${loopId}/familia`));

    await adminContext.close();
  });

  test("un Loopy sin fila en loop_subscriptions rebota a /suscripcion", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndLogin(page, `qa.loopy.stripe.gate.${stamp}@mailinator.com`, "QA Gate");
    const loopId = await createLoop(page, `QA Gate ${stamp}`);

    // Renavegar explícito a /familia para confirmar el rebote incluso si
    // createLoop ya había aterrizado directo en /suscripcion.
    await page.goto(`/loop/${loopId}/familia`);
    await expect(page).toHaveURL(new RegExp(`/loop/${loopId}/suscripcion`), { timeout: 15000 });

    await context.close();
  });
});
