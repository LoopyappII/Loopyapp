import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The brief's 30s default is too tight once signup actually has to round
  // -trip through a real confirmation email (this Supabase project has
  // "Confirm email" ON — see e2e/loop-nav-shell.spec.ts's
  // confirmEmailViaMailinator). Supabase's built-in (non-custom-SMTP) email
  // service can back off to ~2min delivery delay under repeated load, and
  // this test does that round trip twice (once per user) sequentially, on
  // top of the create/join/tab-nav/SOS flow.
  timeout: 420000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
});
