import { expect, test } from "@playwright/test";
import { E2E } from "./db";

test.describe("who can open what", () => {
  test("a visitor who is not logged in is sent to the login page", async ({ page }) => {
    for (const path of ["/desk", "/doctor", "/admin", "/admin/reports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("the API refuses a visitor who is not logged in", async ({ request }) => {
    for (const path of ["/api/admin/users", "/api/reports/daily", "/api/export/tokens.csv", "/api/queue/anything"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
    }
  });

  test("a clerk cannot open admin pages or admin APIs", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#phone").fill(E2E.clerkPhone);
    await page.locator("#password").fill(E2E.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/desk/);
    expect((await page.request.get("/api/admin/users")).status()).toBe(403);
    expect((await page.request.get("/api/reports/daily")).status()).toBe(403);
  });

  test("the TV board refuses a wrong display key", async ({ page }) => {
    await page.goto("/display/anything?key=wrong-key-123");
    await expect(page.getByText("This screen needs a valid display link")).toBeVisible();
  });
});

test.describe("language", () => {
  test("the login page can be switched to Hindi and back, and the choice is remembered", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Staff login" })).toBeVisible();

    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expect(page.getByRole("heading", { name: "स्टाफ़ लॉगिन" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");

    await page.reload();
    await expect(page.getByRole("heading", { name: "स्टाफ़ लॉगिन" })).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Staff login" })).toBeVisible();
  });

  test("a wrong password shows the error in Hindi", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "हिन्दी" }).click();
    await page.locator("#phone").fill("9199999999");
    await page.locator("#password").fill("not-the-password");
    await page.getByRole("button", { name: "लॉग इन", exact: true }).click();
    await expect(page.getByText("फ़ोन नंबर या पासवर्ड ग़लत है।")).toBeVisible();
  });
});

test.describe("landing page", () => {
  test("shows the headline, the problem and the install box", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "No more standing in OPD lines." })).toBeVisible();
    await expect(page.getByText("MED-034")).toBeVisible();
    await expect(page.getByRole("link", { name: /Medical Dialogues/ })).toHaveAttribute("href", /medicaldialogues\.in/);
    await expect(page.getByRole("link", { name: /ThePrint/ })).toHaveAttribute("href", /theprint\.in/);
    await expect(page.locator("pre")).toContainText("docker compose up -d");
    await expect(page.getByText("Is it really free?")).toBeVisible();
  });

  test("works in Hindi", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ओपीडी की लाइन");
  });

  test("offers the installable app files", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).display).toBe("standalone");
    expect((await request.get("/icons/512.png")).headers()["content-type"]).toContain("image/png");
    expect((await request.get("/offline")).ok()).toBe(true);
  });
});
