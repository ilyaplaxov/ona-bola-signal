import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

// The 2-minute demo from docs/DEMO_SCRIPT.md, in the default Uzbek interface. Screenshots go to
// docs/demo/ for the pitch deck and as a fallback if the live demo fails.

const SHOTS = "docs/demo";
const DEMO_PATIENT = "OB-DEMO-01";

/** Local database only: the reset script refuses a remote one. */
const resetDemoData = () => execSync("npm run db:reset", { stdio: "inherit" });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function actAs(page: Page, name: string) {
  const option = page.locator("#role-switcher option", { hasText: name });
  await expect(option).toHaveCount(1);
  await page.selectOption("#role-switcher", (await option.getAttribute("value")) ?? "");
}

/** The number on the Alerts tab (0 when the badge is hidden). */
async function pendingBadge(page: Page): Promise<number> {
  const text = await page.getByRole("link", { name: /^Ogohlantirishlar\s*\d*$/ }).innerText();
  return Number(text.match(/\d+/)?.[0] ?? 0);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
  resetDemoData();
});

test.afterAll(() => resetDemoData());

test("a nurse's visit turns the zone red and the specialist acknowledges the alert", async ({
  page,
}) => {
  await page.goto("/");
  await actAs(page, "Nilufar Saidova");
  await expect(page.getByRole("heading", { name: "Umumiy holat" })).toBeVisible();
  await expect(page.getByText("Soʻnggi harakatlar")).toBeVisible();
  await shot(page, "01-dashboard");

  await page.getByRole("link", { name: "Reyestr" }).click();
  await page.locator("#patient-search").fill(DEMO_PATIENT);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody a").first().click();
  const header = page.locator("header").filter({ hasText: DEMO_PATIENT });
  await expect(header.getByText("Yashil")).toBeVisible();
  // Risk-group badge from the anamnesis: first birth and pre-eclampsia in the family.
  await expect(header.getByText("Preeklampsiya: yuqori xavf")).toBeVisible();
  await shot(page, "02-patient-green");

  const pendingBefore = await pendingBadge(page);
  await page.locator("#m-sys").fill("148");
  await page.locator("#m-dia").fill("96");
  await page.locator("#m-prot").fill("0.6");
  await page.getByRole("button", { name: "Saqlash va baholash" }).click();
  await expect(page.getByText("Mutaxassisga ogohlantirish yuborildi.")).toBeVisible();
  await expect(header.getByText("Qizil")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nega bu zona" })).toBeVisible();
  // Each reason cites the protocol page its value comes from.
  await expect(
    page.getByText("Manba: «Антенатальный уход» milliy protokoli, 34-bet").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Manba: «Антенатальный уход» milliy protokoli, 34, 36-betlar").first(),
  ).toBeVisible();
  await expect.poll(() => pendingBadge(page)).toBe(pendingBefore + 1);
  await shot(page, "03-patient-red-with-reasons");

  await actAs(page, "Kamola Rasulova");
  await page.getByRole("link", { name: /^Ogohlantirishlar\s*\d*$/ }).click();
  const card = page.locator("li", { has: page.getByRole("link", { name: DEMO_PATIENT }) });
  await expect(card).toHaveCount(1);
  await shot(page, "04-specialist-inbox");
  await card.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(() => pendingBadge(page)).toBe(pendingBefore);

  await page.getByRole("link", { name: "Umumiy holat" }).click();
  const activity = page.locator("li", { hasText: "Ogohlantirish tasdiqlandi" }).first();
  await expect(activity).toContainText(DEMO_PATIENT);
  await shot(page, "05-dashboard-after");
});

test("a new synthetic patient can be registered and starts unassessed", async ({ page }) => {
  await page.goto("/patients");
  await actAs(page, "Nilufar Saidova");
  await page.getByRole("button", { name: "+ Yangi bemor" }).click();
  await page.locator("#r-ref").fill("OB-E2E-01");
  await page.locator("#r-name").fill("Sinov Bemor");
  await page.locator("#r-district").fill("Chilonzor");
  await page.locator("#r-facility").fill("Oilaviy poliklinika 12");
  await page.locator("#r-dob").fill("1998-05-04");
  await page.locator("#r-lmp").fill("2026-08-12");
  await expect(page.locator("#r-dating-preview")).toBeVisible();
  await page.locator("#r-previousCesarean").selectOption("yes");
  await shot(page, "06-registration-form");
  await page.getByRole("button", { name: /yxatga olish$/ }).click();

  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const header = page.locator("header").filter({ hasText: "OB-E2E-01" });
  await expect(header.getByText("Baholanmagan")).toBeVisible();
  await expect(header.getByText(/oxirgi hayz boʻyicha/)).toBeVisible();

  await page.locator("#patient-edit").click();
  await page.locator("#r-parity").fill("0");
  const notRecorded = page.getByText(/xavf guruhlari baholanmagan/);
  await expect(notRecorded).toBeVisible();
  await page.locator("#patient-form-save").click();
  await expect(page.locator("#patient-edit")).toBeVisible();
  await expect(notRecorded).toHaveCount(0);
});

test("the interface switches to English", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("link", { name: "Registry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("the interface switches to Russian, dates included", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "RU" }).click();
  await expect(page.getByRole("link", { name: "Реестр" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await page.getByRole("link", { name: "Реестр" }).click();
  await page.locator("#patient-search").fill("OB-DEMO-01");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody a").first().click();
  await expect(page.getByText("Текущая оценка")).toBeVisible();
  await expect(page.getByText("OB-DEMO-01")).toBeVisible();
  await expect(
    page
      .getByText(
        /\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}/,
      )
      .first(),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-russian-interface.png`, fullPage: true });
});
