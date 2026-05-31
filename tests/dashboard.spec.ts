import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

const TASKS_MOCK = [
  { id: 't1', title: 'Task One', description: 'First task', status: 'todo', priority: 'medium' },
  { id: 't2', title: 'Task Two', description: 'Second task', status: 'in-progress', priority: 'high' },
  { id: 't3', title: 'Task Three', description: 'Third task', status: 'todo', priority: 'high' },
  { id: 't4', title: 'Task Four', description: 'Fourth task', status: 'done', priority: 'low' },
];

test.describe('Dashboard view', () => {
  test('should render dashboard header and summary cards', async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TASKS_MOCK) });
      } else {
        await route.continue();
      }
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.welcomeText).toBeVisible();

    await expect(dashboard.statCard('Total Tasks')).toContainText('4');
    await expect(dashboard.statCard('In Progress')).toContainText('1');
    await expect(dashboard.statCard('High Priority')).toContainText('2');
    await expect(dashboard.statCard('Completion')).toContainText('25%');
  });

  test('should render team overview with active members', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.teamOverviewHeading).toBeVisible();
    await expect(dashboard.activeMembersText).toBeVisible();

    await expect(dashboard.memberName('Alice Johnson')).toBeVisible();
    await expect(dashboard.memberName('Bob Smith')).toBeVisible();
    await expect(dashboard.memberName('Charlie Davis')).toBeVisible();
    await expect(dashboard.memberName('Diana Martinez')).toBeVisible();
  });

  test('should render progress bar', async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TASKS_MOCK) });
      } else {
        await route.continue();
      }
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.taskStatusDistributionHeading).toBeVisible();
    await expect(dashboard.distributionSection.getByText('To Do')).toBeVisible();
    await expect(dashboard.distributionSection.getByText('In Progress')).toBeVisible();
    await expect(dashboard.distributionSection.getByText('Done')).toBeVisible();
    await expect(dashboard.distributionSection.getByText('2 (50%)')).toBeVisible();

    await expect(dashboard.inProgressDistributionRow().getByText('1 (25%)')).toBeVisible();
  });
});
