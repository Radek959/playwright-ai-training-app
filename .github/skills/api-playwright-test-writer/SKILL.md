---
name: api-playwright-test-writer
description: "Write Playwright API tests using APIRequestContext and Playwright Test. Use when: writing API tests, testing REST endpoints, testing HTTP requests, creating request context tests, testing API responses, validating status codes, testing authentication, seeding test data via API, writing integration tests for backend endpoints."
argument-hint: "Describe the endpoint or API flow to test (e.g. POST /api/tasks, auth flow, CRUD for users)"
---

# Playwright API Test Writer

## When to Use

- Writing new API tests for REST endpoints
- Adding test coverage for POST / GET / PATCH / DELETE flows
- Testing authentication and authorization via HTTP
- Seeding or tearing down test data through the API
- Validating HTTP status codes and response body fields
- Testing error states (4xx, 5xx) and edge cases

## Procedure

### 1. Analyze the Endpoint

Before writing, identify:
- HTTP method and path
- Required authentication (token, session, none)
- Request body schema and required fields
- Expected response status and body structure
- Data that must exist before the request (preconditions)

### 2. Set Up the Test File

```ts
import { test, expect } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

test.describe('POST /api/tasks', () => {
  let token: string;

  test.beforeEach(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test('creates a task with valid payload', async ({ request }) => {
    const title = `Task-${Date.now()}`;

    await test.step('Send create request', async () => {
      const res = await request.post('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
        data: { title, status: 'todo' },
      });

      expect(res).toBeOK();
      const body = await res.json();
      expect(body.title).toBe(title);
      expect(body.status).toBe('todo');
      expect(body.id).toBeDefined();
    });
  });
});
```

### 3. Selector Priority (API equivalent)

| Concern | Approach |
|---|---|
| Auth | `getAuthToken()` helper — never hardcode tokens |
| Test data | Create via API in `beforeEach`, delete in `afterEach` |
| Unique values | `Date.now()` or `crypto.randomUUID()` to avoid collisions |
| Base URL | Always from `playwright.config.ts` — never hardcode |

### 4. Assertions — Required Order

1. Assert HTTP status first: `expect(res).toBeOK()` or `expect(res.status()).toBe(201)`
2. Parse body: `const body = await res.json()`
3. Assert business-critical fields: `expect(body.title).toBe(...)`, `expect(body.id).toBeDefined()`

Never use `expect(body).toBeTruthy()` alone — always validate specific fields.

### 5. Test Data Lifecycle

```ts
let resourceId: string;

test.beforeEach(async ({ request }) => {
  const res = await request.post('/api/resource', {
    data: { name: `item-${crypto.randomUUID()}` },
  });
  expect(res.status()).toBe(201);
  resourceId = (await res.json()).id;
});

test.afterEach(async ({ request }) => {
  await request.delete(`/api/resource/${resourceId}`);
});
```

### 6. Auth Helper Pattern

```ts
// tests/helpers/auth.ts
import { APIRequestContext, expect } from '@playwright/test';

export async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: {
      email: process.env.TEST_USER_EMAIL ?? 'admin@example.com',
      password: process.env.TEST_USER_PASSWORD ?? 'password',
    },
  });
  expect(res).toBeOK();
  const { token } = await res.json();
  return token as string;
}
```

### 7. Shared APIRequestContext (for suites with many tests)

```ts
import { test, expect, request as playwrightRequest } from '@playwright/test';

test.describe('Tasks API', () => {
  let apiContext: import('@playwright/test').APIRequestContext;

  test.beforeAll(async () => {
    apiContext = await playwrightRequest.newContext({
      baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
      extraHTTPHeaders: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });
});
```

### 8. Error State Testing

```ts
test('returns 404 for non-existent task', async ({ request }) => {
  const res = await request.get('/api/tasks/non-existent-id', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(404);
});

test('returns 401 without auth token', async ({ request }) => {
  const res = await request.get('/api/tasks');
  expect(res.status()).toBe(401);
});
```

## Response Format

Always structure the response in this order:

1. **Flow Analysis** — endpoint, method, auth, preconditions, expected outcome
2. **Test File** — complete runnable file with imports, lifecycle hooks, assertions
3. **Stability & Maintainability Checklist**
4. **Potential Flaky Risks**

### Stability Checklist Template

```
[ ] Uses Playwright request / APIRequestContext — no third-party HTTP clients
[ ] baseURL from playwright.config.ts — no hardcoded hostnames
[ ] No setTimeout / waitForTimeout
[ ] expect(response).toBeOK() used as first status assertion
[ ] Business-critical fields validated in response body
[ ] Test data created and destroyed within the same test scope
[ ] Unique identifiers used (randomUUID / Date.now)
[ ] Auth in helper — no hardcoded credentials
[ ] test.step() labels AAA phases
[ ] One logical scenario per test
```

## Rules

- JavaScript is the default language for test files in this project
- Never use `setTimeout` or arbitrary delays — API calls resolve synchronously
- Never share mutable state between `test` blocks via module-level variables
- Use `test.describe` to group tests for the same endpoint
- Use `test.step()` for every distinct Arrange / Act / Assert phase
- Keep one logical scenario per test — no multi-endpoint assertions in a single test
- Use `expect.soft()` only when validating multiple independent fields in one pass
- Clean up all created resources even when the test fails — use `afterEach`

## Reference Files

- [Operating Principles & Code Examples](../../agents/api-playwright-test-writer.md)
