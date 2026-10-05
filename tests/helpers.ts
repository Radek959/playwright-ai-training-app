import { expect, APIRequestContext } from "@playwright/test";

export async function createTask(
  request: APIRequestContext,
  overrides?: Record<string, unknown>,
) {
  const response = await request.post("/api/tasks", {
    data: {
      title: `Test Task ${Date.now()}`,
      description: "Created by Playwright test",
      status: "todo",
      priority: "medium",
      ...overrides,
    },
  });

  expect(response.status()).toBe(201);
  return response.json();
}

export async function deleteTask(request: APIRequestContext, taskId: string) {
  const response = await request.delete(`/api/tasks/${taskId}`);
  expect([204, 404]).toContain(response.status());
}
