import { Page, Locator } from '@playwright/test';

export class TasksPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigates to the tasks page.
   */
  async navigate(): Promise<void> {
    await this.page.goto('http://localhost:5173/tasks');
  }

  /**
   * Gets the Tasks page heading.
   */
  getTasksHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Tasks' });
  }

  /**
   * Gets the Active tab button.
   */
  getActiveTab(): Locator {
    return this.page.getByTestId('tab-active');
  }

  /**
   * Gets the Grid View tab button.
   */
  getGridViewTab(): Locator {
    return this.page.getByTestId('tab-grid');
  }

  /**
   * Gets the Table tab button.
   */
  getTableTab(): Locator {
    return this.page.getByTestId('tab-table');
  }

  /**
   * Gets the Archive tab button.
   */
  getArchiveTab(): Locator {
    return this.page.getByTestId('tab-archived');
  }

  /**
   * Gets the Analytics tab button.
   */
  getAnalyticsTab(): Locator {
    return this.page.getByTestId('tab-analytics');
  }

  /**
   * Gets the search input field.
   */
  getSearchInput(): Locator {
    return this.page.getByTestId('task-search-input');
  }

  /**
   * Gets the New Task button.
   */
  getNewTaskButton(): Locator {
    return this.page.getByTestId('open-wizard-btn');
  }

  /**
   * Gets the Quick Add button.
   */
  getQuickAddButton(): Locator {
    return this.page.getByTestId('toggle-quick-form-btn');
  }

  /**
   * Gets the status filter dropdown.
   */
  getStatusFilter(): Locator {
    return this.page.getByRole('combobox').first();
  }

  /**
   * Gets the priority filter dropdown.
   */
  getPriorityFilter(): Locator {
    return this.page.getByRole('combobox').nth(1);
  }

  /**
   * Gets the My Tasks view filter button.
   */
  getMyTasksFilter(): Locator {
    return this.page.getByTestId('filter-my-tasks');
  }

  /**
   * Gets the Unassigned view filter button.
   */
  getUnassignedFilter(): Locator {
    return this.page.getByTestId('filter-unassigned');
  }

  /**
   * Gets the All view filter button.
   */
  getAllFilter(): Locator {
    return this.page.getByTestId('filter-all');
  }

  /**
   * Gets all task cards in the current view.
   */
  getTaskCards(): Locator {
    return this.page.locator('article');
  }

  /**
   * Gets the table element when in table view.
   */
  getTaskTable(): Locator {
    return this.page.locator('table');
  }

  /**
   * Gets archive empty message.
   */
  getArchiveEmptyMessage(): Locator {
    return this.page.getByText('Archive is Empty');
  }

  /**
   * Gets the archive description text.
   */
  getArchiveDescription(): Locator {
    return this.page.getByText('Completed tasks are automatically archived after 30 days');
  }

  /**
   * Gets Analytics heading.
   */
  getAnalyticsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Task Analytics' });
  }

  /**
   * Gets All Tasks stat card.
   */
  getAllTasksStat(): Locator {
    return this.page.getByRole('heading', { name: 'All Tasks' }).locator('..');
  }

  /**
   * Gets the numeric value from All Tasks stat.
   */
  getAllTasksValue(): Locator {
    return this.page.getByRole('heading', { name: 'All Tasks' }).locator('..').locator('p');
  }

  /**
   * Gets Completed stat card.
   */
  getCompletedStat(): Locator {
    return this.page.getByRole('heading', { name: 'Completed' }).locator('..');
  }

  /**
   * Gets the numeric value from Completed stat.
   */
  getCompletedValue(): Locator {
    return this.page.getByRole('heading', { name: 'Completed' }).locator('..').locator('p');
  }

  /**
   * Gets In Progress stat card.
   */
  getInProgressStat(): Locator {
    return this.page.getByRole('heading', { name: 'In Progress' }).locator('..');
  }

  /**
   * Gets the numeric value from In Progress stat.
   */
  getInProgressValue(): Locator {
    return this.page.getByRole('heading', { name: 'In Progress' }).locator('..').locator('p');
  }

  /**
   * Gets High Priority stat card.
   */
  getHighPriorityStat(): Locator {
    return this.page.getByRole('heading', { name: 'High Priority' }).locator('..');
  }

  /**
   * Gets the numeric value from High Priority stat.
   */
  getHighPriorityValue(): Locator {
    return this.page.getByRole('heading', { name: 'High Priority' }).locator('..').locator('p');
  }

  /**
   * Gets team member distribution section.
   */
  getTeamMemberSection(): Locator {
    return this.page.getByRole('heading', { name: 'Tasks by Team Member' }).locator('..');
  }

  /**
   * Gets search results dropdown.
   */
  getSearchResults(): Locator {
    return this.page.locator('[data-testid*="search-result"]');
  }

  /**
   * Gets pagination info text.
   */
  getPaginationInfo(): Locator {
    return this.page.locator('text=/Page \\d+ of \\d+ \\(\\d+ tasks\\)/');
  }

  /**
   * Gets the Previous pagination button.
   */
  getPreviousButton(): Locator {
    return this.page.getByRole('button', { name: 'Previous' });
  }

  /**
   * Gets the Next pagination button.
   */
  getNextButton(): Locator {
    return this.page.getByRole('button', { name: 'Next' });
  }

  /**
   * Clicks on a task edit button by task title.
   * @param taskTitle - The title of the task to edit
   */
  async clickEditTaskByTitle(taskTitle: string): Promise<void> {
    const taskCard = this.page.getByRole('heading', { name: taskTitle }).locator('../..');
    await taskCard.getByRole('button', { name: /edit|edytuj/i }).click();
  }

  /**
   * Clicks on a task delete button by task title.
   * @param taskTitle - The title of the task to delete
   */
  async clickDeleteTaskByTitle(taskTitle: string): Promise<void> {
    const taskCard = this.page.getByRole('heading', { name: taskTitle }).locator('../..');
    await taskCard.getByRole('button', { name: /usuń|delete/i }).click();
  }

  /**
   * Gets task wizard modal.
   */
  getTaskWizard(): Locator {
    return this.page.locator('[data-testid*="wizard"]').first();
  }

  /**
   * Gets task edit modal.
   */
  getTaskEditModal(): Locator {
    return this.page.getByRole('heading', { name: 'Edytuj zadanie' }).locator('..');
  }

  /**
   * Gets quick form section.
   */
  getQuickForm(): Locator {
    return this.page.locator('form');
  }

  /**
   * Gets empty state message.
   */
  getEmptyStateMessage(): Locator {
    return this.page.getByText('No tasks match your criteria');
  }

  /**
   * Fills in the quick form and submits it.
   * @param title - Task title
   * @param description - Task description
   */
  async createQuickTask(title: string, description: string = ''): Promise<void> {
    await this.page.getByLabel('Tytuł').fill(title);
    if (description) {
      await this.page.getByLabel('Opis').fill(description);
    }
    await this.page.getByTestId('add-task-button').click();
  }

  /**
   * Searches for a task by typing in the search field.
   * @param searchTerm - The term to search for
   */
  async searchForTask(searchTerm: string): Promise<void> {
    await this.getSearchInput().fill(searchTerm);
  }

  /**
   * Selects an option from the status filter.
   * @param status - The status to filter by
   */
  async filterByStatus(status: string): Promise<void> {
    await this.getStatusFilter().selectOption(status);
  }

  /**
   * Selects an option from the priority filter.
   * @param priority - The priority to filter by
   */
  async filterByPriority(priority: string): Promise<void> {
    await this.getPriorityFilter().selectOption(priority);
  }
}
