/**
 * Page Object representing the Dashboard page
 * Handles dashboard statistics, charts, and team overview
 */
class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  constructor(page) {
    this.page = page;
    
    // Header elements
    this.pageTitle = page.getByRole('heading', { name: 'Dashboard' });
    this.welcomeMessage = page.getByText("Welcome back! Here's what's happening today.");
    
    // Stat Cards - using getByText to find specific cards
    this.totalTasksCard = page.getByText('Total Tasks').locator('..');
    this.inProgressCard = page.getByText('In Progress').locator('..').first();
    this.highPriorityCard = page.getByText('High Priority').locator('..');
    this.completionCard = page.getByText('Completion').locator('..');
    
    // Task Status Distribution section
    this.statusDistributionTitle = page.getByRole('heading', { name: 'Task Status Distribution' });
    this.todoStatusLabel = page.getByText('To Do').first();
    this.inProgressStatusLabel = page.getByText('In Progress').first();
    this.doneStatusLabel = page.getByText('Done').first();
    
    // Priority Breakdown section
    this.priorityBreakdownTitle = page.getByRole('heading', { name: 'Priority Breakdown' });
    this.lowPriorityLabel = page.getByText('Low', { exact: false });
    this.mediumPriorityLabel = page.getByText('Medium', { exact: false });
    this.highPriorityLabel = page.getByText('High', { exact: false });
    
    // Team Overview section
    this.teamOverviewTitle = page.getByRole('heading', { name: 'Team Overview' });
  }

  /**
   * Navigates to the Dashboard page
   * @returns {Promise<void>}
   */
  async goto() {
    await this.page.goto('http://localhost:5173/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Gets the total tasks count from the stat card
   * @returns {Promise<string>}
   */
  async getTotalTasksCount() {
    const card = this.page.getByText('Total Tasks').locator('..');
    const valueElement = card.locator('p').nth(1);
    return await valueElement.textContent();
  }

  /**
   * Gets the in progress tasks count from the stat card
   * @returns {Promise<string>}
   */
  async getInProgressCount() {
    const card = this.page.getByText('In Progress').locator('..');
    const valueElement = card.locator('p').nth(1);
    return await valueElement.textContent();
  }

  /**
   * Gets the high priority tasks count from the stat card
   * @returns {Promise<string>}
   */
  async getHighPriorityCount() {
    const card = this.page.getByText('High Priority').locator('..');
    const valueElement = card.locator('p').nth(1);
    return await valueElement.textContent();
  }

  /**
   * Gets the completion percentage from the stat card
   * @returns {Promise<string>}
   */
  async getCompletionPercentage() {
    const card = this.page.getByText('Completion').locator('..');
    const valueElement = card.locator('p').nth(1);
    return await valueElement.textContent();
  }

  /**
   * Checks if the Task Status Distribution section is visible
   * @returns {Promise<boolean>}
   */
  async isStatusDistributionVisible() {
    return await this.statusDistributionTitle.isVisible();
  }

  /**
   * Checks if all status labels (To Do, In Progress, Done) are visible
   * @returns {Promise<boolean>}
   */
  async areAllStatusLabelsVisible() {
    const todoVisible = await this.todoStatusLabel.isVisible();
    const inProgressVisible = await this.inProgressStatusLabel.isVisible();
    const doneVisible = await this.doneStatusLabel.isVisible();
    return todoVisible && inProgressVisible && doneVisible;
  }

  /**
   * Checks if the Priority Breakdown section is visible
   * @returns {Promise<boolean>}
   */
  async isPriorityBreakdownVisible() {
    return await this.priorityBreakdownTitle.isVisible();
  }

  /**
   * Checks if the Team Overview section is visible
   * @returns {Promise<boolean>}
   */
  async isTeamOverviewVisible() {
    return await this.teamOverviewTitle.isVisible();
  }

  /**
   * Gets the status bar element for a specific status
   * @param {string} status - Status name ('To Do', 'In Progress', or 'Done')
   * @returns {import('@playwright/test').Locator}
   */
  getStatusProgressBar(status) {
    return this.page.getByText(status, { exact: false }).locator('..').locator('..').locator('.bg-gray-200');
  }
}

module.exports = { DashboardPage };
