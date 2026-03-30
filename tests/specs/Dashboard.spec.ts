import { test, expect } from "@playwright/test";
import { DashboardPage } from "../pages/DashboardPage";
import { taskData, TaskDetails } from "../data/TaskData";    
import { userData } from "../data/UserData";

let dashboardPage: DashboardPage;
const mockResponse: TaskDetails[] = [
                    taskData.todoTask,
                    taskData.inProgressTask,
                    taskData.doneTask
                ];

test.describe( 'dashboard should display tasks correctly', () => {
    test.beforeEach(async ({ page }) => {
            dashboardPage = new DashboardPage(page);
        });

    test.describe( 'should display total tasks correctly', () => { 
        test('should increase total tasks in stats card', async ({ page }) => {
            await page.route('**/api/tasks', async (route) => {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    json: mockResponse
                });
            });
    
            await dashboardPage.navigateToPage();
            await expect(dashboardPage.totalTasksStatCard.locator('p' , {hasText: String(mockResponse.length)})).toBeVisible();
        });
    });

    // when mocking api with in progress status, in progress stat card increases and doesnt increase when task is todo
    // when finishing task, in progress stat card val decreases
    test.describe( 'should display in progress tasks correctly', () => { 
            test('should increase in progress tasks in stats card', async ({ page }) => {
                
                await page.route('**/api/tasks', async (route) => {
                    await route.fulfill({
                        status: 201,
                        contentType: 'application/json',
                        json: mockResponse
                    });
                });

                await dashboardPage.navigateToPage();
                await expect(dashboardPage.inProgressStatCard.locator('p' , {hasText: '1'})).toBeVisible();
            });

            test('should not increase for todo and done tasks in stats card', async ({ page }) => {
                
                await page.route('**/api/tasks', async (route) => {
                    await route.fulfill({
                        status: 201,
                        contentType: 'application/json',
                        json: [taskData.todoTask, taskData.doneTask]
                    });
                });

                await dashboardPage.navigateToPage();
                await expect(dashboardPage.inProgressStatCard.locator('p' , {hasText: '0'})).toBeVisible();
            });
        });

    // high priority tasks increases with mocked api response
    // completion increases in percentages

    test.describe( 'should display completion stat card correctly', () => { 
            test('should correctly calculate completion in stats card', async ({ page }) => {
                
                await page.route('**/api/tasks', async (route) => {
                    await route.fulfill({
                        status: 201,
                        contentType: 'application/json',
                        json: mockResponse
                    });
                });

                await dashboardPage.navigateToPage();
                await expect(dashboardPage.completionStatCard.locator('p' , {hasText: '33%'})).toBeVisible();
            });

        });
    // task status Breakdown todo in progress done
    // priority Breakdown low medium high

    //team overview adds new member and increses active members
    test.describe( 'should display members correctly', () => { 
        test('should increase active members in stats card', async ({ page }) => {
            
            await page.route('**/api/users', async (route) => {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    json: [userData.mockUser]
                });
            });

            await dashboardPage.navigateToPage();
            await expect(dashboardPage.teamOverviewCard.locator('span' , {hasText: '1 Active Members'})).toBeVisible();
        });
    });
});