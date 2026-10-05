import { test, expect } from "@playwright/test";
import { deleteTask } from "../helpers";

test("tworzenie zadania przez kreator New Task", async ({ page, request }) => {
  const taskTitle = `Wizard Task ${Date.now()}`;

  try {
    await page.goto("/tasks");
    await page.getByRole("button", { name: "New Task" }).click();

    const wizard = page.getByRole("dialog");
    await expect(wizard.getByRole("heading", { name: "Step 1: Basic information" })).toBeVisible();
    await wizard.getByLabel("Task title").fill(taskTitle);
    await wizard.getByLabel("Priority").selectOption("high");
    await wizard.getByRole("button", { name: "Next" }).click();

    await expect(wizard.getByRole("heading", { name: "Step 2: Assignment and details" })).toBeVisible();
    await expect(wizard.getByLabel("Assign to")).toHaveValue("");
    await wizard.getByLabel("Estimated time").fill("5");
    await wizard.getByRole("button", { name: "Next" }).click();

    await expect(wizard.getByRole("heading", { name: "Step 3: Summary" })).toBeVisible();
    const summary = wizard.getByTestId("wizard-summary");
    await expect(summary).toContainText(`Title: ${taskTitle}`);
    await expect(summary).toContainText("Priority: high");
    await expect(summary).toContainText("Estimated time: 5h");

    await wizard.getByRole("button", { name: "Create task" }).click();
    await expect(wizard).toBeHidden();

    await page.getByRole("tab", { name: "Grid View" }).click();
    await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

    const response = await request.get("/api/tasks");
    expect(response.status()).toBe(200);
    const tasks: Record<string, unknown>[] = await response.json();
    const created = tasks.find((t) => t.title === taskTitle);
    expect(created).toBeDefined();
    expect(created).toMatchObject({
      title: taskTitle,
      priority: "high",
      estimatedHours: 5,
      taskType: "feature",
    });
    expect(created?.assigneeId).toBeUndefined();
  } finally {
    const response = await request.get("/api/tasks");
    const tasks: { id: string; title: string }[] = await response.json();
    for (const task of tasks.filter((t) => t.title === taskTitle)) {
      await deleteTask(request, task.id);
    }
  }
});
