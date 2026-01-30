import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigates to the dashboard page.
   * @returns Promise that resolves when navigation is complete
   */
  async navigate(): Promise<void> {
    await this.page.goto('http://localhost:5173/');
  }

  /**
   * Gets the stat card containing "Total Tasks" title.
   * @returns Locator for the Total Tasks stat card
   */
  getTotalTasksCard() {
    return this.page.getByText('Total Tasks').locator('..');
  }

  /**
   * Gets all status labels within the Task Status Distribution section only.
   * @returns Array of locators for status labels scoped to the distribution section
   */
  getStatusDistributionLabels() {
    const section = this.page.getByRole('heading', { name: 'Task Status Distribution' }).locator('..');
    return [
      section.getByText('To Do'),
      section.getByText('In Progress'),
      section.getByText('Done')
    ];
  }

  /**
   * Gets the Task Status Distribution section container.
   * @returns Locator for the entire Task Status Distribution section
   */
  getTaskStatusDistributionSection() {
    return this.page.getByRole('heading', { name: 'Task Status Distribution' }).locator('..');
  }

  /**
   * Checks if the Task Status Distribution section is visible.
   * @returns Promise resolving to the heading element locator
   */
  getTaskStatusDistributionHeading() {
    return this.page.getByRole('heading', { name: 'Task Status Distribution' });
  }

  /**
   * Checks if the dashboard heading is visible.
   * @returns Locator for the dashboard heading
   */
  getDashboardHeading() {
    return this.page.getByRole('heading', { name: 'Dashboard' });
  }
}
