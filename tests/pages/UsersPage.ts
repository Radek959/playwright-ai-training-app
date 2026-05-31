import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for the Users route (/users)
 * Discovered via Playwright MCP accessibility scan on 2026-05-29
 */
export class UsersPage {
  constructor(private readonly page: Page) {}

  // ── Navigation ──────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/users');
  }

  // ── Page header ─────────────────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Users', level: 1 });
  }

  get subheading(): Locator {
    return this.page.getByText('Manage team members and their roles');
  }

  // ── Add-user form (UserForm component) ──────────────────────────────────────

  get form(): Locator {
    return this.page.locator('form');
  }

  get nameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Nazwa' });
  }

  get emailInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Email' });
  }

  get roleSelect(): Locator {
    return this.page.getByRole('combobox', { name: 'Rola' });
  }

  get avatarUrlInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Avatar URL' });
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Dodaj użytkownika' });
  }

  /**
   * Fill and submit the add-user form in one call.
   * avatarUrl is optional.
   */
  async addUser(
    name: string,
    email: string,
    role: 'Admin' | 'Editor' | 'Viewer',
    avatarUrl?: string
  ) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.roleSelect.selectOption(role);
    if (avatarUrl) {
      await this.avatarUrlInput.fill(avatarUrl);
    }
    await this.submitButton.click();
  }

  // ── Users table (desktop) ────────────────────────────────────────────────────

  get table(): Locator {
    return this.page.getByRole('table');
  }

  get tableHeaderRow(): Locator {
    return this.table.getByRole('row').first();
  }

  get tableRows(): Locator {
    return this.table.getByRole('rowgroup').last().getByRole('row');
  }

  /**
   * Returns the table row that contains the given user name.
   */
  rowByUserName(name: string): Locator {
    return this.table.getByRole('row', { name: new RegExp(name) });
  }

  /**
   * Returns the role badge cell inside the row for a given user name.
   */
  userRoleBadge(name: string): Locator {
    return this.rowByUserName(name).getByRole('cell').nth(2);
  }

  /**
   * Returns the status cell inside the row for a given user name.
   */
  userStatus(name: string): Locator {
    return this.rowByUserName(name).getByRole('cell').nth(3);
  }

  // ── UserAvatar component ─────────────────────────────────────────────────────

  /**
   * Avatar image element (visible when a valid src URL is provided).
   * Scoped to the specific user's table row to avoid strict-mode violations
   * when the same avatar is also rendered in the mobile card view.
   */
  avatarImage(name: string): Locator {
    return this.rowByUserName(name)
      .locator('[data-testid="user-avatar-image"], [data-testid="refactored-user-avatar-image"]');
  }

  /**
   * Avatar fallback initials element (shown when no src or on image error).
   * Scoped to the specific user's table row to avoid strict-mode violations.
   */
  avatarFallback(name: string): Locator {
    return this.rowByUserName(name)
      .locator('[data-testid="user-avatar-fallback"], [data-testid="refactored-user-avatar-fallback"]');
  }

  // ── Sidebar navigation ───────────────────────────────────────────────────────

  get sidebarNav(): Locator {
    return this.page.getByRole('navigation');
  }

  get dashboardNavLink(): Locator {
    return this.page.getByRole('link', { name: 'Dashboard' });
  }

  get tasksNavLink(): Locator {
    return this.page.getByRole('link', { name: 'Tasks' });
  }

  get usersNavLink(): Locator {
    return this.page.getByRole('link', { name: 'Users' });
  }

  /**
   * Sidebar toggle button. Uses data-testid because the text label "Collapse"
   * is hidden when the sidebar is already collapsed, making role+name unreliable.
   */
  get collapseButton(): Locator {
    return this.page.locator('[data-testid="sidebar-toggle"], [data-testid="refactored-sidebar-toggle"]');
  }
}
