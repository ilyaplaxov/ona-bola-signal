import { defineConfig } from "@playwright/test";

// End-to-end check of the live demo (npm run e2e). Needs the database (npm run db:up). Reuses a
// running `npm run dev`, or starts one. Uses the installed Google Chrome, so no browser download.
// The tests reset the local demo database before and after they run.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    timezoneId: "Asia/Tashkent",
    viewport: { width: 1280, height: 860 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
