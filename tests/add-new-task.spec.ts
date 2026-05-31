import { test, expect } from '@playwright/test';
import { TasksPage } from './pages/TasksPage';

test('should add new task', async ({ page }) => {
  const tasksPage = new TasksPage(page);
  await tasksPage.goto();

  // Open wizard
  await expect(tasksPage.openWizardButton).toBeVisible();
  await tasksPage.openWizardButton.click();
  await expect(tasksPage.wizardOverlay).toBeVisible();

  // Step 1: task details
  await test.step('Fill task details', async () => {
    await expect(tasksPage.typeSelect).toBeVisible();
    await tasksPage.typeSelect.selectOption({ label: 'Bug' });
    await tasksPage.titleInput.fill('New bug');
    await tasksPage.descriptionInput.fill('Description of new bug');
    await tasksPage.prioritySelect.selectOption({ label: 'Medium' });
    await expect(tasksPage.nextButton).toBeEnabled();
    await tasksPage.nextButton.click();
  });

  // Step 2: assignment
  await test.step('Fill assignment', async () => {
    await expect(tasksPage.assigneeSelect).toBeVisible();
    await tasksPage.assigneeSelect.selectOption({ label: 'Alice Johnson' });
    await tasksPage.severitySelect.selectOption({ label: 'Minor' });
    await tasksPage.nextButton.click();
  });

  // Step 3: submit
  await test.step('Submit wizard', async () => {
    await expect(tasksPage.submitButton).toBeVisible();
    await tasksPage.submitButton.click();
  });

  await expect(tasksPage.taskCard('New bug')).toBeVisible();
});