import { test, expect } from "@playwright/test";
import { createTask, deleteTask } from "./helpers";

test("smoke: navigate dashboard and verify startup data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByText("Welcome back! Here's what's happening today."),
  ).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tasks" })
    .click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();

  await page.getByRole("tab", { name: "Table" }).click();
  await expect(page).toHaveURL(/tab=table/);
  await expect(
    page.getByRole("button", {
      name: "Edit title: Implement user authentication",
    }),
  ).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Users" })
    .click();
  await expect(page).toHaveURL("/users");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("task created via API is visible in UI and removed afterwards", async ({
  page,
  request,
}) => {
  const task = await createTask(request, {
    title: `Task for data strategy ${Date.now()}`,
  });

  try {
    await page.goto("/tasks?tab=table");
    await expect(
      page.getByRole("button", { name: `Edit title: ${task.title}` }),
    ).toBeVisible();
  } finally {
    await deleteTask(request, task.id);
  }

  expect((await request.get(`/api/tasks/${task.id}`)).status()).toBe(404);
});
