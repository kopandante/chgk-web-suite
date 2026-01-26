import { chromium } from "playwright";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

// Chrome profile paths
const chromePaths = {
  darwin: join(homedir(), "Library/Application Support/Google/Chrome"),
  linux: join(homedir(), ".config/google-chrome"),
  win32: join(homedir(), "AppData/Local/Google/Chrome/User Data"),
};

async function takeAuthenticatedScreenshots() {
  const profilePath = chromePaths[process.platform];

  if (!existsSync(profilePath)) {
    console.error(`Chrome profile not found at: ${profilePath}`);
    console.log("\nAlternative: Run Chrome with remote debugging:");
    console.log('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    process.exit(1);
  }

  console.log(`Using Chrome profile: ${profilePath}`);
  console.log("NOTE: Close Chrome before running this script!\n");

  // Use a copy of the profile to avoid conflicts
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    channel: "chrome", // Use installed Chrome
  });

  const pages = [
    { path: "/packages", name: "packages" },
  ];

  console.log("Taking authenticated screenshots...\n");

  for (const { path, name } of pages) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for data to load
      await page.screenshot({ path: `e2e/screenshots/${name}-dark.png` });
      console.log(`  ${name}-dark.png`);
    } catch (error) {
      console.error(`  Error on ${path}: ${error.message}`);
    }
    await page.close();
  }

  await context.close();
  console.log("\nDone!");
}

takeAuthenticatedScreenshots().catch(console.error);
