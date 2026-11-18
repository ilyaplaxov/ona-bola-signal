import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

// The 2-minute demo from docs/DEMO_SCRIPT.md, in the default Uzbek interface. Screenshots go to
// docs/demo/ for the pitch deck and as a fallback if the live demo fails.
//
// Roles come from signing in (there is no role switcher any more). The demo accounts are the
// seeded users: username = first name . last name in lower case, one shared demo password.

const SHOTS = "docs/demo";
const DEMO_PATIENT = "OB-DEMO-01";
// TEMP: the shared demo password of the sign-in fallback (frontend/src/app/auth.tsx). Once the
// server's /api/auth/demo-accounts fixes the real one, change it here.
const DEMO_PASSWORD = "demo1234";

const NURSE = "nilufar.saidova";
const DOCTOR = "aziza.karimova";
const SPECIALIST = "kamola.rasulova";

// A 1x1 PNG: a synthetic "document" for the upload tests.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Local database only: the reset script refuses a remote one. */
const resetDemoData = () => execSync("npm run db:reset", { stdio: "inherit" });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(DEMO_PASSWORD);
  await page.locator("#login-submit").click();
  await expect(page.locator("#profile-link")).toBeVisible();
}

async function signOut(page: Page) {
  await page.locator("#sign-out").click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Sign out and sign in as someone else, in the same browser (the TEMP stores are shared). */
async function switchTo(page: Page, username: string) {
  await signOut(page);
  await signIn(page, username);
}

async function openDemoPatient(page: Page) {
  await page.getByRole("link", { name: "Reyestr" }).click();
  await page.locator("#patient-search").fill(DEMO_PATIENT);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody a").first().click();
  await expect(page.locator("header").filter({ hasText: DEMO_PATIENT })).toBeVisible();
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

test("sign-in: nobody gets in without it, a wrong password is refused", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await shot(page, "00-login");

  await page.locator("#login-username").fill(NURSE);
  await page.locator("#login-password").fill("not-the-password");
  await page.locator("#login-submit").click();
  await expect(page.getByRole("alert")).toContainText("notoʻgʻri");

  await page.locator("#login-password").fill(DEMO_PASSWORD);
  await page.locator("#login-submit").click();
  await expect(page.locator("#profile-link")).toContainText("Nilufar Saidova");
  await signOut(page);
});

test("a nurse's visit turns the zone red and the specialist acknowledges the alert", async ({
  page,
}) => {
  await signIn(page, NURSE);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Umumiy holat" })).toBeVisible();
  await expect(page.getByText("Soʻnggi harakatlar")).toBeVisible();
  await shot(page, "01-dashboard");

  await openDemoPatient(page);
  const header = page.locator("header").filter({ hasText: DEMO_PATIENT });
  await expect(header.getByText("Yashil")).toBeVisible();
  // Risk-group badge from the anamnesis: first birth and pre-eclampsia in the family.
  await expect(header.getByText("Preeklampsiya: yuqori xavf")).toBeVisible();
  await shot(page, "02-patient-green");

  const pendingBefore = await pendingBadge(page);
  await page.locator("#tab-visits").click();
  await page.locator("#m-sys").fill("148");
  await page.locator("#m-dia").fill("96");
  await page.locator("#m-prot").fill("0.6");
  await page.getByRole("button", { name: "Saqlash va baholash" }).click();
  await expect(page.getByText("Mutaxassisga ogohlantirish yuborildi.")).toBeVisible();
  await expect(header.getByText("Qizil")).toBeVisible();
  await page.locator("#tab-overview").click();
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

  // The specialist sees every district, so her badge has its own count.
  await switchTo(page, SPECIALIST);
  await page.getByRole("link", { name: /^Ogohlantirishlar\s*\d*$/ }).click();
  const card = page.locator("li", { has: page.getByRole("link", { name: DEMO_PATIENT }) });
  await expect(card).toHaveCount(1);
  const specialistPending = await pendingBadge(page);
  await shot(page, "04-specialist-inbox");
  await card.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(() => pendingBadge(page)).toBe(specialistPending - 1);

  await page.getByRole("link", { name: "Umumiy holat" }).click();
  const activity = page.locator("li", { hasText: "Ogohlantirish tasdiqlandi" }).first();
  await expect(activity).toContainText(DEMO_PATIENT);
  await shot(page, "05-dashboard-after");
});

test("a referral goes doctor → specialist → conclusion → closed", async ({ page }) => {
  await signIn(page, DOCTOR);
  await openDemoPatient(page);
  await page.locator("#tab-referrals").click();
  await page.locator("#referral-open").click();
  // The demo specialist has no specialty in the seed, so any choice reaches them in the TEMP store.
  await page.locator("#referral-specialty").selectOption("CARDIOLOGIST");
  await page.locator("#referral-reason").fill("Sintetik: yuqori bosim, kardiolog koʻrigi kerak");
  await page.locator("#referral-submit").click();
  await expect(page.locator('[data-referral="SENT"]')).toBeVisible();
  await shot(page, "08-referral-sent");

  await switchTo(page, SPECIALIST);
  await page.locator('nav a[href="/referrals"]').click();
  await expect(page.locator('[data-referral="SENT"]')).toHaveCount(1);
  await shot(page, "09-specialist-referral-inbox");
  await page.locator('[data-referral-action="accept"]').click();
  await expect(page.locator('[data-referral="ACCEPTED"]')).toBeVisible();
  await page.locator('[data-referral-action="write-conclusion"]').click();
  await page
    .locator("[data-referral] textarea")
    .fill("Sintetik xulosa: bosim nazorati, 2 haftadan keyin qayta koʻrik.");
  await page.locator('[data-referral-action="conclude"]').click();
  await expect(page.locator('[data-referral="CONCLUDED"]')).toBeVisible();

  await switchTo(page, DOCTOR);
  await openDemoPatient(page);
  await page.locator("#tab-referrals").click();
  await expect(page.getByText("Sintetik xulosa")).toBeVisible();
  await page.locator('[data-referral-action="close"]').click();
  await expect(page.locator('[data-referral="CLOSED"]')).toBeVisible();
  await signOut(page);
});

test("a document is uploaded by drag-and-drop and by the button, then previewed", async ({
  page,
}) => {
  await signIn(page, DOCTOR);
  await openDemoPatient(page);
  await page.locator("#tab-documents").click();

  // Drag and drop onto the drop zone.
  const dataTransfer = await page.evaluateHandle(
    (bytes) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "uzi-drop.png", { type: "image/png" }));
      return dt;
    },
    [...PNG],
  );
  await page.locator("#doc-dropzone").dispatchEvent("drop", { dataTransfer });
  await page.locator("#doc-kind").selectOption("ULTRASOUND");
  await page.locator("#doc-upload").click();
  await expect(page.locator('[data-document="ULTRASOUND"]')).toHaveCount(1);

  // The button (a file input).
  await page
    .locator("#doc-file")
    .setInputFiles({ name: "analiz.png", mimeType: "image/png", buffer: PNG });
  await page.locator("#doc-kind").selectOption("LAB_RESULTS");
  await page.locator("#doc-upload").click();
  await expect(page.locator('[data-document="LAB_RESULTS"]')).toHaveCount(1);

  // DIMED: waiting at first, sent a few seconds later (the stub delivers it).
  await expect(page.locator('[data-dimed="SENT"]').first()).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-document] button").first().click();
  await expect(page.locator("[data-document] img")).toBeVisible();
  await shot(page, "10-documents");

  // A file that is not a PDF, JPG, PNG or DICOM is refused before it leaves the browser.
  await page.locator("#doc-file").setInputFiles({
    name: "x.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("MZ"),
  });
  await expect(page.getByRole("alert")).toContainText("PDF, JPG, PNG");
  await signOut(page);
});

test("a patient's signal from /signal reaches the doctor, who reacts to it", async ({ page }) => {
  await signIn(page, DOCTOR);
  await openDemoPatient(page);
  await page.locator("#signal-connect").click();
  const code = (await page.locator("#signal-code").innerText()).trim();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

  // The patient's phone: another tab of the same browser, no sign-in.
  const phone = await page.context().newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`/signal?code=${code}`);
  await expect(phone.locator("#signal-next")).toBeDisabled(); // consent first
  await phone.locator("#signal-consent").check();
  await phone.locator("#signal-next").click();
  await phone.locator('[data-signal-kind="HEADACHE_VISION"]').click();
  await expect(phone.locator("#signal-answer")).toContainText("103");
  await phone.screenshot({ path: `${SHOTS}/11-patient-signal-phone.png`, fullPage: true });
  await phone.close();

  await page.getByRole("link", { name: /^Ogohlantirishlar\s*\d*$/ }).click();
  const card = page.locator('[data-signal="NEW"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("bemordan"); // the "from patient" mark
  await expect(card).toContainText(DEMO_PATIENT);
  await shot(page, "12-patient-signal-inbox");
  await card.locator('[data-signal-action="CONTACTED"]').click();
  await expect(page.locator('[data-signal="NEW"]')).toHaveCount(0);
  await signOut(page);
});

test("a new synthetic patient can be registered and starts unassessed", async ({ page }) => {
  // Registration is the obstetrician's (access matrix); nurses record visits.
  await signIn(page, DOCTOR);
  await page.goto("/patients");
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

test("the public home page opens and the doctor portal leads to the sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every pregnancy deserves a closer watch/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Doctor portal" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("the interface switches to English", async ({ page }) => {
  await signIn(page, NURSE);
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("link", { name: "Registry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("the interface switches to Russian, dates included", async ({ page }) => {
  await signIn(page, NURSE);
  await page.getByRole("button", { name: "RU" }).click();
  await expect(page.getByRole("link", { name: "Реестр" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await page.getByRole("link", { name: "Реестр" }).click();
  await page.locator("#patient-search").fill("OB-DEMO-01");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody a").first().click();
  await expect(page.getByText("Текущая оценка")).toBeVisible();
  await expect(page.getByText("OB-DEMO-01").first()).toBeVisible();
  await expect(
    page
      .getByText(
        /\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}/,
      )
      .first(),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-russian-interface.png`, fullPage: true });
});
