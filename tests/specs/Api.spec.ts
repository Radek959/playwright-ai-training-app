import { test, expect } from '@playwright/test';
import { taskData } from '../data/TaskData';
import { helperUrls, getFakeUser } from '../utils/helpers.ts';

test.describe('api should work correctly', () => {
    test.describe('tasks endpoints should work correctly', () => {
        test('should fetch list of tasks', async ({ request }) => {
            const response = await request.get(`${helperUrls.api}/tasks`);

            expect(response.status()).toBe(200);
            
            const tasks = await response.json();
            expect(tasks.length).toBeGreaterThan(0);
            for (const task of tasks) {
                expect(task).toHaveProperty('id');
                expect(task).toHaveProperty('title');
                expect(task).toHaveProperty('description');
                expect(task).toHaveProperty('status');
                expect(task).toHaveProperty('priority');
                expect(task).toHaveProperty('dueDate');
                expect(task).toHaveProperty('assigneeId');
            }
        });

        test('should create a new task', async ({ request }) => {
            const response = await request.post(`${helperUrls.api}/tasks`, { data: taskData.apiTask });
            expect(response.status()).toBe(201);

            const created = await response.json();
            try {
                expect(created.title).toBe(taskData.apiTask.title);
                expect(created.description).toBe(taskData.apiTask.description);
                expect(created.status).toBe(taskData.apiTask.status);
                expect(created.priority).toBe(taskData.apiTask.priority);
                expect(created.assigneeId).toBe(taskData.apiTask.assigneeId);
            } finally {
                await request.delete(`${helperUrls.api}/tasks/${created.id}`);
            }
            
        });
    });

    test.describe('users endpoints should work correctly', () => {
        test('should list all users and verify schema', async ({ request }) => {
            const response = await request.get(`${helperUrls.api}/users`);

            expect(response.ok(), 'GET /users should return 2xx').toBeTruthy();
            const users = await response.json();

            for (const user of users) {
                expect(user).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    role: expect.stringMatching(/^(admin|editor|viewer)$/) 
                });
            }
        });

        test('should create a new user with random data', async ({ request }) => {
            const newUser = getFakeUser();
            
            const response = await request.post(`${helperUrls.api}/users`, {
                data: newUser
            });

            expect(response.status()).toBe(201);
            const body = await response.json();

            expect(body.name).toBe(newUser.name);
            expect(body.email).toBe(newUser.email);
            expect(body.role).toBe(newUser.role);
        });
    });

    test.describe('workflow should work correctly', () => {
        test('should handle full task lifecycle', async ({ request }) => {
            // Create a new task
            const createResponse = await request.post(`${helperUrls.api}/tasks`, { data: taskData.apiTask });
            expect(createResponse.status(), 'Create task should return 201').toBe(201);

            const createdTask = await createResponse.json();
                expect(createdTask).toMatchObject({
                id: expect.any(String),
                status: taskData.apiTask.status,
            });
            const taskId = createdTask.id;

            // Update the task's status to in-progress
            const updateResponse = await request.put(`${helperUrls.api}/tasks/${taskId}`, {
                data: { status: 'in-progress' }
            });
            expect(updateResponse.status(), 'Update should return 200').toBe(200);
            const updated = await updateResponse.json();
            expect(updated.status).toBe('in-progress');

            const deleteResponse = await request.delete(`${helperUrls.api}/tasks/${taskId}`);
            expect(deleteResponse.status(), 'Delete should return 204').toBe(204);

            const getAfterDelete = await request.get(`${helperUrls.api}/tasks/${taskId}`);
            expect(getAfterDelete.status(), 'Deleted task should not be fetchable').toBe(404);
        });
    });

});