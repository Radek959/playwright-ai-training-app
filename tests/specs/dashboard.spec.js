const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage');

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('should display Total Tasks stat card with count', async ({ page }) => {
    // Arrange
    const dashboardPage = new DashboardPage(page);
    
    // Act
    const totalTasksCount = await dashboardPage.getTotalTasksCount();
    
    // Assert
    await expect(dashboardPage.totalTasksCard).toBeVisible();
    await expect(dashboardPage.pageTitle).toHaveText('Dashboard');
    // Verify that count is a positive number (tasks exist)
    expect(parseInt(totalTasksCount?.trim() || '0')).toBeGreaterThan(0);
  });

  test('should display Task Status Distribution with all progress bars', async ({ page }) => {
    // Arrange
    const dashboardPage = new DashboardPage(page);
    
    // Act
    const statusDistributionVisible = await dashboardPage.isStatusDistributionVisible();
    const allLabelsVisible = await dashboardPage.areAllStatusLabelsVisible();
    
    // Assert
    await expect(dashboardPage.statusDistributionTitle).toBeVisible();
    expect(statusDistributionVisible).toBe(true);
    expect(allLabelsVisible).toBe(true);
    
    // Verify individual status labels
    await expect(dashboardPage.todoStatusLabel).toBeVisible();
    await expect(dashboardPage.inProgressStatusLabel).toBeVisible();
    await expect(dashboardPage.doneStatusLabel).toBeVisible();
    
    // Verify progress bars are present
    const todoBar = dashboardPage.getStatusProgressBar('To Do');
    const inProgressBar = dashboardPage.getStatusProgressBar('In Progress');
    const doneBar = dashboardPage.getStatusProgressBar('Done');
    
    await expect(todoBar).toBeVisible();
    await expect(inProgressBar).toBeVisible();
    await expect(doneBar).toBeVisible();
  });
});
