const { test, expect } = require('@playwright/test');
const { TasksPage } = require('../pages/TasksPage');

test.describe('Tasks - Quick Add', () => {
  test.beforeEach(async ({ page }) => {
    const tasksPage = new TasksPage(page);
    await page.goto('http://localhost:5173/');
    await tasksPage.navigateToTasks();
  });

  test('should display Quick Add button', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    
    // Act & Assert
    await expect(tasksPage.quickAddButton).toBeVisible();
  });

  test('should open and close Quick Add form', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    
    // Act - Open form
    await tasksPage.openQuickAdd();
    
    // Assert - Form is visible
    await expect(tasksPage.titleInput).toBeVisible();
    await expect(tasksPage.descriptionInput).toBeVisible();
    await expect(tasksPage.addTaskButton).toBeVisible();
    await expect(tasksPage.hideAddButton).toBeVisible();
    
    // Act - Close form
    await tasksPage.closeQuickAdd();
    
    // Assert - Form is hidden
    await expect(tasksPage.titleInput).toBeHidden();
    await expect(tasksPage.quickAddButton).toBeVisible();
  });

  test('should add a new task with minimal data using Quick Add', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const initialCount = await tasksPage.getTaskCount();
    const taskData = {
      title: `Test Task - Minimal Data - ${Date.now()}`
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    await expect(tasksPage.getTaskByTitle(taskData.title)).toBeVisible();
    const newCount = await tasksPage.getTaskCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should add a new task with full data using Quick Add', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Complete Task Example',
      description: 'This is a detailed description of the task with all fields filled',
      status: 'In Progress',
      priority: 'High',
      dueDate: '2026-02-15',
      assignee: 'Alice Johnson'
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    await expect(tasksPage.getTaskByTitle(taskData.title)).toBeVisible();
    const taskCard = tasksPage.getTaskCard(taskData.title);
    await expect(taskCard.getByText(taskData.description)).toBeVisible();
    await expect(taskCard.getByText('P: high')).toBeVisible();
    await expect(taskCard.getByText('Owner: Alice Johnson')).toBeVisible();
  });

  test('should add multiple tasks consecutively using Quick Add', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const timestamp = Date.now();
    const tasks = [
      { title: `First Task ${timestamp}`, priority: 'High' },
      { title: `Second Task ${timestamp}`, priority: 'Medium' },
      { title: `Third Task ${timestamp}`, priority: 'Low' }
    ];
    
    // Act
    for (const taskData of tasks) {
      await tasksPage.createTaskViaQuickAdd(taskData);
    }
    
    // Assert - Use findTaskByTitle to search for tasks that might be on different pages
    for (const taskData of tasks) {
      const taskLocator = await tasksPage.findTaskByTitle(taskData.title);
      await expect(taskLocator).toBeVisible();
    }
  });

  test('should reset form after successful task creation', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Task to test form reset',
      description: 'Description for reset test',
      priority: 'High',
      assignee: 'Bob Smith'
    };
    
    // Act
    await tasksPage.openQuickAdd();
    await tasksPage.fillQuickAddForm(taskData);
    await tasksPage.submitQuickAdd();
    
    // Assert - Form should be reset with empty fields
    await expect(tasksPage.titleInput).toHaveValue('');
    await expect(tasksPage.descriptionInput).toHaveValue('');
  });

  test('should add task with different priorities', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const timestamp = Date.now();
    
    // Act & Assert - Low priority
    await tasksPage.createTaskViaQuickAdd({
      title: `Low Priority Task ${timestamp}`,
      priority: 'Low'
    });
    await expect(tasksPage.getTaskByTitle(`Low Priority Task ${timestamp}`)).toBeVisible();
    
    // Act & Assert - Medium priority
    await tasksPage.createTaskViaQuickAdd({
      title: `Medium Priority Task ${timestamp}`,
      priority: 'Medium'
    });
    await expect(tasksPage.getTaskByTitle(`Medium Priority Task ${timestamp}`)).toBeVisible();
    
    // Act & Assert - High priority
    await tasksPage.createTaskViaQuickAdd({
      title: `High Priority Task ${timestamp}`,
      priority: 'High'
    });
    await expect(tasksPage.getTaskByTitle(`High Priority Task ${timestamp}`)).toBeVisible();
  });

  // KNOWN ISSUE: Tasks with "Done" status are not being created properly on the backend
  // API returns 201 Created but tasks don't appear in the UI
  test.fixme('should add task with different statuses', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const timestamp = Date.now();
    
    // Act & Assert - To Do
    await tasksPage.createTaskViaQuickAdd({
      title: `To Do Task ${timestamp}`,
      status: 'To Do'
    });
    const todoTaskLocator = await tasksPage.findTaskByTitle(`To Do Task ${timestamp}`);
    await expect(todoTaskLocator).toBeVisible();
    const todoCard = tasksPage.getTaskCard(`To Do Task ${timestamp}`);
    await expect(todoCard.getByText(/todo/i)).toBeVisible();
    
    // Act & Assert - In Progress
    await tasksPage.createTaskViaQuickAdd({
      title: `In Progress Task ${timestamp}`,
      status: 'In Progress'
    });
    const inProgressTaskLocator = await tasksPage.findTaskByTitle(`In Progress Task ${timestamp}`);
    await expect(inProgressTaskLocator).toBeVisible();
    
    // Act & Assert - Done
    // This step fails: Done tasks are created via API (201 status) but don't appear in the UI
    // Likely backend issue where Done status tasks are filtered out or not persisted correctly
    await tasksPage.createTaskViaQuickAdd({
      title: `Done Task ${timestamp}`,
      status: 'Done'
    });
    const doneTaskLocator = await tasksPage.findTaskByTitle(`Done Task ${timestamp}`);
    await expect(doneTaskLocator).toBeVisible();
  });

  test('should add task with different assignees', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const assignees = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Martinez'];
    const timestamp = Date.now();
    
    // Act & Assert
    for (const assignee of assignees) {
      await tasksPage.createTaskViaQuickAdd({
        title: `Task for ${assignee} ${timestamp}`,
        assignee: assignee
      });
      await expect(tasksPage.getTaskByTitle(`Task for ${assignee} ${timestamp}`)).toBeVisible();
      const taskCard = tasksPage.getTaskCard(`Task for ${assignee} ${timestamp}`);
      await expect(taskCard.getByText(`Owner: ${assignee}`)).toBeVisible();
    }
  });

  test('should add unassigned task', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Unassigned Task',
      description: 'This task has no owner'
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    await expect(tasksPage.getTaskByTitle(taskData.title)).toBeVisible();
    const taskCard = page.locator('article').filter({ hasText: taskData.title });
    await expect(taskCard.getByText(/Owner:/)).toBeHidden();
  });

  test('should display newly created task at the top of the list', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Newest Task Should Be First'
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    const firstTaskHeading = page.getByRole('heading', { level: 3 }).first();
    await expect(firstTaskHeading).toHaveText(taskData.title);
  });

  test('should keep Quick Add form visible after adding a task', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    
    // Act
    await tasksPage.createTaskViaQuickAdd({ title: 'Test Task' });
    
    // Assert
    await expect(tasksPage.titleInput).toBeVisible();
    await expect(tasksPage.addTaskButton).toBeVisible();
  });

  test('should add task with due date', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Task with Due Date',
      dueDate: '2026-02-28'
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    await expect(tasksPage.getTaskByTitle(taskData.title)).toBeVisible();
    const taskCard = tasksPage.getTaskCard(taskData.title);
    await expect(taskCard.getByText('Due: 2/28/2026')).toBeVisible();
  });

  test('should add task with long title and description', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const taskData = {
      title: 'Very Long Task Title That Contains Multiple Words And Describes The Task In Detail',
      description: 'This is a very long description that contains multiple sentences. It provides detailed information about the task. The description can be quite lengthy and should be handled properly by the application.'
    };
    
    // Act
    await tasksPage.createTaskViaQuickAdd(taskData);
    
    // Assert
    await expect(tasksPage.getTaskByTitle(taskData.title)).toBeVisible();
    const taskCard = tasksPage.getTaskCard(taskData.title);
    await expect(taskCard.getByText(taskData.description)).toBeVisible();
  });

  test('should increment task counter after adding new task', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const initialCount = await tasksPage.getTaskCount();
    const expectedCount = initialCount + 1;
    
    // Act
    await tasksPage.createTaskViaQuickAdd({ title: `Counter Test Task ${Date.now()}` });
    
    // Assert - Wait for counter to update to expected value
    await tasksPage.waitForTaskCount(expectedCount);
    const finalCount = await tasksPage.getTaskCount();
    expect(finalCount).toBe(expectedCount);
    await expect(page.getByText(`(${finalCount} tasks)`)).toBeVisible();
  });
});

test.describe('Tasks - Task List', () => {
  test.beforeEach(async ({ page }) => {
    const tasksPage = new TasksPage(page);
    await page.goto('http://localhost:5173/');
    await tasksPage.navigateToTasks();
  });

  test('should display Tasks page header', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    
    // Act & Assert
    await expect(tasksPage.pageTitle).toBeVisible();
    await expect(tasksPage.pageDescription).toBeVisible();
  });

  test('should display existing tasks', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    
    // Act
    const taskCount = await tasksPage.getTaskCount();
    
    // Assert
    expect(taskCount).toBeGreaterThan(0);
    await expect(tasksPage.taskCards.first()).toBeVisible();
  });

  test('should display task cards with required information', async ({ page }) => {
    // Arrange
    const tasksPage = new TasksPage(page);
    const firstTask = tasksPage.taskCards.first();
    
    // Act & Assert
    await expect(firstTask.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(firstTask.locator('p').first()).toBeVisible(); // Description
    await expect(firstTask.getByRole('button', { name: 'Edytuj zadanie' })).toBeVisible();
    await expect(firstTask.getByRole('button', { name: 'Usuń zadanie' })).toBeVisible();
  });

  test('should navigate to Tasks page from Dashboard', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:5173/');
    
    // Act
    await page.getByRole('link', { name: 'Tasks' }).click();
    
    // Assert
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  });
});
