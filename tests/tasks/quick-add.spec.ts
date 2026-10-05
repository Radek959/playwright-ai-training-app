import { test, expect } from "@playwright/test";
import { deleteTask } from "../helpers";

test("tworzenie zadania przez Quick Add", async ({ page, request }) => {
  const taskTitle = `Quick Add Task ${Date.now()}`;
  await page.goto("/tasks");

  const quickAddButton = page.getByTestId("toggle-quick-form-btn");
  await expect(quickAddButton).toBeVisible();
  await expect(quickAddButton).toHaveAttribute("aria-expanded", "false");
  await expect(quickAddButton).toHaveText("Quick Add");

  await quickAddButton.click();
  await expect(quickAddButton).toHaveAttribute("aria-expanded", "true");
  await expect(quickAddButton).toHaveText("Hide Add");

  const quickAddForm = page.locator("#quick-add-form");
  await expect(quickAddForm).toBeVisible();

  const titleInput = page.locator("#quick-task-title");
  await titleInput.fill(taskTitle);

  const addButton = page.getByTestId("add-task-button");
  await addButton.click();

  const taskHeading = page.getByRole("heading", { name: taskTitle });
  await expect(taskHeading).toBeVisible();

  const tasksResponse = await request.get("/api/tasks");
  expect(tasksResponse.status()).toBe(200);
  const tasks = await tasksResponse.json();

  const createdTask = tasks.find(
    (t: Record<string, unknown>) => t.title === taskTitle,
  );
  expect(createdTask).toBeDefined();
  expect(createdTask.status).toBe("todo");
  expect(createdTask.priority).toBe("medium");
  expect(createdTask.taskType).toBeUndefined();
  expect(createdTask.tags).toEqual([]);
  expect(createdTask.dependencies).toEqual([]);
  expect(createdTask.requiresApproval).toBe(false);
  expect(createdTask.assigneeId).toBeUndefined();

  await expect(page).toHaveURL("/tasks");

  if (createdTask) {
    await deleteTask(request, createdTask.id);
  }
});
