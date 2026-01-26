/**
 * Run this script once to log in and save auth state.
 * The browser will open - log in manually, then close the browser.
 */
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const authFile = "e2e/.auth/user.json";

async function setupAuth() {
  console.log("Opening browser for manual login...");
  console.log("1. Log in to your account");
  console.log("2. Navigate to /packages to confirm you are logged in");
  console.log("3. Close the browser window\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/sign-in`);

  // Wait for manual login - browser will stay open until user closes it
  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});

  // Save auth state
  await context.storageState({ path: authFile });
  console.log(`\nAuth state saved to ${authFile}`);

  await browser.close();
}

setupAuth().catch(console.error);
