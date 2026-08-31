import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await clerkSetup();

  const identifier = process.env.E2E_CLERK_USER_IDENTIFIER;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!identifier || !password) {
    throw new Error(
      "E2E_CLERK_USER_IDENTIFIER and E2E_CLERK_USER_PASSWORD must be set.\n" +
        "Create a dedicated test user in your Clerk development instance " +
        "(email + password strategy) and put its credentials in .env.\n" +
        "Do NOT use a real account - the suite creates data as this user.",
    );
  }

  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "password", identifier, password },
  });

  // The users row is written by the Clerk webhook, so a brand-new test user
  // lands on /onboarding and waits. An established one goes straight through.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  await page.context().storageState({ path: authFile });
});
