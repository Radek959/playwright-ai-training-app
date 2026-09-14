import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { tasks, users, comments, Task, User, Comment } from "./data.js";

let initialTasks: Task[];
let initialUsers: User[];
let initialComments: Comment[];

beforeAll(() => {
  initialTasks = JSON.parse(JSON.stringify(tasks));
  initialUsers = JSON.parse(JSON.stringify(users));
  initialComments = JSON.parse(JSON.stringify(comments));
});

beforeEach(() => {
  tasks.length = 0;
  tasks.push(...JSON.parse(JSON.stringify(initialTasks)));
  users.length = 0;
  users.push(...JSON.parse(JSON.stringify(initialUsers)));
  comments.length = 0;
  comments.push(...JSON.parse(JSON.stringify(initialComments)));
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

    it("clears nullable fields on PUT when null is sent, and array fields when [] is sent", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({
          title: "Task with everything set",
          priority: "medium",
          taskType: "bug",
          severity: "critical",
          estimatedHours: 8,
          description: "Some description",
          dueDate: "2026-05-01T00:00:00.000Z",
          assigneeId: users[0].id,
          tags: ["backend"],
          dependencies: [tasks[0].id],
          requiresApproval: true,
          approver: "manager-a"
        });
      expect(created.status).toBe(201);

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}`)
        .send({
          taskType: null,
          severity: null,
          estimatedHours: null,
          description: null,
          dueDate: null,
          assigneeId: null,
          tags: [],
          dependencies: [],
          requiresApproval: false,
          approver: null
        });

      expect(response.status).toBe(200);
      expect(response.body.taskType).toBeUndefined();
      expect(response.body.severity).toBeUndefined();
      expect(response.body.estimatedHours).toBeUndefined();
      expect(response.body.description).toBeUndefined();
      expect(response.body.dueDate).toBeUndefined();
      expect(response.body.assigneeId).toBeUndefined();
      expect(response.body.approver).toBeUndefined();
      expect(response.body.requiresApproval).toBe(false);
      expect(response.body.tags).toEqual([]);
      expect(response.body.dependencies).toEqual([]);
      // Untouched fields survive the patch.
      expect(response.body.title).toBe("Task with everything set");
      expect(response.body.priority).toBe("medium");
    });

    it("rejects moving a bug away from its severity without also clearing the taskType", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "A bug to fix", taskType: "bug", severity: "major" });
      expect(created.status).toBe(201);

      // severity alone is not enough: the merged task is still a bug.
      const rejected = await request(app).put(`/api/tasks/${created.body.id}`).send({ severity: null });
      expect(rejected.status).toBe(400);
      expect(rejected.body.details).toContainEqual({ field: "severity", message: "bug tasks require a severity" });

      // Sending both, as the edit form does, is accepted.
      const accepted = await request(app)
        .put(`/api/tasks/${created.body.id}`)
        .send({ taskType: "feature", severity: null });
      expect(accepted.status).toBe(200);
      expect(accepted.body.severity).toBeUndefined();
      expect(accepted.body.taskType).toBe("feature");
    });

    it("does not require conditional values to be cleared: a leftover severity/approver is accepted", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "A bug to reclassify", taskType: "bug", severity: "major", requiresApproval: true, approver: "manager-a" });
      expect(created.status).toBe(201);

      // Changing the type alone — without severity: null — is accepted, and
      // the severity simply stays on the (now non-bug) task.
      const retyped = await request(app).put(`/api/tasks/${created.body.id}`).send({ taskType: "feature" });
      expect(retyped.status).toBe(200);
      expect(retyped.body.taskType).toBe("feature");
      expect(retyped.body.severity).toBe("major");

      // Likewise, turning approval off alone — without approver: null — is
      // accepted, and the approver stays stored.
      const unapproved = await request(app).put(`/api/tasks/${created.body.id}`).send({ requiresApproval: false });
      expect(unapproved.status).toBe(200);
      expect(unapproved.body.requiresApproval).toBe(false);
      expect(unapproved.body.approver).toBe("manager-a");

      // And such a task can still be created directly.
      const createdLoose = await request(app)
        .post("/api/tasks")
        .send({ title: "Feature with a severity", taskType: "feature", severity: "minor", requiresApproval: false, approver: "manager-b" });
      expect(createdLoose.status).toBe(201);
      expect(createdLoose.body.severity).toBe("minor");
      expect(createdLoose.body.approver).toBe("manager-b");
    });

    it("creates a task with no assigneeId (an unassigned task is valid)", async () => {
      const response = await request(app).post("/api/tasks").send({ title: "Nobody owns this yet" });
      expect(response.status).toBe(201);
      expect(response.body.assigneeId).toBeUndefined();
    });

    it("accepts a fractional positive estimatedHours and rejects zero or negative values", async () => {
      const accepted = await request(app)
        .post("/api/tasks")
        .send({ title: "Half an hour of work", estimatedHours: 0.5 });
      expect(accepted.status).toBe(201);
      expect(accepted.body.estimatedHours).toBe(0.5);

      for (const invalid of [0, -1]) {
        const rejected = await request(app)
          .put(`/api/tasks/${accepted.body.id}`)
          .send({ estimatedHours: invalid });
        expect(rejected.status).toBe(400);
        expect(rejected.body.details).toContainEqual({
          field: "estimatedHours",
          message: "estimatedHours must be a positive number"
        });
      }

      // Research is the one type that needs a full hour, not just any
      // positive value.
      const research = await request(app)
        .put(`/api/tasks/${accepted.body.id}`)
        .send({ taskType: "research" });
      expect(research.status).toBe(400);
      expect(research.body.details).toContainEqual({
        field: "estimatedHours",
        message: "research tasks require estimatedHours >= 1"
      });
    });

    it("rejects a dependency on the task itself", async () => {
      const task = tasks[0];
      const response = await request(app).put(`/api/tasks/${task.id}`).send({ dependencies: [task.id] });
      expect(response.status).toBe(400);
      expect(response.body.details).toContainEqual({
        field: "dependencies",
        message: `unknown dependency ids: ${task.id}`
      });
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

  describe("Task dependency completion rule", () => {
    it("creates a done task with no dependencies", async () => {
      const response = await request(app).post("/api/tasks").send({ title: "No deps task", status: "done" });
      expect(response.status).toBe(201);
      expect(response.body.status).toBe("done");
      expect(response.body.completedAt).toBeDefined();
    });

    it("creates a done task when all dependencies are already done", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Dependency one", status: "done" });
      expect(dep.status).toBe(201);

      const response = await request(app)
        .post("/api/tasks")
        .send({ title: "Done task with done dep", status: "done", dependencies: [dep.body.id] });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("done");
    });

    it("returns 409 when creating a done task with an active dependency", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Active dependency", status: "todo" });
      expect(dep.status).toBe(201);

      const response = await request(app)
        .post("/api/tasks")
        .send({ title: "Blocked done task", status: "done", dependencies: [dep.body.id] });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Cannot complete task with incomplete dependencies");
      expect(response.body.blockingDependencies).toEqual([
        { id: dep.body.id, title: "Active dependency", status: "todo" }
      ]);

      // The task must not have been created.
      const search = await request(app).get(`/api/tasks/search?q=Blocked done task`);
      expect(search.body).toEqual([]);
    });

    it("returns 409 when updating an existing task's status to done with an active dependency", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Still in progress", status: "in-progress" });
      const task = await request(app)
        .post("/api/tasks")
        .send({ title: "Task to complete", status: "todo", dependencies: [dep.body.id] });

      const response = await request(app).put(`/api/tasks/${task.body.id}`).send({ status: "done" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Cannot complete task with incomplete dependencies");
      expect(response.body.blockingDependencies).toEqual([
        { id: dep.body.id, title: "Still in progress", status: "in-progress" }
      ]);
    });

    it("reports every blocking dependency and omits the ones already done", async () => {
      const doneDep = await request(app).post("/api/tasks").send({ title: "Already done", status: "done" });
      const todoDep = await request(app).post("/api/tasks").send({ title: "Still todo", status: "todo" });
      const inProgressDep = await request(app).post("/api/tasks").send({ title: "Still in progress", status: "in-progress" });

      const response = await request(app)
        .post("/api/tasks")
        .send({
          title: "Task with mixed deps",
          status: "done",
          dependencies: [doneDep.body.id, todoDep.body.id, inProgressDep.body.id]
        });

      expect(response.status).toBe(409);
      expect(response.body.blockingDependencies).toEqual([
        { id: todoDep.body.id, title: "Still todo", status: "todo" },
        { id: inProgressDep.body.id, title: "Still in progress", status: "in-progress" }
      ]);
    });

    it("does not change status or completedAt when a PUT is rejected for incomplete dependencies", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Blocking dep", status: "todo" });
      const task = await request(app)
        .post("/api/tasks")
        .send({ title: "Task that stays todo", status: "todo", dependencies: [dep.body.id] });

      const response = await request(app).put(`/api/tasks/${task.body.id}`).send({ status: "done" });
      expect(response.status).toBe(409);

      const fetched = await request(app).get(`/api/tasks/${task.body.id}`);
      expect(fetched.body.status).toBe("todo");
      expect(fetched.body.completedAt).toBeUndefined();
    });

    it("allows completing a task once its dependency is completed first", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Dependency to finish", status: "todo" });
      const task = await request(app)
        .post("/api/tasks")
        .send({ title: "Waiting on dependency", status: "todo", dependencies: [dep.body.id] });

      const blocked = await request(app).put(`/api/tasks/${task.body.id}`).send({ status: "done" });
      expect(blocked.status).toBe(409);

      const completeDep = await request(app).put(`/api/tasks/${dep.body.id}`).send({ status: "done" });
      expect(completeDep.status).toBe(200);

      const retry = await request(app).put(`/api/tasks/${task.body.id}`).send({ status: "done" });
      expect(retry.status).toBe(200);
      expect(retry.body.status).toBe("done");
      expect(retry.body.completedAt).toBeDefined();
    });

    it("rejects adding an active dependency to a task that remains done", async () => {
      const doneTask = await request(app).post("/api/tasks").send({ title: "Already completed", status: "done" });
      const activeDep = await request(app).post("/api/tasks").send({ title: "Not yet done", status: "in-progress" });

      const response = await request(app)
        .put(`/api/tasks/${doneTask.body.id}`)
        .send({ dependencies: [activeDep.body.id] });

      expect(response.status).toBe(409);
      expect(response.body.blockingDependencies).toEqual([
        { id: activeDep.body.id, title: "Not yet done", status: "in-progress" }
      ]);

      const fetched = await request(app).get(`/api/tasks/${doneTask.body.id}`);
      expect(fetched.body.dependencies ?? []).toEqual([]);
    });

    it("allows a normal update of an already-done task that keeps it valid", async () => {
      const doneTask = await request(app).post("/api/tasks").send({ title: "Completed task", status: "done" });

      const response = await request(app)
        .put(`/api/tasks/${doneTask.body.id}`)
        .send({ title: "Completed task, renamed" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("done");
      expect(response.body.title).toBe("Completed task, renamed");
    });
  });

  describe("Approval workflow", () => {
    it("creating a task with requiresApproval starts it pending", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .send({ title: "Needs approval", requiresApproval: true, approver: "manager-a" });
      expect(response.status).toBe(201);
      expect(response.body.approvalStatus).toBe("pending");
      expect(response.body.approvalComment).toBeUndefined();
      expect(response.body.approvalDecidedAt).toBeUndefined();
    });

    it("a task with requiresApproval false has no approval-process fields", async () => {
      const response = await request(app).post("/api/tasks").send({ title: "No approval needed" });
      expect(response.status).toBe(201);
      expect(response.body.approvalStatus).toBeUndefined();
    });

    it("enabling requiresApproval via PUT starts a pending process", async () => {
      const created = await request(app).post("/api/tasks").send({ title: "Not yet gated" });
      const response = await request(app)
        .put(`/api/tasks/${created.body.id}`)
        .send({ requiresApproval: true, approver: "manager-b" });
      expect(response.status).toBe(200);
      expect(response.body.approvalStatus).toBe("pending");
    });

    it("disabling requiresApproval via PUT clears the approval-process fields", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Gated task", requiresApproval: true, approver: "manager-a" });
      expect(created.body.approvalStatus).toBe("pending");

      const approve = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "fine" });
      expect(approve.status).toBe(200);

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ requiresApproval: false });
      expect(response.status).toBe(200);
      expect(response.body.approvalStatus).toBeUndefined();
      expect(response.body.approvalComment).toBeUndefined();
      expect(response.body.approvalDecidedAt).toBeUndefined();
    });

    it("plain PUT cannot set approval-process fields directly", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Gated task", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}`)
        .send({ approvalStatus: "approved" });
      expect(response.status).toBe(400);
      expect(response.body.details).toContainEqual({
        field: "approvalStatus",
        message: "approvalStatus is not an updatable field"
      });

      const fetched = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(fetched.body.approvalStatus).toBe("pending");
    });

    it("approves a pending task", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Approve me", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "Looks good." });

      expect(response.status).toBe(200);
      expect(response.body.approvalStatus).toBe("approved");
      expect(response.body.approvalComment).toBe("Looks good.");
      expect(response.body.approvalDecidedAt).toBeDefined();
    });

    it("rejects a pending task without a comment", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Reject me", requiresApproval: true, approver: "manager-a" });

      const response = await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "rejected" });

      expect(response.status).toBe(200);
      expect(response.body.approvalStatus).toBe("rejected");
      expect(response.body.approvalComment).toBeUndefined();
    });

    it("treats a whitespace-only comment as no comment", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Whitespace comment", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "   " });

      expect(response.status).toBe(200);
      expect(response.body.approvalComment).toBeUndefined();
    });

    it("rejects a comment longer than 500 characters", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Too long comment", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "x".repeat(501) });

      expect(response.status).toBe(400);
      expect(response.body.details).toContainEqual({
        field: "comment",
        message: "comment must be at most 500 characters"
      });
    });

    it("returns 400 for comment: null, and leaves the approval state unchanged", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Null comment", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toContainEqual({
        field: "comment",
        message: "comment must be a string"
      });

      const fetched = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(fetched.body.approvalStatus).toBe("pending");
      expect(fetched.body.approvalComment).toBeUndefined();
      expect(fetched.body.approvalDecidedAt).toBeUndefined();
    });

    it("returns 400 for an unknown decision value", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Bad decision", requiresApproval: true, approver: "manager-a" });

      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "maybe" });

      expect(response.status).toBe(400);
      expect(response.body.details).toContainEqual({
        field: "decision",
        message: "decision must be 'approved' or 'rejected'"
      });
    });

    it("returns 404 for a non-existent task", async () => {
      const response = await request(app).put("/api/tasks/non-existent-id/approval").send({ decision: "approved" });
      expect(response.status).toBe(404);
    });

    it("returns 409 when the task does not require approval", async () => {
      const created = await request(app).post("/api/tasks").send({ title: "No approval needed" });
      const response = await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved" });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Task does not require approval");
    });

    it("repeating the identical decision is idempotent: 200, no decidedAt change", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Repeat decision", requiresApproval: true, approver: "manager-a" });

      const first = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "Great." });
      expect(first.status).toBe(200);
      const firstDecidedAt = first.body.approvalDecidedAt;

      const second = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "Great." });
      expect(second.status).toBe(200);
      expect(second.body.approvalDecidedAt).toBe(firstDecidedAt);
    });

    it("overwriting a terminal decision with a different decision returns 409 with current approval state", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Locked decision", requiresApproval: true, approver: "manager-a" });

      const first = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "Looks good." });
      expect(first.status).toBe(200);

      const second = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "rejected" });

      expect(second.status).toBe(409);
      expect(second.body.error).toBe("Approval decision conflict");
      expect(second.body.currentApproval.status).toBe("approved");
      expect(second.body.currentApproval.comment).toBe("Looks good.");
      expect(second.body.currentApproval.decidedAt).toBeDefined();

      // Nothing was mutated by the rejected overwrite attempt.
      const fetched = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(fetched.body.approvalStatus).toBe("approved");
      expect(fetched.body.approvalComment).toBe("Looks good.");
    });

    it("overwriting a terminal decision with a different comment (same decision) also returns 409", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Locked comment", requiresApproval: true, approver: "manager-a" });

      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved", comment: "First." });
      const response = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "approved", comment: "Second." });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Approval decision conflict");
    });

    it("resets an approved task back to pending after a significant edit", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Reset me", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved", comment: "ok" });

      const edited = await request(app).put(`/api/tasks/${created.body.id}`).send({ title: "Reset me, renamed" });

      expect(edited.status).toBe(200);
      expect(edited.body.approvalStatus).toBe("pending");
      expect(edited.body.approvalComment).toBeUndefined();
      expect(edited.body.approvalDecidedAt).toBeUndefined();
    });

    it("a significant edit of a completed, approved task atomically reopens it", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Ship the feature", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved", comment: "ok" });
      const done = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });
      expect(done.status).toBe(200);
      expect(done.body.status).toBe("done");

      const edited = await request(app)
        .put(`/api/tasks/${created.body.id}`)
        .send({ title: "Ship the redesigned feature" });

      expect(edited.status).toBe(200);
      expect(edited.body.title).toBe("Ship the redesigned feature");
      expect(edited.body.status).toBe("in-progress");
      expect(edited.body.approvalStatus).toBe("pending");
      expect(edited.body.approvalComment).toBeUndefined();
      expect(edited.body.approvalDecidedAt).toBeUndefined();
      expect(edited.body.completedAt).toBeUndefined();

      const fetched = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(fetched.body.status).toBe("in-progress");
      expect(fetched.body.approvalStatus).toBe("pending");
    });

    it("a no-op PUT on a completed, approved task leaves it completed and approved", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Stay completed", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved", comment: "ok" });
      const done = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });
      expect(done.status).toBe(200);
      const completedAt = done.body.completedAt;
      expect(completedAt).toBeDefined();

      const noop = await request(app).put(`/api/tasks/${created.body.id}`).send({ title: "Stay completed" });

      expect(noop.status).toBe(200);
      expect(noop.body.status).toBe("done");
      expect(noop.body.approvalStatus).toBe("approved");
      expect(noop.body.completedAt).toBe(completedAt);
    });

    it("does not reset approval on a no-op payload (same values resent)", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Stay approved", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved" });

      const noop = await request(app).put(`/api/tasks/${created.body.id}`).send({ title: "Stay approved" });

      expect(noop.status).toBe(200);
      expect(noop.body.approvalStatus).toBe("approved");
    });

    it("does not reset approval on a plain status change alone", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Status only", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved" });

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "in-progress" });

      expect(response.status).toBe(200);
      expect(response.body.approvalStatus).toBe("approved");
    });

    it("blocks completing a task while approval is pending", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Pending completion", requiresApproval: true, approver: "manager-a" });

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Cannot complete task without approval");
      expect(response.body.approvalBlocker).toEqual({ status: "pending", approver: "manager-a" });

      const fetched = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(fetched.body.status).not.toBe("done");
    });

    it("blocks completing a rejected task", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Rejected completion", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "rejected" });

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });

      expect(response.status).toBe(409);
      expect(response.body.approvalBlocker).toEqual({ status: "rejected", approver: "manager-a" });
    });

    it("allows completing an approved task", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Approved completion", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved" });

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("done");
      expect(response.body.completedAt).toBeDefined();
    });

    it("cannot bypass approval by creating a task directly with status done", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .send({ title: "Bypass attempt", status: "done", requiresApproval: true, approver: "manager-a" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Cannot complete task without approval");
      expect(response.body.approvalBlocker).toEqual({ status: "pending", approver: "manager-a" });
    });

    it("dependency-conflict behavior stays compatible alongside approval (dependency check still applies)", async () => {
      const dep = await request(app).post("/api/tasks").send({ title: "Active dependency", status: "todo" });
      const created = await request(app)
        .post("/api/tasks")
        .send({
          title: "Gated with dependency",
          requiresApproval: true,
          approver: "manager-a",
          dependencies: [dep.body.id]
        });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved" });

      const response = await request(app).put(`/api/tasks/${created.body.id}`).send({ status: "done" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Cannot complete task with incomplete dependencies");
      expect(response.body.blockingDependencies).toEqual([{ id: dep.body.id, title: "Active dependency", status: "todo" }]);
    });

    it("atomicity: a rejected approval PUT leaves the task completely unchanged", async () => {
      const created = await request(app)
        .post("/api/tasks")
        .send({ title: "Atomic check", requiresApproval: true, approver: "manager-a" });
      await request(app).put(`/api/tasks/${created.body.id}/approval`).send({ decision: "approved", comment: "ok" });

      const before = await request(app).get(`/api/tasks/${created.body.id}`);

      const rejected = await request(app)
        .put(`/api/tasks/${created.body.id}/approval`)
        .send({ decision: "rejected", comment: "different" });
      expect(rejected.status).toBe(409);

      const after = await request(app).get(`/api/tasks/${created.body.id}`);
      expect(after.body).toEqual(before.body);
    });
  });

  describe("Users API", () => {
    it("fetches list of users", async () => {
      const response = await request(app).get("/api/users");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("fetches a single existing user", async () => {
      const existing = users[0];
      const response = await request(app).get(`/api/users/${existing.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(existing);
    });

    it("returns 404 with 'User not found' for a non-existent user", async () => {
      const response = await request(app).get("/api/users/non-existent-id");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "User not found" });
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

    it("returns the exact shape of conflictingTasks, including status, and omits done tasks", async () => {
      const userRes = await request(app).post("/api/users").send({
        name: "Conflict User",
        email: "conflict-user@example.com",
        role: "viewer"
      });
      const userId = userRes.body.id;

      const todoTask = await request(app).post("/api/tasks").send({ title: "Active todo task", assigneeId: userId });
      const inProgressTask = await request(app)
        .post("/api/tasks")
        .send({ title: "Active in-progress task", status: "in-progress", assigneeId: userId });
      const doneTask = await request(app)
        .post("/api/tasks")
        .send({ title: "Finished task", status: "done", assigneeId: userId });

      const deleteRes = await request(app).delete(`/api/users/${userId}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error).toBe("Cannot delete user with active tasks");
      expect(deleteRes.body.conflictingTasks).toHaveLength(2);
      expect(deleteRes.body.conflictingTasks).toEqual(
        expect.arrayContaining([
          { id: todoTask.body.id, title: "Active todo task", status: "todo" },
          { id: inProgressTask.body.id, title: "Active in-progress task", status: "in-progress" }
        ])
      );
      expect(
        deleteRes.body.conflictingTasks.some((t: { id: string }) => t.id === doneTask.body.id)
      ).toBe(false);

      // The user and their tasks must be left completely unchanged after a 409.
      const userAfter = await request(app).get(`/api/users/${userId}`);
      expect(userAfter.status).toBe(200);
      const todoAfter = await request(app).get(`/api/tasks/${todoTask.body.id}`);
      expect(todoAfter.body.assigneeId).toBe(userId);
      const inProgressAfter = await request(app).get(`/api/tasks/${inProgressTask.body.id}`);
      expect(inProgressAfter.body.assigneeId).toBe(userId);
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

      // The user is gone for good.
      const fetchDeleted = await request(app).get(`/api/users/${newUserId}`);
      expect(fetchDeleted.status).toBe(404);
      expect(fetchDeleted.body).toEqual({ error: "User not found" });

      // Deleting the same user again is a 404, not a repeat success.
      const secondDelete = await request(app).delete(`/api/users/${newUserId}`);
      expect(secondDelete.status).toBe(404);
      expect(secondDelete.body).toEqual({ error: "User not found" });
    });

    it("returns 404 for non-existent user", async () => {
      const response = await request(app).delete("/api/users/non-existent-id");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "User not found" });
    });
  });

  describe("Task Comments API", () => {
    describe("GET /api/tasks/:id/comments", () => {
      it("returns 404 for a non-existent task", async () => {
        const response = await request(app).get("/api/tasks/non-existent-id/comments");
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "not found" });
      });

      it("returns an empty array for a task with no comments", async () => {
        const task = tasks.find((t) => !comments.some((c) => c.taskId === t.id));
        expect(task).toBeDefined();
        const response = await request(app).get(`/api/tasks/${task!.id}/comments`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });

      it("lists comments oldest to newest", async () => {
        const response = await request(app).get("/api/tasks/t1/comments");
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].id).toBe("c1");
        expect(response.body[1].id).toBe("c2");
        expect(new Date(response.body[0].createdAt).getTime()).toBeLessThanOrEqual(
          new Date(response.body[1].createdAt).getTime()
        );
      });

      it("breaks ties on identical createdAt by id, for a deterministic order regardless of insertion order", async () => {
        const tiedTimestamp = "2026-01-01T00:00:00.000Z";
        comments.length = 0;
        comments.push(
          { id: "z-comment", taskId: "t3", content: "second alphabetically last", authorId: "u1", authorName: "Alice Johnson", createdAt: tiedTimestamp },
          { id: "a-comment", taskId: "t3", content: "first alphabetically", authorId: "u2", authorName: "Bob Smith", createdAt: tiedTimestamp }
        );
        const response = await request(app).get("/api/tasks/t3/comments");
        expect(response.status).toBe(200);
        expect(response.body.map((c: { id: string }) => c.id)).toEqual(["a-comment", "z-comment"]);
      });
    });

    describe("POST /api/tasks/:id/comments", () => {
      it("returns 404 for a non-existent task", async () => {
        const response = await request(app)
          .post("/api/tasks/non-existent-id/comments")
          .send({ authorId: "u1", content: "hello" });
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "not found" });
      });

      it("creates a comment and returns 201 with the full record", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "Looks good to me." });
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          taskId: "t3",
          content: "Looks good to me.",
          authorId: "u1",
          authorName: "Alice Johnson"
        });
        expect(typeof response.body.id).toBe("string");
        expect(response.body.id.length).toBeGreaterThan(0);
        expect(Number.isNaN(new Date(response.body.createdAt).getTime())).toBe(false);

        const fetchRes = await request(app).get("/api/tasks/t3/comments");
        expect(fetchRes.body).toHaveLength(1);
        expect(fetchRes.body[0].id).toBe(response.body.id);
      });

      it("ignores any client-supplied id/taskId/authorName/createdAt by rejecting the request outright", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "hi", id: "client-id" });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Validation failed");
        expect(response.body.details).toEqual([{ field: "id", message: "id is not a creatable field" }]);
      });

      it("rejects unknown fields with the offending field name, and does not create a comment", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "hi", extra: "nope" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "extra", message: "extra is not a creatable field" }]);

        const fetchRes = await request(app).get("/api/tasks/t3/comments");
        expect(fetchRes.body).toEqual([]);
      });

      it("rejects server-controlled fields even when the rest of the body is valid, naming each offending field", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "hi", authorName: "Someone Else", createdAt: "2020-01-01T00:00:00.000Z" });
        expect(response.status).toBe(400);
        const fields = response.body.details.map((d: { field: string }) => d.field).sort();
        expect(fields).toEqual(["authorName", "createdAt"]);
      });

      it("trims content before storing it", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "  padded content  " });
        expect(response.status).toBe(201);
        expect(response.body.content).toBe("padded content");
      });

      it("rejects a missing authorId", async () => {
        const response = await request(app).post("/api/tasks/t3/comments").send({ content: "hi" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "authorId", message: "authorId is required" }]);
      });

      it("rejects an empty/whitespace-only authorId", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "   ", content: "hi" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "authorId", message: "authorId is required" }]);
      });

      it("rejects an authorId with a non-string type", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: 42, content: "hi" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "authorId", message: "authorId is required" }]);
      });

      it("rejects an authorId that does not reference an existing user", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "no-such-user", content: "hi" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([
          { field: "authorId", message: "authorId does not reference an existing user" }
        ]);
      });

      it("rejects a missing content", async () => {
        const response = await request(app).post("/api/tasks/t3/comments").send({ authorId: "u1" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "content", message: "content is required" }]);
      });

      it("rejects a non-string content", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: 123 });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "content", message: "content must be a string" }]);
      });

      it("rejects an empty content", async () => {
        const response = await request(app).post("/api/tasks/t3/comments").send({ authorId: "u1", content: "" });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "content", message: "content is required" }]);
      });

      it("rejects a whitespace-only content", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: "   " });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([{ field: "content", message: "content is required" }]);
      });

      it("rejects content over 1000 characters after trim", async () => {
        const tooLong = `  ${"a".repeat(1001)}  `;
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: tooLong });
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual([
          { field: "content", message: "content must be at most 1000 characters" }
        ]);
      });

      it("accepts content at exactly 1000 characters after trim", async () => {
        const exactlyMax = `  ${"a".repeat(1000)}  `;
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "u1", content: exactlyMax });
        expect(response.status).toBe(201);
        expect(response.body.content).toHaveLength(1000);
      });

      it("rejects a malformed (non-object) body", async () => {
        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .set("Content-Type", "application/json")
          .send(JSON.stringify(["not", "an", "object"]));
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "Validation failed",
          details: [{ field: "body", message: "request body must be a JSON object" }]
        });
      });
    });

    describe("cascading deletes", () => {
      it("deleting a task removes all of its comments", async () => {
        const before = await request(app).get("/api/tasks/t1/comments");
        expect(before.body.length).toBeGreaterThan(0);

        const deleteRes = await request(app).delete("/api/tasks/t1");
        expect(deleteRes.status).toBe(204);

        // The comments are gone even though the task itself no longer exists
        // to ask about directly (a 404 there does not tell us about orphans),
        // so check the underlying store instead.
        expect(comments.some((c) => c.taskId === "t1")).toBe(false);
      });

      it("deleting a task's comments does not touch other tasks' comments", async () => {
        const deleteRes = await request(app).delete("/api/tasks/t1");
        expect(deleteRes.status).toBe(204);
        expect(comments.some((c) => c.taskId === "t2")).toBe(true);
      });

      it("deleting a user preserves their comments but clears authorId, keeping authorName", async () => {
        const commentBefore = comments.find((c) => c.id === "c1");
        expect(commentBefore?.authorId).toBe("u1");

        // Comment authorship is independent from task assignment, so clear
        // u1's active task assignments first (the standard active-tasks
        // guard, unrelated to comments, would otherwise block the delete).
        for (const t of tasks.filter((t) => t.assigneeId === "u1" && t.status !== "done")) {
          await request(app).put(`/api/tasks/${t.id}`).send({ assigneeId: null });
        }

        const deleteRes = await request(app).delete("/api/users/u1");
        expect(deleteRes.status).toBe(204);

        const fetchRes = await request(app).get("/api/tasks/t1/comments");
        expect(fetchRes.status).toBe(200);
        const preserved = fetchRes.body.find((c: { id: string }) => c.id === "c1");
        expect(preserved).toBeDefined();
        expect(preserved.authorId).toBeUndefined();
        expect(preserved.authorName).toBe("Alice Johnson");
      });
    });

    describe("atomicity", () => {
      it("does not create a partial comment when validation fails on multiple fields", async () => {
        const before = await request(app).get("/api/tasks/t3/comments");
        expect(before.body).toEqual([]);

        const response = await request(app)
          .post("/api/tasks/t3/comments")
          .send({ authorId: "no-such-user", content: "" });
        expect(response.status).toBe(400);

        const after = await request(app).get("/api/tasks/t3/comments");
        expect(after.body).toEqual([]);
      });
    });
  });
});
