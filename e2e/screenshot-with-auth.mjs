/**
 * Takes screenshots using saved auth state.
 * Run auth-setup.mjs first to create the auth state file.
 */
import { chromium } from "playwright";
import { existsSync } from "fs";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const authFile = "e2e/.auth/user.json";

async function takeScreenshots() {
  if (!existsSync(authFile)) {
    console.error(`Auth state not found: ${authFile}`);
    console.log("Run 'bun e2e/auth-setup.mjs' first to log in and save auth state.");
    process.exit(1);
  }

  const browser = await chromium.launch();

  // Authenticated pages
  const authPages = [
    { path: "/packages", name: "packages" },
    { path: "/jh73hnq47w09vvpd43ewe6dmyn7zwfg8", name: "package-view" },
  ];

  // Public pages
  const publicPages = [];

  console.log("Taking screenshots...\n");

  // Dark mode with auth
  const darkAuthContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    storageState: authFile,
  });

  // Light mode with auth
  const lightAuthContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    storageState: authFile,
  });

  // Dark mode public
  const darkPublicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });

  // Light mode public
  const lightPublicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

  // Authenticated pages
  for (const { path, name } of authPages) {
    // Dark
    const darkPage = await darkAuthContext.newPage();
    await darkPage.goto(`${baseUrl}${path}`, { waitUntil: "load", timeout: 30000 });
    await darkPage.waitForTimeout(2000);
    await darkPage.screenshot({ path: `e2e/screenshots/${name}-dark.png` });
    console.log(`  ${name}-dark.png`);
    await darkPage.close();

    // Light
    const lightPage = await lightAuthContext.newPage();
    await lightPage.goto(`${baseUrl}${path}`, { waitUntil: "load", timeout: 30000 });
    await lightPage.waitForTimeout(2000);
    await lightPage.screenshot({ path: `e2e/screenshots/${name}-light.png` });
    console.log(`  ${name}-light.png`);
    await lightPage.close();
  }

  // Public pages
  for (const { path, name } of publicPages) {
    // Dark
    const darkPage = await darkPublicContext.newPage();
    await darkPage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await darkPage.screenshot({ path: `e2e/screenshots/${name}-dark.png`, fullPage: true });
    console.log(`  ${name}-dark.png`);
    await darkPage.close();

    // Light
    const lightPage = await lightPublicContext.newPage();
    await lightPage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await lightPage.screenshot({ path: `e2e/screenshots/${name}-light.png`, fullPage: true });
    console.log(`  ${name}-light.png`);
    await lightPage.close();
  }

  await browser.close();
  console.log("\nDone! Screenshots saved to e2e/screenshots/");
}

takeScreenshots().catch(console.error);
