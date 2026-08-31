import { expect, test } from "@playwright/test";

/**
 * Smoke test for the connective tissue no unit test reaches: the terminal
 * redirect() in createJobInfo, the cached getJobInfo read path, and the
 * navigation between job info and interviews.
 *
 * The Hume voice session is deliberately out of scope - it needs a microphone
 * and burns paid minutes.
 */
test("create a job description and reach its interviews list", async ({
  page,
}) => {
  const name = `E2E ${Date.now()}`;

  await page.goto("/app/job-infos/new");

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Job Title").fill("Staff Engineer");
  await page
    .getByLabel("Description")
    .fill(
      "Own a large TypeScript codebase, mentor engineers, and lead technical direction across two teams.",
    );

  await page.getByRole("button", { name: /save job information/i }).click();

  // createJobInfo redirects to the new record on success.
  await expect(page).toHaveURL(/\/app\/job-infos\/[0-9a-f-]{36}$/, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("link", { name: /practice interviewing/i }).click();
  await expect(page).toHaveURL(/\/interviews$/);
});

test("a job description that is not yours renders the 404 state", async ({
  page,
}) => {
  await page.goto("/app/job-infos/00000000-0000-4000-8000-000000000000");

  await expect(page.getByText(/couldn't find that/i)).toBeVisible();
  // The app shell must survive - this 404 lives inside AppLayout.
  await expect(page.getByRole("link", { name: /land/i })).toBeVisible();
});
