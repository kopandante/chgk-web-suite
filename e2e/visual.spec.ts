import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Visual Tests", () => {
  test("landing page - dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/landing-dark.png", fullPage: true });
  });

  test("landing page - light mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/landing-light.png", fullPage: true });
  });

  test("sign-in page - dark mode", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000); // Wait for Clerk UI to load
    await page.screenshot({ path: "e2e/screenshots/sign-in-dark.png" });
  });
});
