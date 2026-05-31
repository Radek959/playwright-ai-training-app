import { type Page, type Locator } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  private byTestId(id: string): Locator {
    return this.page.locator(`[data-testid="${id}"], [data-testid="refactored-${id}"]`);
  }

  async goto() {
    await this.page.goto('/');
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Dashboard' });
  }

  get welcomeText(): Locator {
    return this.page.getByText("Welcome back! Here's what's happening today.");
  }

  statCard(label: string): Locator {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.byTestId('stat-card').filter({ hasText: new RegExp(`^\\s*${escapedLabel}\\s*`) });
  }

  get teamOverviewHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Team Overview' });
  }

  get activeMembersText(): Locator {
    return this.byTestId('active-members-count').filter({ hasText: /^\d+ Active Members$/ });
  }

  get teamOverviewSection(): Locator {
    return this.byTestId('team-overview');
  }

  memberName(name: string): Locator {
    return this.teamOverviewSection.getByText(name, { exact: true });
  }

  get taskStatusDistributionHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Task Status Distribution' });
  }

  get distributionSection(): Locator {
    return this.byTestId('task-status-distribution');
  }

  inProgressDistributionRow(): Locator {
    return this.byTestId('status-row-in-progress');
  }
}
