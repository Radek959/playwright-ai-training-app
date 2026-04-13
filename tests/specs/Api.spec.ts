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
            expect(tasks[0]).toHaveProperty('id');
            expect(tasks[0]).toHaveProperty('title');
            expect(tasks[0]).toHaveProperty('description');
            expect(tasks[0]).toHaveProperty('status');
            expect(tasks[0]).toHaveProperty('priority');
            expect(tasks[0]).toHaveProperty('dueDate');
            expect(tasks[0]).toHaveProperty('assigneeId');
            
        });

        test('should create a new task', async ({ request }) => {
            const response = await request.post(`${helperUrls.api}/tasks`, { data: taskData.apiTask });
            expect(response.status()).toBe(201);
            
            const body = await response.json();
            expect(body.title).toBe(taskData.apiTask.title);
            expect(body.description).toBe(taskData.apiTask.description);
            expect(body.status).toBe(taskData.apiTask.status);
            expect(body.priority).toBe(taskData.apiTask.priority);
            expect(body.assigneeId).toBe(taskData.apiTask.assigneeId);
        });
    });

    test.describe('users endpoints should work correctly', () => {
        test('should list all users and verify schema', async ({ request }) => {
            const response = await request.get(`${helperUrls.api}/users`);
            const users = await response.json();

            expect(response.ok()).toBeTruthy();
            for (const user of users) {
                expect(user).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    role: expect.stringMatching(/admin|editor|viewer/) 
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
            const task = await createResponse.json();
            const taskId = task.id;

            // Update the task's status to in-progress
            const updateResponse = await request.put(`${helperUrls.api}/tasks/${taskId}`, {
                data: { status: 'in-progress' }
            });
            expect(updateResponse.ok()).toBeTruthy();

            // Delete the task
            const deleteResponse = await request.delete(`${helperUrls.api}/tasks/${taskId}`);
            expect(deleteResponse.status()).toBe(204); 
        });
    });

});