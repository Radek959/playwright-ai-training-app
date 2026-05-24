import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

const appBaseUrl = "http://localhost:5173";

test.describe("Tasks accessibility", () => {
  test("should run full Axe scan for /tasks with wcag2a and wcag2aa tags and save report", async ({ page }, testInfo) => {
    await test.step("Navigate to /tasks", async () => {
      await page.goto(`${appBaseUrl}/tasks`);
      await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    });

    const results = await test.step("Run full Axe accessibility scan", async () => {
      return new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
    });

    await test.step("Save Axe report to a file", async () => {
      const reportPath = testInfo.outputPath("tasks-axe-wcag2a-wcag2aa-report.json");
      await writeFile(reportPath, JSON.stringify(results, null, 2), "utf-8");

      await testInfo.attach("tasks-axe-wcag2a-wcag2aa-report", {
        path: reportPath,
        contentType: "application/json",
      });

      expect(reportPath).toContain("tasks-axe-wcag2a-wcag2aa-report.json");
    });
  });
});
