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
        title: "New Integration Test Task"
      };

      const response = await request(app).post("/api/tasks").send(payload);
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe("New Integration Test Task");
      
      // Verify default values
      expect(response.body.status).toBe("todo");
      expect(response.body.priority).toBe("medium");
      expect(response.body.tags).toEqual([]);
      expect(response.body.dependencies).toEqual([]);
      expect(response.body.requiresApproval).toBe(false);
      
      const fetchRes = await request(app).get(`/api/tasks/${response.body.id}`);
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.status).toBe("todo");
      expect(fetchRes.body.priority).toBe("medium");
      expect(fetchRes.body.tags).toEqual([]);
      expect(fetchRes.body.dependencies).toEqual([]);
      expect(fetchRes.body.requiresApproval).toBe(false);
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
      // First create a task with a very unique title
      const uniqueTitle = "SuperUniqueSearchTerm12345";
      const createRes = await request(app).post("/api/tasks").send({ title: uniqueTitle });
      const createdTaskId = createRes.body.id;

      // Search for the unique title (case insensitive)
      const response = await request(app).get(`/api/tasks/search?q=${uniqueTitle.toLowerCase()}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(createdTaskId);
      
      // Search for something that shouldn't exist
      const emptyRes = await request(app).get("/api/tasks/search?q=DefinitelyNonExistent123");
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body).toEqual([]);
    });

    it("deletes a task and removes its ID from dependencies of all other tasks", async () => {
      // Create a base task
      const baseRes = await request(app).post("/api/tasks").send({ title: "Base Task" });
      const baseTaskId = baseRes.body.id;

      // Create two dependent tasks
      const dep1Res = await request(app).post("/api/tasks").send({ title: "Dep 1" });
      await request(app).put(`/api/tasks/${dep1Res.body.id}`).send({ dependencies: [baseTaskId] });
      
      const dep2Res = await request(app).post("/api/tasks").send({ title: "Dep 2" });
      await request(app).put(`/api/tasks/${dep2Res.body.id}`).send({ dependencies: [baseTaskId] });

      // Delete the base task
      const deleteRes = await request(app).delete(`/api/tasks/${baseTaskId}`);
      expect(deleteRes.status).toBe(204);
      
      // Verify both dependents no longer have the base task in their dependencies
      const fetchDep1 = await request(app).get(`/api/tasks/${dep1Res.body.id}`);
      expect(fetchDep1.body.dependencies).not.toContain(baseTaskId);
      expect(fetchDep1.body.dependencies).toEqual([]);
      
      const fetchDep2 = await request(app).get(`/api/tasks/${dep2Res.body.id}`);
      expect(fetchDep2.body.dependencies).not.toContain(baseTaskId);
      expect(fetchDep2.body.dependencies).toEqual([]);
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
      
      // Assign them to two completed tasks
      const doneTasks = tasks.filter(t => t.status === "done").slice(0, 2);
      expect(doneTasks.length).toBeGreaterThanOrEqual(2);
      
      await request(app).put(`/api/tasks/${doneTasks[0].id}`).send({ assigneeId: newUserId });
      await request(app).put(`/api/tasks/${doneTasks[1].id}`).send({ assigneeId: newUserId });
      
      // Delete the user
      const deleteRes = await request(app).delete(`/api/users/${newUserId}`);
      expect(deleteRes.status).toBe(204);
      
      // Check both tasks no longer have them assigned
      const taskRes1 = await request(app).get(`/api/tasks/${doneTasks[0].id}`);
      expect(taskRes1.body.assigneeId).toBeUndefined();
      
      const taskRes2 = await request(app).get(`/api/tasks/${doneTasks[1].id}`);
      expect(taskRes2.body.assigneeId).toBeUndefined();
    });
    
    it("returns 404 for non-existent user", async () => {
      const response = await request(app).delete("/api/users/non-existent-id");
      expect(response.status).toBe(404);
    });
  });
});
