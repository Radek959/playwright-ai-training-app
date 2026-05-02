import { faker } from '@faker-js/faker';
import { UserDetails } from '../data/UserData';
import test, { Page } from '@playwright/test';
import { TaskDetails } from '../data/TaskData';

export const helperUrls = {
    api: 'http://localhost:3001/api',
}

export const getFakeUser = (): UserDetails => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
        name: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName }),
        role: faker.helpers.arrayElement(['admin', 'editor', 'viewer']),
        avatar: faker.image.avatar(),
    };
};

async function mockTasks(page: Page, tasks: TaskDetails[]) {
    await page.route('**/api/tasks', async (route) => {
        await route.fulfill({ 
            status: 201, 
            contentType: 'application/json', 
            json: tasks });
    });
}

async function mockUsers(page: Page, users: UserDetails[]) {
    await page.route('**/api/users', async (route) => {
        await route.fulfill({ 
            status: 201, 
            contentType: 'application/json', 
            json: users });
    });
}

export { mockTasks, mockUsers };