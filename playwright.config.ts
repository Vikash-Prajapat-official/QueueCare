import { defineConfig, devices } from "@playwright/test";

// Reads .env for DISPLAY_KEY and DATABASE_URL when running on a developer machine.
// Variables already set (for example in CI) win.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: everything must come from the environment
}

// End-to-end tests drive a RUNNING QueueCare (docker compose up -d, or npm start) in a real browser.
// One worker, because every test shares one queue.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
