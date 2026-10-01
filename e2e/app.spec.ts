import { test, expect } from "@playwright/test";
test("learn, review, edit, backup, restore, and study offline", async ({
  page,
  context,
  browserName,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little Korean. Every day." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /02 Add a little/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Start with Hangul" }).click();
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("button", { name: "오", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finish & practice" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "아", exact: true }).click();
  await page.getByRole("button", { name: "Finish & practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Your daily practice." }),
  ).toBeVisible();
  await expect(
    page.getByText("a · open “ah” sound", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Show romanization hint" }).click();
  await expect(page.getByText("a", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText("1 / 5 new today")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("New cards per day").selectOption("3");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  await page.getByLabel("Korean", { exact: true }).fill("안녕");
  await page.getByLabel("Meaning", { exact: true }).fill("Hi (informal)");
  await page.getByRole("button", { name: "Save word" }).click();
  await page.getByRole("button", { name: "Edit 안녕", exact: true }).click();
  await page.getByLabel("Meaning", { exact: true }).fill("Hello (informal)");
  await page.getByRole("button", { name: "Save word" }).click();
  await expect(
    page.getByText("Hello (informal)", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByLabel("New cards per day").selectOption("10");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByText(/not a valid Haru Cards/)).toBeVisible();
  await expect(page.getByLabel("New cards per day")).toHaveValue("10");
  await page.locator("input[type=file]").setInputFiles(path!);
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await expect(page.getByLabel("New cards per day")).toHaveValue("3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Chromium supports service-worker offline emulation reliably in Playwright.
  if (browserName === "chromium") {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Review", exact: false }).click();
    await expect(
      page.getByRole("button", { name: "Reveal answer" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: /^Good/ }).click();
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(page.getByLabel("New cards per day")).toHaveValue("3");
  }
  await page.screenshot({
    path: `test-results/${browserName}-progress.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("home layout fits a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start with Hangul" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-small.png",
    fullPage: true,
  });
});
