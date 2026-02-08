/**
 * Page Object representing the Tasks page
 * Handles task management, Quick Add form, and task list operations
 */
class TasksPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  constructor(page) {
    this.page = page;
    
    // Header elements
    this.pageTitle = page.getByRole('heading', { name: 'Tasks' });
    this.pageDescription = page.getByText("Manage and track your team's work");
    
    // Action buttons
    this.newTaskButton = page.getByRole('button', { name: 'New Task' });
    this.quickAddButton = page.getByRole('button', { name: 'Quick Add' });
    this.hideAddButton = page.getByRole('button', { name: 'Hide Add' });
    
    // Search
    this.searchInput = page.getByRole('textbox', { name: 'Szukaj zadań...' });
    
    // View buttons
    this.activeButton = page.getByRole('button', { name: 'Active' });
    this.gridViewButton = page.getByRole('button', { name: 'Grid View' });
    this.tableButton = page.getByRole('button', { name: 'Table' });
    this.archiveButton = page.getByRole('button', { name: 'Archive' });
    this.analyticsButton = page.getByRole('button', { name: 'Analytics' });
    
    // Filter buttons
    this.allViewButton = page.getByRole('button', { name: 'All' });
    this.myTasksButton = page.getByRole('button', { name: 'My Tasks' });
    this.unassignedButton = page.getByRole('button', { name: 'Unassigned' });
    
    // Filter dropdowns
    this.statusFilter = page.getByRole('combobox').first();
    this.priorityFilter = page.getByRole('combobox').nth(1);
    
    // Quick Add form fields
    this.titleInput = page.locator('input').nth(1); // nth(1) skips search input
    this.descriptionInput = page.locator('textarea');
    this.statusSelect = page.getByRole('combobox').nth(2); // nth(2) skips filter dropdowns
    this.prioritySelect = page.getByRole('combobox').nth(3);
    this.dueDateInput = page.locator('input[type="date"]');
    this.assigneeSelect = page.getByRole('combobox').nth(4);
    this.addTaskButton = page.getByRole('button', { name: 'Dodaj zadanie' });
    
    // Task list
    this.taskCards = page.locator('article');
    this.paginationInfo = page.getByText(/Page \d+ of \d+ \(\d+ tasks\)/);
  }

  /**
   * Navigates to the Tasks page
   * @returns {Promise<void>}
   */
  async goto() {
    await this.page.goto('http://localhost:5173/tasks');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigates to Tasks page from any page using navigation link
   * @returns {Promise<void>}
   */
  async navigateToTasks() {
    await this.page.getByRole('link', { name: 'Tasks' }).click();
    await this.page.waitForURL('**/tasks');
  }

  /**
   * Opens the Quick Add form
   * @returns {Promise<void>}
   */
  async openQuickAdd() {
    // Check if form is already visible
    const isFormVisible = await this.titleInput.isVisible();
    if (!isFormVisible) {
      await this.quickAddButton.click();
      await this.titleInput.waitFor({ state: 'visible' });
    }
  }

  /**
   * Closes the Quick Add form
   * @returns {Promise<void>}
   */
  async closeQuickAdd() {
    await this.hideAddButton.click();
    await this.titleInput.waitFor({ state: 'hidden' });
  }

  /**
   * Checks if Quick Add form is visible
   * @returns {Promise<boolean>}
   */
  async isQuickAddFormVisible() {
    return await this.titleInput.isVisible();
  }

  /**
   * Fills the Quick Add form with task data
   * @param {Object} taskData - Task information
   * @param {string} taskData.title - Task title
   * @param {string} [taskData.description] - Task description (optional)
   * @param {string} [taskData.status] - Task status: 'To Do', 'In Progress', 'Done' (optional)
   * @param {string} [taskData.priority] - Task priority: 'Low', 'Medium', 'High' (optional)
   * @param {string} [taskData.dueDate] - Due date in format YYYY-MM-DD (optional)
   * @param {string} [taskData.assignee] - Assignee name (optional)
   * @returns {Promise<void>}
   */
  async fillQuickAddForm({ title, description, status, priority, dueDate, assignee }) {
    await this.titleInput.fill(title);
    
    if (description) {
      await this.descriptionInput.fill(description);
    }
    
    if (status) {
      await this.statusSelect.selectOption(status);
    }
    
    if (priority) {
      await this.prioritySelect.selectOption(priority);
    }
    
    if (dueDate) {
      await this.dueDateInput.fill(dueDate);
    }
    
    if (assignee) {
      await this.assigneeSelect.selectOption(assignee);
    }
  }

  /**
   * Submits the Quick Add form
   * @returns {Promise<void>}
   */
  async submitQuickAdd() {
    // Get initial count for waiting
    const initialCount = await this.getTaskCount();
    
    await this.addTaskButton.click();
    
    // Wait for the task count to increase, indicating successful creation
    await this.page.waitForFunction(
      (expectedCount) => {
        const paginationElement = document.querySelector('div');
        const allDivs = Array.from(document.querySelectorAll('div'));
        for (const div of allDivs) {
          if (div.textContent && div.textContent.includes('Page') && div.textContent.includes('tasks)')) {
            const match = div.textContent.match(/\((\d+) tasks\)/);
            if (match) {
              const currentCount = parseInt(match[1], 10);
              return currentCount > expectedCount;
            }
          }
        }
        return false;
      },
      initialCount,
      { timeout: 10000 }
    );
    
    // Additional wait for UI to settle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Creates a new task using Quick Add form (opens, fills, submits)
   * @param {Object} taskData - Task information
   * @param {string} taskData.title - Task title
   * @param {string} [taskData.description] - Task description (optional)
   * @param {string} [taskData.status] - Task status (optional)
   * @param {string} [taskData.priority] - Task priority (optional)
   * @param {string} [taskData.dueDate] - Due date (optional)
   * @param {string} [taskData.assignee] - Assignee name (optional)
   * @returns {Promise<void>}
   */
  async createTaskViaQuickAdd(taskData) {
    await this.openQuickAdd();
    await this.fillQuickAddForm(taskData);
    await this.submitQuickAdd();
  }

  /**
   * Gets a task card by its title, using search if necessary to locate it across pages
   * @param {string} title - Task title
   * @returns {import('@playwright/test').Locator}
   */
  getTaskByTitle(title) {
    return this.page.getByRole('heading', { name: title, level: 3 });
  }

  /**
   * Searches for and ensures a task is visible by title
   * Uses search functionality to locate tasks that might be on other pages
   * @param {string} title - Task title
   * @returns {Promise<import('@playwright/test').Locator>}
   */
  async findTaskByTitle(title) {
    // First try to see if task is already visible
    const directTask = this.getTaskByTitle(title);
    if (await directTask.isVisible().catch(() => false)) {
      return directTask;
    }

    // Use search to find the task
    const searchInput = this.page.getByPlaceholder(/szukaj|search/i);
    await searchInput.fill(title);
    
    // Wait for search results to load
    await this.page.waitForLoadState('networkidle');
    
    // Return the task locator 
    return this.getTaskByTitle(title);
  }

  /**
   * Gets a specific task card container by title
   * @param {string} title - Task title 
   * @returns {import('@playwright/test').Locator}
   */
  getTaskCard(title) {
    return this.page.locator('article').filter({ hasText: title });
  }

  /**
   * Checks if a task exists by title
   * @param {string} title - Task title
   * @returns {Promise<boolean>}
   */
  async hasTask(title) {
    return await this.getTaskByTitle(title).isVisible();
  }

  /**
   * Gets the edit button for a specific task
   * @param {string} taskTitle - Task title
   * @returns {import('@playwright/test').Locator}
   */
  getTaskEditButton(taskTitle) {
    return this.page
      .locator('article')
      .filter({ hasText: taskTitle })
      .getByRole('button', { name: 'Edytuj zadanie' });
  }

  /**
   * Gets the delete button for a specific task
   * @param {string} taskTitle - Task title
   * @returns {import('@playwright/test').Locator}
   */
  getTaskDeleteButton(taskTitle) {
    return this.page
      .locator('article')
      .filter({ hasText: taskTitle })
      .getByRole('button', { name: 'Usuń zadanie' });
  }

  /**
   * Gets the task count from pagination info
   * @returns {Promise<number>}
   */
  async getTaskCount() {
    const paginationText = await this.paginationInfo.textContent();
    const match = paginationText.match(/\((\d+) tasks\)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  /**
   * Waits for task count to change to expected value
   * @param {number} expectedCount - Expected task count
   * @param {number} [timeout=10000] - Timeout in ms
   * @returns {Promise<number>}
   */
  async waitForTaskCount(expectedCount, timeout = 10000) {
    await this.page.waitForFunction(
      (expected) => {
        const allDivs = Array.from(document.querySelectorAll('div'));
        for (const div of allDivs) {
          if (div.textContent && div.textContent.includes('Page') && div.textContent.includes('tasks)')) {
            const match = div.textContent.match(/\((\d+) tasks\)/);
            if (match) {
              const currentCount = parseInt(match[1], 10);
              return currentCount === expected;
            }
          }
        }
        return false;
      },
      expectedCount,
      { timeout }
    );
    return expectedCount;
  }
  /**
   * Searches for tasks
   * @param {string} query - Search query
   * @returns {Promise<void>}
   */
  async searchTasks(query) {
    await this.searchInput.fill(query);
  }

  /**
   * Filters tasks by status
   * @param {string} status - Status: 'All', 'To Do', 'In Progress', 'Done'
   * @returns {Promise<void>}
   */
  async filterByStatus(status) {
    await this.statusFilter.selectOption(status);
  }

  /**
   * Filters tasks by priority
   * @param {string} priority - Priority: 'All', 'Low', 'Medium', 'High'
   * @returns {Promise<void>}
   */
  async filterByPriority(priority) {
    await this.priorityFilter.selectOption(priority);
  }

  /**
   * Gets all visible task titles
   * @returns {Promise<string[]>}
   */
  async getVisibleTaskTitles() {
    const headings = await this.page.getByRole('heading', { level: 3 }).all();
    return Promise.all(headings.map(h => h.textContent()));
  }
}

module.exports = { TasksPage };
