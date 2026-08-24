import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();
const USER1 = { email: `qa.loopy1.${stamp}@mailinator.com`, name: "QA Uno" };
const USER2 = { email: `qa.loopy2.${stamp}@mailinator.com`, name: "QA Dos" };

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
async function signUpAndLogin(page: Page, email: string, name: string) {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially("+34600000000", { delay: 20 });
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

async function grantGeo(context: BrowserContext, lat: number, lng: number) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: lat, longitude: lng });
}

test("nav shell: create, join, tabs, map, SOS survive across tabs", async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  // components/CookieConsent.tsx is a site-wide (pre-existing, unrelated to
  // this feature) fixed bottom banner that only hides once its choice is
  // stored in localStorage. Pre-seed it as already-accepted so its fixed
  // positioning doesn't intercept clicks on lower-page elements (e.g.
  // dashboard's "Unirme" button) — equivalent to a returning visitor who
  // already dismissed it.
  await ctx1.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  await ctx2.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));

  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await grantGeo(ctx1, 40.4168, -3.7038);
  await grantGeo(ctx2, 40.417, -3.704);

  await signUpAndLogin(page1, USER1.email, USER1.name);
  await signUpAndLogin(page2, USER2.email, USER2.name);

  // Create a Loopy from user1's dashboard. Creating does NOT auto-navigate
  // (app/dashboard/page.tsx's handleCreateLoop only inserts + reloads the
  // list) — the new Loopy shows up as a link in "Tus Loopys" that we then
  // click ourselves.
  const loopName = `QA Shell ${stamp}`;
  await page1.getByPlaceholder(/nombre del loopy/i).fill(loopName);
  await page1.getByRole("button", { name: "Crear Loopy" }).click();

  const loopLink1 = page1.locator("a", { hasText: loopName });
  await expect(loopLink1).toBeVisible({ timeout: 10000 });
  const href = await loopLink1.getAttribute("href");
  const loopId = href?.match(/\/loop\/([^/]+)\//)?.[1];
  expect(loopId).toBeTruthy();

  const linkText = await loopLink1.innerText();
  const inviteCode = linkText.match(/Código:\s*(\S+)/)?.[1];
  expect(inviteCode).toBeTruthy();

  await loopLink1.click();
  await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

  // user2 joins with the invite code — same "no auto-navigate" behavior.
  await page2.getByPlaceholder(/código de invitación/i).fill(inviteCode!);
  await page2.getByRole("button", { name: "Unirme" }).click();

  const loopLink2 = page2.locator("a", { hasText: loopName });
  await expect(loopLink2).toBeVisible({ timeout: 10000 });
  await loopLink2.click();
  await expect(page2).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

  // Tab navigation preserves loop id and doesn't get stuck loading.
  for (const tab of ["familia", "rutas", "sos", "mapa"]) {
    await page1.goto(`/loop/${loopId}/${tab}`);
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/${tab}$`));
    await expect(page1.locator("text=Cargando Loopy...")).toHaveCount(0);
  }

  // SOS fires while page2 is on a non-SOS, non-Mapa tab (familia) — this is
  // the assertion proving the sos_alerts Realtime subscription lives in the
  // shared layout, not in the /sos page, and survives tab navigation.
  await page2.goto(`/loop/${loopId}/familia`);
  await page1.goto(`/loop/${loopId}/sos`);
  const sosButton = page1.getByRole("button", { name: /mantén presionado/i });
  await expect(sosButton).toBeVisible();
  const box = await sosButton.boundingBox();
  await page1.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page1.mouse.down();
  await page1.waitForTimeout(1400); // hold threshold is 1200ms (sos/page.tsx)
  await page1.mouse.up();

  await expect(page2.locator("text=necesita ayuda")).toBeVisible({ timeout: 10000 });

  await ctx1.close();
  await ctx2.close();
});
