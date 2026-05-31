import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001';

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const;

test.describe('GET /api/users', () => {
  test('returns 200 OK', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);

    expect(res.status()).toBe(200);
  });

  test('returns a JSON array', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    const body = await res.json();

    expect(Array.isArray(body)).toBe(true);
  });

  test('returns at least one user', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    const body = await res.json();

    expect(body.length).toBeGreaterThan(0);
  });

  test('each user has required fields: id, name, email, role', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    const body = await res.json();

    for (const user of body) {
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');

      expect(user.name).toBeDefined();
      expect(typeof user.name).toBe('string');

      expect(user.email).toBeDefined();
      expect(typeof user.email).toBe('string');

      expect(user.role).toBeDefined();
      expect(typeof user.role).toBe('string');
    }
  });

  test('each user has a valid role value', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    const body = await res.json();

    for (const user of body) {
      expect(VALID_ROLES).toContain(user.role);
    }
  });

  test('returns seed users with correct data', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    const body = await res.json();

    const alice = body.find((u: { id: string }) => u.id === 'u1');
    expect(alice).toBeDefined();
    expect(alice.name).toBe('Alice Johnson');
    expect(alice.email).toBe('alice@example.com');
    expect(alice.role).toBe('admin');

    const bob = body.find((u: { id: string }) => u.id === 'u2');
    expect(bob).toBeDefined();
    expect(bob.name).toBe('Bob Smith');
    expect(bob.email).toBe('bob@example.com');
    expect(bob.role).toBe('editor');

    const diana = body.find((u: { id: string }) => u.id === 'u4');
    expect(diana).toBeDefined();
    expect(diana.name).toBe('Diana Martinez');
    expect(diana.email).toBe('diana@example.com');
    expect(diana.role).toBe('viewer');
  });
});

test.describe('POST /api/users', () => {
  let createdUserId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (createdUserId) {
      await request.delete(`${API_URL}/api/users/${createdUserId}`);
      createdUserId = undefined;
    }
  });

  test('creates a user with all fields and returns 201', async ({ request }) => {
    const payload = {
      name: `Test User ${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      role: 'editor',
    };

    const res = await request.post(`${API_URL}/api/users`, { data: payload });

    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserId = body.id;

    expect(body.id).toBeDefined();
    expect(body.name).toBe(payload.name);
    expect(body.email).toBe(payload.email);
    expect(body.role).toBe('editor');
  });

  test('creates a user with only required fields (name + email)', async ({ request }) => {
    const payload = {
      name: `Minimal User ${Date.now()}`,
      email: `minimal-${Date.now()}@example.com`,
    };

    const res = await request.post(`${API_URL}/api/users`, { data: payload });

    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserId = body.id;

    expect(body.id).toBeDefined();
    expect(body.name).toBe(payload.name);
    expect(body.email).toBe(payload.email);
  });

  test('defaults role to "viewer" when role is not provided', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/users`, {
      data: {
        name: `Viewer Default ${Date.now()}`,
        email: `viewer-${Date.now()}@example.com`,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserId = body.id;

    expect(body.role).toBe('viewer');
  });

  test('defaults role to "viewer" when role has an invalid value', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/users`, {
      data: {
        name: `Invalid Role ${Date.now()}`,
        email: `invalid-role-${Date.now()}@example.com`,
        role: 'superadmin',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserId = body.id;

    expect(body.role).toBe('viewer');
  });

  test('returns 400 when name is missing', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/users`, {
      data: { email: 'no-name@example.com' },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('name is required');
  });

  test('returns 400 when email is missing', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/users`, {
      data: { name: 'No Email User' },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('email is required');
  });
});
