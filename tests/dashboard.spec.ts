import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard', () => {
  test('displays Total Tasks card with task count', async ({ page }) => {
    // Arrange
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.navigate();
    
    // Act
    const totalTasksCard = dashboardPage.getTotalTasksCard();
    
    // Assert
    await expect(dashboardPage.getDashboardHeading()).toBeVisible();
    await expect(totalTasksCard).toBeVisible();
    await expect(totalTasksCard).toContainText('Total Tasks');
    await expect(totalTasksCard.getByText(/^\d+$/)).toBeVisible();
  });

  test('displays Task Status Distribution with progress bars', async ({ page }) => {
    // Arrange
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.navigate();
    
    // Act
    const statusDistributionSection = dashboardPage.getTaskStatusDistributionSection();
    const statusDistributionHeading = dashboardPage.getTaskStatusDistributionHeading();
    const statusLabels = dashboardPage.getStatusDistributionLabels();
    
    // Assert
    await expect(statusDistributionHeading).toBeVisible();
    
    // Verify all three status labels are visible
    for (const label of statusLabels) {
      await expect(label).toBeVisible();
    }
    
    // Verify progress bars exist for each status (scoped to Task Status Distribution)
    await expect(statusDistributionSection.getByText('To Do')).toBeVisible();
    await expect(statusDistributionSection.getByText('In Progress')).toBeVisible();
    await expect(statusDistributionSection.getByText('Done')).toBeVisible();
  });
});
