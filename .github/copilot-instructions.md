# Playwright Test Automation Guidelines

## Core Principles

### Language & Framework
- Write all tests in **JavaScript** (not TypeScript)
- Use **Playwright Test** framework
- Follow **Page Object Model (POM)** architecture

### Test Structure
All tests must follow the **Arrange-Act-Assert (AAA)** pattern:
```javascript
test('should perform action', async ({ page }) => {
  // Arrange - Set up test data and navigate
  const loginPage = new LoginPage(page);
  await page.goto('/login');
  
  // Act - Perform the action
  await loginPage.login('user@example.com', 'password');
  
  // Assert - Verify the result
  await expect(page).toHaveURL('/dashboard');
});
```

## Locator Strategy

### Priority Order (MANDATORY)
1. **getByRole()** - Highest priority, reflects accessibility
2. **getByLabel()** - For form inputs
3. **getByPlaceholder()** - For inputs without labels
4. **getByText()** - For visible text content
5. **getByAltText()** - For images
6. **getByTitle()** - For elements with title attribute
7. **getByTestId()** - Last resort before CSS/XPath

### ⚠️ AVOID Unless Absolutely Necessary
- **CSS Selectors** - Only when no user-facing locator works
- **XPath** - Only as a last resort

### Best Practices
```javascript
// ✅ GOOD - User-facing locators
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email address').fill('user@example.com');
await page.getByText('Welcome back').isVisible();

// ❌ BAD - CSS/XPath selectors
await page.locator('.btn-submit').click();
await page.locator('#email-input').fill('user@example.com');
await page.locator('//div[@class="welcome"]').isVisible();
```

## Page Object Model (POM)

### Structure Requirements
- One Page Object per page or significant component
- Use JSDoc comments for AI readability
- All methods must be async
- Return elements/promises, not values

### Template
```javascript
/**
 * Page Object representing the Login page
 * Handles user authentication flow
 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  constructor(page) {
    this.page = page;
    
    // Define locators as getters
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  /**
   * Performs login with provided credentials
   * @param {string} email - User email address
   * @param {string} password - User password
   * @returns {Promise<void>}
   */
  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Checks if error message is displayed
   * @returns {Promise<boolean>}
   */
  async hasError() {
    return await this.errorMessage.isVisible();
  }

  /**
   * Gets the error message text
   * @returns {Promise<string>}
   */
  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }
}

module.exports = { LoginPage };
```

### JSDoc Requirements
Every Page Object must include:
- Class-level JSDoc describing the page/component
- Constructor JSDoc with @param for page object
- Method JSDoc with:
  - Description of what the method does
  - @param for each parameter
  - @returns for return type

## Assertions

### Rule: ALL assertions MUST be async
Always use `await` with `expect()` for stability and auto-waiting.

```javascript
// ✅ GOOD - Async assertions with auto-waiting
await expect(page.getByRole('heading')).toBeVisible();
await expect(page.getByRole('button')).toBeEnabled();
await expect(page).toHaveURL('/dashboard');
await expect(page.getByText('Success')).toContainText('Success');

// ❌ BAD - Synchronous assertions
expect(true).toBe(true); // Use only for non-Playwright data
```

### Common Assertion Patterns
```javascript
// Visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// State
await expect(element).toBeEnabled();
await expect(element).toBeDisabled();
await expect(element).toBeChecked();

// Content
await expect(element).toHaveText('Expected text');
await expect(element).toContainText('partial text');
await expect(element).toHaveValue('input value');

// Count
await expect(page.getByRole('listitem')).toHaveCount(5);

// URL
await expect(page).toHaveURL('/expected-path');
await expect(page).toHaveURL(/regex-pattern/);
```

## Test Organization

### File Structure
```
tests/
  pages/
    LoginPage.js
    DashboardPage.js
    TasksPage.js
  specs/
    login.spec.js
    dashboard.spec.js
    tasks.spec.js
```

### Test File Template
```javascript
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

test.describe('Login functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    // Arrange
    const loginPage = new LoginPage(page);
    const email = 'user@example.com';
    const password = 'validPassword123';
    
    // Act
    await loginPage.login(email, password);
    
    // Assert
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Arrange
    const loginPage = new LoginPage(page);
    
    // Act
    await loginPage.login('wrong@example.com', 'wrongpass');
    
    // Assert
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });
});
```

## Important Notes

### ID Stability
- **Do NOT worry about IDs changing** - treat data-testid values as stable
- Focus on user-facing locators first, use testId only when necessary

### Environment Configuration
- Default to **false** for all .env feature flags
- Do not account for dynamic code structure changes from .env flags
- Write tests for the default application state

### Waiting & Timing
- Rely on Playwright's auto-waiting mechanism
- Avoid explicit `waitForTimeout()` unless absolutely necessary
- Use `waitForLoadState()` for page transitions
```javascript
await page.waitForLoadState('networkidle');
```

### Error Handling
```javascript
// Use soft assertions for continuing on failure
await expect.soft(element1).toBeVisible();
await expect.soft(element2).toBeVisible();

// Handle expected failures
await expect(async () => {
  await element.click();
}).toPass({ timeout: 5000 });
```

## Common Patterns

### Navigation in POM
```javascript
/**
 * Navigates to the tasks page
 * @returns {Promise<void>}
 */
async goToTasks() {
  await this.page.getByRole('link', { name: 'Tasks' }).click();
  await this.page.waitForURL('**/tasks');
}
```

### Form Handling
```javascript
/**
 * Fills and submits the task form
 * @param {Object} taskData - Task information
 * @param {string} taskData.title - Task title
 * @param {string} taskData.description - Task description
 * @returns {Promise<void>}
 */
async createTask({ title, description }) {
  await this.page.getByLabel('Title').fill(title);
  await this.page.getByLabel('Description').fill(description);
  await this.page.getByRole('button', { name: 'Create' }).click();
}
```

### List Interactions
```javascript
/**
 * Selects a task from the list by title
 * @param {string} taskTitle - Title of the task to select
 * @returns {Promise<void>}
 */
async selectTask(taskTitle) {
  await this.page
    .getByRole('listitem')
    .filter({ hasText: taskTitle })
    .click();
}
```

## Summary Checklist

Before submitting code, verify:
- ✅ Written in JavaScript
- ✅ Follows Page Object Model
- ✅ Uses user-facing locators (getByRole, getByLabel, etc.)
- ✅ All assertions are async with `await expect()`
- ✅ JSDoc comments on all Page Objects and methods
- ✅ Tests follow Arrange-Act-Assert pattern
- ✅ No CSS/XPath unless absolutely necessary
- ✅ Assumes stable testIds and default .env settings
