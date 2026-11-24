import { expect, test, type Page } from "@playwright/test";
import { E2E, displayKey, testDepartmentId } from "./db";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.locator("#password").fill(E2E.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("clerk creates a token, doctor presses Next, the TV board updates within 2 seconds and the patient sees their turn", async ({
  browser,
}) => {
  const deptId = await testDepartmentId();
  const patientName = `Asha Testpatient ${Date.now() % 100000}`;
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

  const clerk = await (await browser.newContext()).newPage();
  const doctor = await (await browser.newContext()).newPage();
  const tv = await (await browser.newContext()).newPage();
  const patient = await (await browser.newContext()).newPage();

  // The TV board is open before anything happens, and is live.
  await tv.goto(`/display/${deptId}?key=${encodeURIComponent(displayKey())}`);
  await expect(tv.getByText(/^Live/)).toBeVisible();

  // 1. The clerk registers a patient.
  await login(clerk, E2E.clerkPhone);
  await clerk.goto("/desk");
  await clerk.locator("#phone").fill(phone);
  await clerk.locator("#name").fill(patientName);
  await clerk.locator("#age").fill("34");
  await clerk.locator("#sex").selectOption("F");
  await clerk.locator("#dept").selectOption(deptId);
  await clerk.locator("#consent").check();
  await clerk.getByRole("button", { name: "Create token" }).click();

  const label = (await clerk.locator('[aria-label^="Token "]').first().textContent())?.trim() ?? "";
  expect(label).toMatch(/^TST-\d{3}$/);
  // The slip carries the 8-character code that is also in the QR code.
  const code = (await clerk.locator(".print-slip-root .slip-small").last().textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // 2. The patient follows the queue on their own phone.
  await patient.goto(`/t/${code}`);
  await expect(patient.getByRole("heading", { name: "You are next" })).toBeVisible();

  // 3. The TV already lists the token as next, and never shows a name.
  await expect(tv.getByText(label)).toBeVisible();

  // 4. The doctor presses Next.
  await login(doctor, E2E.doctorPhone);
  await expect(doctor.getByText(patientName)).toBeVisible();
  await doctor.getByRole("button", { name: "Next", exact: true }).click();

  // 5. The TV shows the call within 2 seconds.
  await expect(tv.getByText(/Please go in/)).toBeVisible({ timeout: 2000 });
  await expect(tv.getByText(label).first()).toBeVisible();
  await expect(tv.locator("body")).not.toContainText(patientName);
  await expect(tv.locator("body")).not.toContainText("Asha");

  // 6. The patient's page says it is their turn (it re-reads every 5 seconds).
  await expect(patient.getByRole("heading", { name: "It is your turn!" })).toBeVisible({ timeout: 10_000 });

  // 7. The doctor finishes the visit; the patient's page follows.
  await doctor.getByRole("button", { name: "Start consult" }).click();
  await doctor.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(patient.getByRole("heading", { name: "Your visit is complete" })).toBeVisible({ timeout: 10_000 });
});

test("a patient checks in from the QR page and gets a token", async ({ page }) => {
  const phone = `97${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

  await page.goto("/checkin");
  await page.locator("#name").fill("Ravi Selfcheckin");
  await page.locator("#phone").fill(phone);
  await page.locator("#age").fill("65");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.locator("button[aria-pressed]", { hasText: "E2E Test Dept" }).click();
  await page.locator("#consent").check();
  await page.getByRole("button", { name: "Get token" }).click();

  await expect(page).toHaveURL(/\/t\/[A-Z0-9]{8}$/);
  await expect(page.getByLabel(/^Token TST-\d{3}$/)).toBeVisible();
});
