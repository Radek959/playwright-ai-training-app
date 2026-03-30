import { test, expect } from "@playwright/test";
import { DashboardPage } from "../pages/DashboardPage";
import { taskData, TaskDetails } from "../data/TaskData";    
import { userData } from "../data/UserData";

let dashboardPage: DashboardPage;
const mockResponse: TaskDetails[] = [
                    taskData.wizardFullDataTask,
                    taskData.quickFormFullDataTask
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
            await expect(dashboardPage.totalTasksStatCard.getByText( String(mockResponse.length), { exact: true })).toBeVisible();
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
                await expect(dashboardPage.inProgressStatCard.getByText( '1', { exact: true })).toBeVisible();
            });
        });

    // high priority tasks increases with mocked api response
    // completion increases in percentages
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
            await expect(dashboardPage.teamOverviewCard.getByText( '1 Active Members', { exact: false })).toBeVisible();
        });
    });
});