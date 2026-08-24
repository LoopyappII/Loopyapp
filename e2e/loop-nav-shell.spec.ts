import { test, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * NOT SUITABLE FOR A TIGHT/FREQUENT CI LOOP AS-IS.
 *
 * This suite does real signups against this app's live Supabase project
 * (lib/supabaseClient.ts hardcodes the project URL; this worktree has no
 * .env.local override), and that project's "Confirm email" setting is ON
 * with no custom SMTP configured — so each signup has to round-trip
 * through a real confirmation email fetched from mailinator.com's public
 * inbox API (see confirmEmailViaMailinator below). Observed happy-path
 * time is 1.2-2.9 minutes; under repeated back-to-back runs, Supabase's
 * built-in email service has been observed backing off to ~2 minutes
 * before delivering, hence playwright.config.ts's 420s test timeout.
 *
 * Before wiring this into a CI pipeline that runs often: either configure
 * a custom SMTP provider on the Supabase project (removes the aggressive
 * default rate limiting) or add a test-only way to bypass/skip email
 * confirmation. Until then, expect this test to be slow and occasionally
 * flaky under concurrent/frequent execution — that's a live-email-
 * dependency characteristic of the environment, not a bug in the nav
 * shell this suite is testing.
 */

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();
const USER1 = { email: `qa.loopy1.${stamp}@mailinator.com`, name: "QA Uno" };
const USER2 = { email: `qa.loopy2.${stamp}@mailinator.com`, name: "QA Dos" };

// Read from the same env vars lib/supabaseClient.ts:7-13 already exposes
// (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY), falling back to
// the same literal defaults it uses, so a future staging project just needs
// those env vars set rather than an edit to this test file.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
// Public by design (see the comment above supabaseUrl/supabaseAnonKey in
// lib/supabaseClient.ts) — this is the same anon key already shipped in
// every browser bundle of this app, not a secret being duplicated here.
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";
// supabase-js's default localStorage session key is
// `sb-<url-hostname-first-label>-auth-token` (confirmed against the
// installed @supabase/supabase-js bundle) — derive it from SUPABASE_URL
// instead of hardcoding a second literal that could drift out of sync.
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

/**
 * Best-effort teardown of the real rows this run creates in the real,
 * live Supabase project this app points at (see SUPABASE_URL above and
 * lib/supabaseClient.ts — this worktree has no .env.local override, so
 * every run of this suite writes to that same live project). Left
 * unchecked, repeated runs accumulate junk indefinitely — this already
 * happened while developing this test (~8-9 signup/loop-create runs
 * during debugging).
 *
 * Deletes are attempted as BOTH users, each authenticated with their own
 * session token (read from that user's own browser localStorage — no
 * service-role key involved). RLS policies here aren't visible from a
 * plain client, and likely scope some deletes to "rows I created" (e.g.
 * each user's own `locations`/`sos_alerts` rows) rather than "any row in
 * a loop I admin" — attempting as both users is the closest a plain
 * client can get to full coverage without knowing the exact policies.
 * `loop_members`/`loops` are deleted last so an RLS policy that keys off
 * "am I still a member of this loop" isn't undermined mid-cleanup. No
 * assumption is made about `ON DELETE CASCADE` being configured on these
 * tables' `loop_id` columns — deleting a table with nothing left to
 * delete is simply a no-op.
 *
 * Every delete is independently try/caught (a row blocked by RLS, or
 * already gone, is not treated as a failure), and this whole function is
 * awaited with a top-level `.catch()` at its call site — a cleanup
 * problem here can never mask the test's actual pass/fail result.
 *
 * KNOWN LIMITATION: this cannot delete the two Auth users themselves.
 * `supabase.auth.admin.deleteUser` requires a service-role key, which is
 * correctly unavailable to a plain client (and shouldn't be added just
 * for this suite). The two `qa.loopy{1,2}.<timestamp>@mailinator.com`
 * accounts each run creates are left behind in `auth.users`. A periodic
 * service-role cleanup script/cron job (e.g. delete `auth.users` rows
 * where `email like 'qa.loopy%@mailinator.com'` and `created_at` is old)
 * is a reasonable follow-up, outside this task's scope.
 */
async function cleanupTestData(page1: Page, page2: Page, loopId: string) {
  const dependentTables = ["sos_alerts", "speed_alerts", "locations", "safe_zones"];

  async function deleteFromAs(page: Page, table: string, filter: string) {
    const token = await getAccessToken(page);
    if (!token) return;
    try {
      const res = await page.request.delete(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      if (!res.ok()) {
        console.warn(`[e2e cleanup] DELETE ${table} (${filter}): HTTP ${res.status()}`);
      }
    } catch (err) {
      console.warn(`[e2e cleanup] DELETE ${table} (${filter}) threw: ${err}`);
    }
  }

  for (const page of [page1, page2]) {
    for (const table of dependentTables) {
      await deleteFromAs(page, table, `loop_id=eq.${loopId}`);
    }
  }
  for (const page of [page1, page2]) {
    await deleteFromAs(page, "loop_members", `loop_id=eq.${loopId}`);
  }
  // Only user1 (the admin who created it) is expected to be able to
  // delete the loops row itself.
  await deleteFromAs(page1, "loops", `id=eq.${loopId}`);
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Tracked so the `finally` block below can attempt cleanupTestData()
  // even if an assertion throws partway through.
  let loopId: string | undefined;

  try {
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
    loopId = href?.match(/\/loop\/([^/]+)\//)?.[1];
    expect(loopId).toBeTruthy();

    const linkText = await loopLink1.innerText();
    const inviteCode = linkText.match(/Código:\s*(\S+)/)?.[1];
    expect(inviteCode).toBeTruthy();

    // Enter via the bare loop id (not the dashboard link, whose href already
    // points straight at /mapa) so app/loop/[id]/page.tsx's redirect to
    // /mapa actually runs at least once (Finding 7 item 1: this redirect had
    // zero coverage before, since every other entry point in this suite
    // targets a sub-path directly).
    await page1.goto(`/loop/${loopId}`);
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

    // user2 joins with the invite code — same "no auto-navigate" behavior.
    await page2.getByPlaceholder(/código de invitación/i).fill(inviteCode!);
    await page2.getByRole("button", { name: "Unirme" }).click();

    const loopLink2 = page2.locator("a", { hasText: loopName });
    await expect(loopLink2).toBeVisible({ timeout: 10000 });
    await loopLink2.click();
    await expect(page2).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

    // Tab navigation preserves loop id, doesn't get stuck loading, and each
    // tab renders real content rather than a blank/errored shell (Finding
    // 5). Driven by actually clicking BottomTabBar's links (not page.goto),
    // so this can tell "the shared layout persists across tab switches"
    // (the whole point of this refactor) apart from "the layout remounts on
    // every switch" (silent Realtime subscription churn) — both would pass
    // if every check just used goto (Finding 4). page1 is on /mapa here.
    const tabChecks: Array<{ name: string; path: string; heading: string }> = [
      { name: "Familia", path: "familia", heading: "Miembros" },
      { name: "Rutas", path: "rutas", heading: "Historial" },
      { name: "SOS", path: "sos", heading: "Botón SOS" },
      { name: "Mapa", path: "mapa", heading: "Tu familia" },
    ];
    for (const { name, path, heading } of tabChecks) {
      await page1.getByRole("link", { name, exact: true }).click();
      await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/${path}$`), { timeout: 10000 });
      await expect(page1.locator("text=Cargando Loopy...")).toHaveCount(0);
      await expect(page1.getByRole("heading", { name: heading })).toBeVisible();
    }

    // Cheapest high-value cross-tab flow (Finding 4): toggle a member's route
    // on Familia, then land on Mapa via BottomTabBar's link (not goto) and
    // confirm the route indicator chip appears there. This proves client-
    // side nav, that BottomTabBar's links work, that the routeUserId state
    // set on one tab survived the switch to another (it lives in the shared
    // LoopContext from app/loop/[id]/layout.tsx, not per-page state), and
    // exercises the shared Realtime-fed data (routePoints) across that
    // switch — page1 is on /mapa after the loop above.
    await page1.getByRole("link", { name: "Familia", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/familia$`));
    const routeToggle = page1.getByRole("button", { name: /^Ver recorrido de /i }).first();
    const toggleLabel = (await routeToggle.getAttribute("aria-label")) ?? "";
    const routeMemberName = toggleLabel.replace(/^Ver recorrido de /i, "").trim();
    expect(routeMemberName, "route-toggle button should carry a member name").toBeTruthy();
    await routeToggle.click();
    // toggleRoute() (LoopContext.tsx) itself calls router.push to /mapa the
    // moment a route is turned on, so this click may already be a no-op by
    // the time it runs — it's kept anyway so BottomTabBar's "Mapa" link is
    // itself exercised on this flow too, not just proven-by-side-effect.
    await page1.getByRole("link", { name: "Mapa", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa$`), { timeout: 10000 });
    const routeChip = page1.locator("div.absolute.top-3.left-3");
    await expect(routeChip).toBeVisible({ timeout: 10000 });
    // Case-insensitive: familia/page.tsx's aria-label fallback is "miembro"
    // while mapa/page.tsx's chip fallback is "Miembro" — both fire only if
    // profiles.name is missing, but matching case-insensitively keeps this
    // assertion correct either way instead of coupling it to that casing.
    await expect(routeChip).toContainText(new RegExp(escapeRegExp(routeMemberName), "i"));

    // Ajustes settings persistence (Finding 7 item 2): as the admin (user1,
    // who created the Loopy), save settings and confirm they read back from
    // Supabase after a full reload — exercises saveLoopSettings
    // (LoopContext.tsx) end to end, which Task 10 built and nothing in this
    // suite previously covered.
    await page1.getByRole("link", { name: "Ajustes del Loopy" }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/ajustes$`));
    const speedInput = page1.getByPlaceholder("Ej. 120");
    const emergencyInput = page1.getByPlaceholder("Ej. 911");
    await speedInput.fill("80");
    await emergencyInput.fill("112");
    const [settingsRes] = await Promise.all([
      page1.waitForResponse(
        (res) => res.url().includes("/rest/v1/loops") && res.request().method() === "PATCH"
      ),
      page1.getByRole("button", { name: "Guardar" }).click(),
    ]);
    expect(settingsRes.ok(), "saveLoopSettings PATCH should succeed").toBeTruthy();

    await page1.reload();
    await expect(page1.getByPlaceholder("Ej. 120")).toHaveValue("80", { timeout: 10000 });
    await expect(page1.getByPlaceholder("Ej. 911")).toHaveValue("112");

    // SOS fires while page2 is on a non-SOS, non-Mapa tab (familia) — this
    // is the assertion proving the sos_alerts Realtime subscription lives
    // in the shared layout, not in the /sos page, and survives tab
    // navigation.
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
  } finally {
    // Cleanup runs (with the pages/contexts still open, so their sessions
    // are usable) before closing anything, and its own failures are
    // swallowed here so they can never override/mask the test's real
    // outcome from the try block above.
    if (loopId) {
      await cleanupTestData(page1, page2, loopId).catch((err) => {
        console.warn(
          `[e2e cleanup] best-effort cleanup failed (non-fatal): ${
            err instanceof Error ? err.message : err
          }`
        );
      });
    }
    await ctx1.close().catch(() => {});
    await ctx2.close().catch(() => {});
  }
});
