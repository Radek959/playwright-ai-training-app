import { test, expect, type Page } from '@playwright/test';
import { UsersPage } from './pages/UsersPage';

// ─── Shared seed data ─────────────────────────────────────────────────────────

const USERS_MOCK = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 'u2', name: 'Bob Smith',     email: 'bob@example.com',   role: 'editor' },
  { id: 'u3', name: 'Charlie Davis', email: 'charlie@example.com', role: 'viewer' },
];

/**
 * Registers a route stub for GET /api/users that returns USERS_MOCK.
 * Non-GET requests fall through to the next matching route handler via fallback(),
 * which lets individual tests stack a POST stub on top without conflicts.
 */
async function stubGetUsers(page: Page, users = USERS_MOCK): Promise<void> {
  await page.route('**/api/users', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(users),
      });
    } else {
      await route.fallback();
    }
  });
}

// ─── UP-01: Page structure ────────────────────────────────────────────────────

test.describe('Users – page structure (UP-01)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGetUsers(page);
  });

  test('should display page heading and subheading', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await expect(usersPage.heading).toBeVisible();
    await expect(usersPage.subheading).toBeVisible();
  });

  test('should render all existing users in the table', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await expect(usersPage.table).toBeVisible();
    await expect(usersPage.rowByUserName('Alice Johnson')).toBeVisible();
    await expect(usersPage.rowByUserName('Bob Smith')).toBeVisible();
    await expect(usersPage.rowByUserName('Charlie Davis')).toBeVisible();
  });

  test('should display correct role badges for each user', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await expect(usersPage.userRoleBadge('Alice Johnson')).toContainText('admin');
    await expect(usersPage.userRoleBadge('Bob Smith')).toContainText('editor');
    await expect(usersPage.userRoleBadge('Charlie Davis')).toContainText('viewer');
  });

  test('should show Active status for every listed user', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await expect(usersPage.userStatus('Alice Johnson')).toContainText('Active');
    await expect(usersPage.userStatus('Bob Smith')).toContainText('Active');
    await expect(usersPage.userStatus('Charlie Davis')).toContainText('Active');
  });
});

// ─── UP-02: Add user (happy path) ────────────────────────────────────────────

test.describe('Users – add user (UP-02)', () => {
  const NEW_USER = {
    id: 'u-4',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'editor',
  };

  test.beforeEach(async ({ page }) => {
    // GET stub registered first; POST stub registered second (LIFO – checked first).
    // GET request flow: POST stub → fallback() → GET stub → fulfill
    // POST request flow: POST stub → fulfill
    await stubGetUsers(page);
    await page.route('**/api/users', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(NEW_USER),
        });
      } else {
        await route.fallback();
      }
    });
  });

  test('should prepend the new user to the table with correct role and status', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.addUser(NEW_USER.name, NEW_USER.email, 'Editor');

    await expect(usersPage.rowByUserName(NEW_USER.name)).toBeVisible();
    await expect(usersPage.userRoleBadge(NEW_USER.name)).toContainText('editor');
    await expect(
      usersPage.userStatus(NEW_USER.name),
      'Newly created user should show Active status',
    ).toContainText('Active');
  });

  test('should clear all form fields after successful submission', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.addUser(NEW_USER.name, NEW_USER.email, 'Editor');

    await expect(usersPage.nameInput,     'Name input should be cleared').toHaveValue('');
    await expect(usersPage.emailInput,    'Email input should be cleared').toHaveValue('');
    await expect(usersPage.roleSelect,    'Role select should reset to viewer').toHaveValue('viewer');
    await expect(usersPage.avatarUrlInput,'Avatar URL input should be cleared').toHaveValue('');
  });

  test('should send correct JSON payload to POST /api/users', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/users') && r.method() === 'POST'),
      usersPage.addUser(NEW_USER.name, NEW_USER.email, 'Editor'),
    ]);

    const body = request.postDataJSON() as Record<string, string>;
    expect(body.name).toBe(NEW_USER.name);
    expect(body.email).toBe(NEW_USER.email);
    expect(body.role).toBe('editor');
  });
});

// ─── UP-06 / UP-07: Avatar display ───────────────────────────────────────────

test.describe('Users – avatar display (UP-06 / UP-07)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGetUsers(page);
  });

  test('UP-07 – should show initials fallback when no avatar URL is supplied', async ({ page }) => {
    await page.route('**/api/users', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'u-4',
            name: 'Jane Doe',
            email: 'jane@example.com',
            role: 'viewer',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.addUser('Jane Doe', 'jane@example.com', 'Viewer');

    await expect(
      usersPage.avatarFallback('Jane Doe'),
      'Initials fallback "JD" should be visible when no avatar URL is given',
    ).toBeVisible();
  });

  test('UP-06 – should show avatar image when a valid URL is supplied', async ({ page }) => {
    // Use a data-URI so the image always loads without any external network dependency.
    const inlineAvatar =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await page.route('**/api/users', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'u-4',
            name: 'Jane Doe',
            email: 'jane@example.com',
            role: 'viewer',
            avatar: inlineAvatar,
          }),
        });
      } else {
        await route.fallback();
      }
    });

    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.addUser('Jane Doe', 'jane@example.com', 'Viewer', inlineAvatar);

    await expect(
      usersPage.avatarImage('Jane Doe'),
      'Avatar <img> element should be rendered when an avatar URL is provided',
    ).toBeVisible();
  });
});

// ─── UP-03 / UP-04 / UP-05: Browser-level form validation ───────────────────

test.describe('Users – form validation (UP-03 / UP-04 / UP-05)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGetUsers(page);
  });

  test('UP-03 – should block submission when Name is empty', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.emailInput.fill('test@example.com');
    await usersPage.submitButton.click();

    // A successful submit resets all fields. If the email still has its value,
    // native HTML validation blocked the submit before the handler ever ran.
    await expect(
      usersPage.emailInput,
      'Email should not be cleared – form submission was blocked by required Name',
    ).toHaveValue('test@example.com');
    await expect(page).toHaveURL('/users');
  });

  test('UP-04 – should block submission when Email is empty', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.nameInput.fill('Test User');
    await usersPage.submitButton.click();

    await expect(
      usersPage.nameInput,
      'Name should not be cleared – form submission was blocked by required Email',
    ).toHaveValue('Test User');
    await expect(page).toHaveURL('/users');
  });

  test('UP-05 – should block submission when Email format is invalid', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.nameInput.fill('Test User');
    await usersPage.emailInput.fill('not-an-email');
    await usersPage.submitButton.click();

    await expect(
      usersPage.nameInput,
      'Name should not be cleared – form submission was blocked by invalid email',
    ).toHaveValue('Test User');
    await expect(
      usersPage.emailInput,
      'Email should retain the invalid value',
    ).toHaveValue('not-an-email');
    await expect(page).toHaveURL('/users');
  });
});

// ─── UP-09 / UP-10: Navigation and sidebar ───────────────────────────────────

test.describe('Users – navigation and sidebar (UP-09 / UP-10)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGetUsers(page);
  });

  test('UP-09 – should navigate to Dashboard and back with a clean form', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await expect(usersPage.heading).toBeVisible();

    await usersPage.dashboardNavLink.click();
    await expect(page).toHaveURL('/');

    await usersPage.usersNavLink.click();
    await page.waitForURL('/users');

    await expect(usersPage.heading).toBeVisible();
    await expect(usersPage.nameInput).toHaveValue('');
  });

  test('UP-10 – should collapse sidebar while keeping the table accessible', async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    await usersPage.collapseButton.click();

    await expect(
      usersPage.table,
      'Table must remain visible after sidebar is collapsed',
    ).toBeVisible();

    await usersPage.collapseButton.click();
    await expect(usersPage.dashboardNavLink).toBeVisible();
  });
});
