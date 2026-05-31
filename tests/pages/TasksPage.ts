import { type Page, type Locator } from '@playwright/test';

export class TasksPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/tasks');
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────

  get openWizardButton(): Locator {
    return this.page.getByTestId('open-wizard-btn');
  }

  // ── Wizard overlay ───────────────────────────────────────────────────────

  get wizardOverlay(): Locator {
    return this.page.getByTestId('task-wizard-overlay');
  }

  get typeSelect(): Locator {
    return this.page.getByTestId('task-type-select');
  }

  get titleInput(): Locator {
    return this.page.getByTestId('task-title-input');
  }

  get descriptionInput(): Locator {
    return this.page.getByTestId('task-description-input');
  }

  get prioritySelect(): Locator {
    return this.page.getByTestId('task-priority-select');
  }

  get assigneeSelect(): Locator {
    return this.page.getByTestId('task-assignee-select');
  }

  get severitySelect(): Locator {
    return this.page.getByTestId('task-severity-select');
  }

  get nextButton(): Locator {
    return this.page.getByTestId('wizard-next-btn');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('wizard-submit-btn');
  }

  // ── Task list ────────────────────────────────────────────────────────────

  taskCard(title: string): Locator {
    return this.page
      .locator('article')
      .filter({ has: this.page.getByRole('heading', { name: title }) })
      .first();
  }
}
