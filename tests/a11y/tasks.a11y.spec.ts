import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("tasks nie ma naruszeń dostępności (WCAG A/AA)", async ({ page }) => {
  await page.goto("/tasks?tab=table");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Edit title: Implement user authentication",
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
