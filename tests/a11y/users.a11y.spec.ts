import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("users nie ma naruszeń dostępności (WCAG A/AA)", async ({ page }) => {
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByText("Loading users...")).toBeHidden();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
