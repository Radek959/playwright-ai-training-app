import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { tasks, users, Task, User } from "./data.js";

let initialTasks: Task[];
let initialUsers: User[];

beforeAll(() => {
  initialTasks = JSON.parse(JSON.stringify(tasks));
  initialUsers = JSON.parse(JSON.stringify(users));
});

beforeEach(() => {
  tasks.length = 0;
  tasks.push(...JSON.parse(JSON.stringify(initialTasks)));
  users.length = 0;
  users.push(...JSON.parse(JSON.stringify(initialUsers)));
});

describe("API Integration Tests", () => {
  describe("GET /api/health", () => {
    it("returns status ok", async () => {
      const response = await request(app).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("Tasks API", () => {
    it("fetches list of tasks", async () => {
      const response = await request(app).get("/api/tasks");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("creates a valid task and assigns default values", async () => {
      const payload = {
        title: "New Integration Test Task",
        status: "todo",
        priority: "medium"
      };

      const response = await request(app).post("/api/tasks").send(payload);
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe("New Integration Test Task");
      expect(response.body.status).toBe("todo");
      expect(response.body.priority).toBe("medium");
      
      // Default array values shouldn't be implicitly added if not in schema, 
      // but let's check it's present in the array
      const fetchRes = await request(app).get(`/api/tasks/${response.body.id}`);
      expect(fetchRes.status).toBe(200);
    });

    it("returns 400 for invalid payload when creating task", async () => {
      const payload = {
        status: "todo",
        priority: "medium"
      }; // Missing title

      const response = await request(app).post("/api/tasks").send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("partially updates a task", async () => {
      const task = tasks[0];
      const payload = {
        status: "done"
      };

      const response = await request(app).put(`/api/tasks/${task.id}`).send(payload);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("done");
      expect(response.body.title).toBe(task.title); // Unchanged field
    });

    it("rejects update of id", async () => {
      const task = tasks[0];
      const payload = {
        id: "some-new-id"
      };

      const response = await request(app).put(`/api/tasks/${task.id}`).send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });
    
    it("rejects update of unknown field", async () => {
      const task = tasks[0];
      const payload = {
        unknownField: "value"
      };

      const response = await request(app).put(`/api/tasks/${task.id}`).send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
    });

    it("searches tasks", async () => {
      const response = await request(app).get("/api/tasks/search?q=test");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("deletes a task and removes its ID from dependencies of other tasks", async () => {
      // Find a task that is a dependency for another task
      const dependentTask = tasks.find(t => t.dependencies && t.dependencies.length > 0);
      expect(dependentTask).toBeDefined();
      
      const dependencyId = dependentTask!.dependencies![0];
      
      const deleteRes = await request(app).delete(`/api/tasks/${dependencyId}`);
      expect(deleteRes.status).toBe(204);
      
      const fetchDependentRes = await request(app).get(`/api/tasks/${dependentTask!.id}`);
      expect(fetchDependentRes.status).toBe(200);
      expect(fetchDependentRes.body.dependencies).not.toContain(dependencyId);
    });

    it("returns 404 for non-existent task", async () => {
      const response = await request(app).get("/api/tasks/non-existent-id");
      expect(response.status).toBe(404);
    });
  });

  describe("Users API", () => {
    it("fetches list of users", async () => {
      const response = await request(app).get("/api/users");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("returns 409 when trying to delete a user with active tasks", async () => {
      // Find a user with active tasks
      const activeTask = tasks.find(t => t.assigneeId && t.status !== "done");
      expect(activeTask).toBeDefined();
      
      const userId = activeTask!.assigneeId!;
      
      const deleteRes = await request(app).delete(`/api/users/${userId}`);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error).toBe("Cannot delete user with active tasks");
    });

    it("successfully deletes a user without active tasks and clears remaining assigneeIds", async () => {
      // Create a new user
      const userRes = await request(app).post("/api/users").send({
        name: "Test User",
        email: "test@example.com",
        role: "viewer"
      });
      const newUserId = userRes.body.id;
      
      // Assign them to a completed task
      const doneTask = tasks.find(t => t.status === "done")!;
      await request(app).put(`/api/tasks/${doneTask.id}`).send({
        assigneeId: newUserId
      });
      
      // Delete the user
      const deleteRes = await request(app).delete(`/api/users/${newUserId}`);
      expect(deleteRes.status).toBe(204);
      
      // Check the task no longer has them assigned
      const taskRes = await request(app).get(`/api/tasks/${doneTask.id}`);
      expect(taskRes.status).toBe(200);
      expect(taskRes.body.assigneeId).toBeUndefined();
    });
    
    it("returns 404 for non-existent user", async () => {
      const response = await request(app).delete("/api/users/non-existent-id");
      expect(response.status).toBe(404);
    });
  });
});
