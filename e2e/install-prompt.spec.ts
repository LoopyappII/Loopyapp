import { test, expect, type Page } from "@playwright/test";

/**
 * Cubre la parte determinista de components/InstallPrompt.tsx +
 * lib/useInstallPrompt.ts: gating (cookies, standalone, dismissals),
 * persistencia en localStorage, ruta de iOS y ruta nativa con un
 * `beforeinstallprompt` sintético (el evento real no se puede provocar
 * desde Playwright). El install nativo de verdad se verifica a mano en
 * dispositivos — ver el plan.
 *
 * Necesita el server en http://localhost:3000 (playwright.config.ts):
 *   npm run dev    # en otra terminal
 *   npx playwright test e2e/install-prompt.spec.ts
 *
 * Solo navega a páginas públicas (/, /login) — sin Supabase, sin login.
 */

const CARD = "[data-testid=install-prompt]";

/** Siembra localStorage antes de que corra cualquier script de la página. */
async function seed(page: Page, entries: Record<string, string>) {
  await page.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) window.localStorage.setItem(k, v);
    } catch {
      // iframes sandboxed (widget de Google Translate) no tienen storage.
    }
  }, entries);
}

/** Fuerza matchMedia("(display-mode: standalone)") -> matches:true. */
async function fakeStandalone(page: Page) {
  await page.addInitScript(() => {
    if (typeof window.matchMedia !== "function") return;
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q: string): MediaQueryList =>
      q === "(display-mode: standalone)"
        ? ({
            matches: true,
            media: q,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent() {
              return false;
            },
          } as MediaQueryList)
        : orig(q);
  });
}

/**
 * Dispara un `beforeinstallprompt` sintético con prompt()/userChoice y
 * cuenta las llamadas a prompt() en window.__promptCalls. Se reintenta con
 * toPass() porque el listener se agrega en un useEffect (post-hidratación).
 */
async function fireNativePromptUntilVisible(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  await expect(async () => {
    await page.evaluate((o) => {
      const w = window as unknown as { __promptCalls?: number };
      const e = new Event("beforeinstallprompt") as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string; platform: string }>;
      };
      e.prompt = () => {
        w.__promptCalls = (w.__promptCalls ?? 0) + 1;
        return Promise.resolve();
      };
      e.userChoice = Promise.resolve({ outcome: o, platform: "web" });
      window.dispatchEvent(e);
    }, outcome);
    await expect(page.locator(CARD)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test.describe("InstallPrompt", () => {
  test("no aparece hasta que el banner de cookies esté resuelto", async ({ page }) => {
    await page.goto("/");
    // sin loopy-cookie-consent en storage
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & { prompt?: () => Promise<void> };
      e.prompt = () => Promise.resolve();
      window.dispatchEvent(e);
    });
    await expect(page.locator(CARD)).toHaveCount(0);

    // al resolverse, aparece
    await page.evaluate(() => window.localStorage.setItem("loopy-cookie-consent", "accepted"));
    await fireNativePromptUntilVisible(page);
    await expect(page.getByRole("button", { name: "Instalar" })).toBeVisible();
  });

  test('"No volver a mostrar" oculta la card y persiste para siempre', async ({ page }) => {
    await seed(page, { "loopy-cookie-consent": "rejected" });
    await page.goto("/");
    await fireNativePromptUntilVisible(page);

    await page.getByRole("button", { name: "No volver a mostrar" }).click();
    await expect(page.locator(CARD)).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("loopy-install-dismissed"))).toBe("forever");

    await page.reload();
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & { prompt?: () => Promise<void> };
      e.prompt = () => Promise.resolve();
      window.dispatchEvent(e);
    });
    await expect(page.locator(CARD)).toHaveCount(0);
  });

  test("la X pospone ~7 días y sigue oculta tras recargar", async ({ page }) => {
    await seed(page, { "loopy-cookie-consent": "accepted" });
    await page.goto("/");
    await fireNativePromptUntilVisible(page);

    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator(CARD)).toBeHidden();

    const until = await page.evaluate(() => Number(localStorage.getItem("loopy-install-snooze")));
    const days = (until - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.5);
    expect(days).toBeLessThan(7.5);

    await page.reload();
    await fireNativeNoop(page);
    await expect(page.locator(CARD)).toHaveCount(0);
  });

  test("Safari iOS: muestra la guía manual sin beforeinstallprompt", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await seed(page, { "loopy-cookie-consent": "accepted" });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Cómo instalar" })).toBeVisible({ timeout: 12000 });
    await page.getByRole("button", { name: "Cómo instalar" }).click();
    await expect(page.getByText("Añadir a pantalla de inicio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entendido" })).toBeVisible();
    await context.close();
  });

  test("si la app ya está instalada (standalone), nunca aparece", async ({ page }) => {
    await fakeStandalone(page);
    await seed(page, { "loopy-cookie-consent": "accepted" });
    await page.goto("/");
    await fireNativeNoop(page);
    await expect(page.locator(CARD)).toHaveCount(0);
  });

  test("no aparece en /login ni /signup", async ({ page }) => {
    await seed(page, { "loopy-cookie-consent": "accepted" });
    await page.goto("/login");
    await fireNativeNoop(page);
    await expect(page.locator(CARD)).toHaveCount(0);

    await page.goto("/signup");
    await fireNativeNoop(page);
    await expect(page.locator(CARD)).toHaveCount(0);
  });

  test('"Instalar" llama a prompt() del evento nativo una sola vez', async ({ page }) => {
    await seed(page, { "loopy-cookie-consent": "accepted" });
    await page.goto("/");
    await fireNativePromptUntilVisible(page, "accepted");

    await page.getByRole("button", { name: "Instalar" }).click();
    await expect(page.locator(CARD)).toBeHidden(); // outcome "accepted" -> se oculta
    expect(await page.evaluate(() => (window as unknown as { __promptCalls?: number }).__promptCalls)).toBe(1);
  });

  test("?pwa=preview fuerza la card sin cookies, sin evento y hasta en /login", async ({ page }) => {
    // sin cookie resuelta, sin beforeinstallprompt, y en una ruta excluida
    await page.goto("/login?pwa=preview");
    await expect(page.locator(CARD)).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole("button", { name: "Instalar" })).toBeVisible();

    // el botón no revienta cuando no hay instalador nativo: muestra la nota
    await page.getByRole("button", { name: "Instalar" }).click();
    await expect(page.getByText(/Vista previa:/)).toBeVisible();

    // permanentemente descartada de antes: preview la muestra igual
    await page.evaluate(() => localStorage.setItem("loopy-install-dismissed", "forever"));
    await page.goto("/?pwa=preview");
    await expect(page.locator(CARD)).toBeVisible({ timeout: 6000 });
  });
});

/** Dispara un beforeinstallprompt sintético sin esperar que aparezca nada. */
async function fireNativeNoop(page: Page) {
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: string; platform: string }>;
    };
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(400);
}
