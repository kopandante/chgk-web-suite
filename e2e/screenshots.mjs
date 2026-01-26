import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

async function takeScreenshots() {
  const browser = await chromium.launch();

  // Dark mode screenshots
  const darkContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });

  // Light mode screenshots
  const lightContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

  const pages = [
    { path: "/", name: "landing" },
    { path: "/sign-in", name: "sign-in" },
  ];

  console.log("Taking screenshots...\n");

  for (const { path, name } of pages) {
    // Dark mode
    const darkPage = await darkContext.newPage();
    await darkPage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await darkPage.waitForTimeout(1000);
    await darkPage.screenshot({ path: `e2e/screenshots/${name}-dark.png`, fullPage: path === "/" });
    console.log(`  ${name}-dark.png`);
    await darkPage.close();

    // Light mode
    const lightPage = await lightContext.newPage();
    await lightPage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await lightPage.waitForTimeout(1000);
    await lightPage.screenshot({ path: `e2e/screenshots/${name}-light.png`, fullPage: path === "/" });
    console.log(`  ${name}-light.png`);
    await lightPage.close();
  }

  await browser.close();
  console.log("\nDone!");
}

takeScreenshots().catch(console.error);
