import { type Page, type Locator } from '@playwright/test';

export class TasksPage {
  // Toolbar
  readonly openWizardButton: Locator;

  // Wizard overlay
  readonly wizardOverlay: Locator;
  readonly typeSelect: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly prioritySelect: Locator;
  readonly assigneeSelect: Locator;
  readonly severitySelect: Locator;
  readonly nextButton: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    // Toolbar
    this.openWizardButton = page.getByTestId('open-wizard-btn');

    // Wizard overlay
    this.wizardOverlay    = page.getByTestId('task-wizard-overlay');
    this.typeSelect       = page.getByTestId('task-type-select');
    this.titleInput       = page.getByTestId('task-title-input');
    this.descriptionInput = page.getByTestId('task-description-input');
    this.prioritySelect   = page.getByTestId('task-priority-select');
    this.assigneeSelect   = page.getByTestId('task-assignee-select');
    this.severitySelect   = page.getByTestId('task-severity-select');
    this.nextButton       = page.getByTestId('wizard-next-btn');
    this.submitButton     = page.getByTestId('wizard-submit-btn');
  }

  async goto() {
    await this.page.goto('/tasks');
  }

  taskCard(title: string): Locator {
    return this.page
      .locator('article')
      .filter({ has: this.page.getByRole('heading', { name: title }) })
      .first();
  }
}