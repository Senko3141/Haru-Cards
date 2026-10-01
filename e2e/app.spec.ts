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
  ).toBeEnabled();
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
    page.getByRole("heading", { name: "Your flashcards." }),
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
  await page.locator("input[type=file]").setInputFiles({
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
    await page
      .getByRole("button", { name: "Flashcards", exact: false })
      .click();
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

test("all paths and flashcards are open on first launch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /06 Words you can read/ }).click();
  await expect(
    page.getByRole("heading", { name: "Words you can read" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Flashcards", exact: false }).click();
  await page.getByLabel("Card collection").selectOption("words");
  await expect(
    page.getByRole("button", { name: "Reveal answer" }),
  ).toBeVisible();
  await expect(page.locator(".hangul")).toHaveText("나무");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("New cards per day").selectOption("0");
  await page.getByRole("button", { name: "Flashcards", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Reveal answer" }),
  ).toBeVisible();
});

test("appearance follows the device, persists overrides, and includes icons", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("Color theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("Color theme").selectOption("dark");
  await page.getByLabel("New cards per day").selectOption("10");
  await expect(page.getByLabel("Color theme")).toHaveValue("dark");
  await page.getByLabel("Color theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Flashcards", exact: false }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.screenshot({
    path: `test-results/dark-${test.info().project.name}.png`,
    fullPage: true,
  });
  for (const path of [
    "/logo.svg",
    "/favicon-32.png",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/icon-512.png",
  ]) {
    const response = await page.request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/");
  }
});
