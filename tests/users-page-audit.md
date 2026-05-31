# Users Page – Component & Interaction Audit

> Scanned via Playwright MCP accessibility snapshot on **2026-05-29**  
> Base URL: `http://localhost:5173/users`  
> Source files reviewed: `client/src/routes/Users.tsx`, `client/src/components/UserForm.tsx`, `client/src/components/UserAvatar.tsx`, `client/src/utils/testIds.ts`, `server/src/routes/users.ts`

---

## 1. Page Structure Overview

```
/users
├── Sidebar (complementary)
│   ├── App logo / home link
│   ├── Navigation links (Dashboard, Tasks, Users [active])
│   └── Collapse button
└── Main content
    ├── Page header
    │   ├── Heading: "Users"
    │   └── Subheading: "Manage team members and their roles"
    ├── Add-user form card  ← UserForm component
    │   ├── Name input (required)
    │   ├── Email input (required, type="email")
    │   ├── Role select (Admin | Editor | Viewer, default: Viewer)
    │   ├── Avatar URL input (optional)
    │   └── Submit button "Dodaj użytkownika"
    └── Users table  ← desktop (md+)
        ├── Header row: User | Email | Role | Status
        └── Data rows (one per user)
            ├── UserAvatar + Name cell
            ├── Email cell
            ├── Role badge cell (colour-coded)
            └── Status cell (Active indicator)
```

> **Responsive note:** On mobile (`< md`) the table is replaced by stacked card components. On desktop the Email column can be hidden with `VITE_HIDDEN_ON_MOBILE=true` (lg breakpoint), and Status can be hidden at xl breakpoint.

---

## 2. Interactive Element Map

| # | Element | Role / Type | Locator (Playwright) | Notes |
|---|---------|-------------|----------------------|-------|
| 1 | App home link | `link` | `getByRole('link', { name: 'P Playwright Training App' })` | Navigates to `/` |
| 2 | Dashboard nav link | `link` | `getByRole('link', { name: 'Dashboard' })` | Navigates to `/` |
| 3 | Tasks nav link | `link` | `getByRole('link', { name: 'Tasks' })` | Navigates to `/tasks` |
| 4 | Users nav link | `link` | `getByRole('link', { name: 'Users' })` | Current page; has `[active]` attribute |
| 5 | Collapse sidebar button | `button` | `getByRole('button', { name: 'Collapse' })` | Toggles sidebar width |
| 6 | Name input | `textbox` | `getByRole('textbox', { name: 'Nazwa' })` | Required; clears after successful submit |
| 7 | Email input | `textbox` | `getByRole('textbox', { name: 'Email' })` | `type="email"`, required; browser-validated |
| 8 | Role select | `combobox` | `getByRole('combobox', { name: 'Rola' })` | Options: Admin, Editor, Viewer (default) |
| 9 | Avatar URL input | `textbox` | `getByRole('textbox', { name: 'Avatar URL' })` | Optional; accepts any URL string |
| 10 | Submit button | `button` | `getByRole('button', { name: 'Dodaj użytkownika' })` | `type="submit"` |
| 11 | Table rows (existing users) | `row` | `getByRole('table').getByRole('row')` | Read-only; no built-in row actions |

---

## 3. Component Inventory

### 3.1 `UserForm` (`client/src/components/UserForm.tsx`)

| Property | Detail |
|----------|--------|
| Fields | Name (`required`), Email (`type="email"`, `required`), Role (select), Avatar URL (optional) |
| Submission | `POST /api/users` (or `/api/users?lab_api_flaky=true` when lab flag is on) |
| Body | `{ name, email, role, avatar }` |
| On success | Calls `onCreated(user)` → prepends user to table; resets all fields |
| On error | Calls `setLastError()` from `LabContext` |
| `data-testid` | None – locators must rely on roles/labels |

### 3.2 `UserAvatar` (`client/src/components/UserAvatar.tsx`)

| Property | Detail |
|----------|--------|
| Behaviour | Renders `<img>` when valid `src` is provided; falls back to initials div on error or missing src |
| Initials | First letter of each name word, max 2 characters, uppercase |
| Background | Deterministic gradient colour based on `charCodeAt` sum mod 6 |
| `data-testid` (image) | `user-avatar-image` / `refactored-user-avatar-image` (VITE_REFACTOR_SELECTORS flag) |
| `data-testid` (fallback) | `user-avatar-fallback` / `refactored-user-avatar-fallback` |
| Sizes | `sm` (w-8/h-8), `md` (w-10/h-10), `lg` (w-12/h-12), `xl` (w-16/h-16) |

### 3.3 Users table (`client/src/routes/Users.tsx`)

| Property | Detail |
|----------|--------|
| Columns | User (avatar + name), Email, Role (badge), Status (hardcoded "Active") |
| Role badge colours | admin → purple, editor → blue, viewer → grey |
| Status indicator | Green dot + "Active" text; currently all users always show Active |
| `data-testid` | None on table elements – use semantic role/text selectors |
| Visibility flags | `VITE_HIDDEN_ON_MOBILE=true` hides Email at `<lg` and Status at `<xl` |

### 3.4 Server API (`server/src/routes/users.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | Returns all users array |
| `/api/users` | POST | Creates user; validates `name` and `email` required; normalises unknown roles to `viewer` |
| `/api/users/:id` | DELETE | Deletes user; returns **409** if user has active (non-done) tasks |

---

## 4. Usage Paths

### UP-01 – View existing users
1. Navigate to `/users` via sidebar or direct URL.
2. Page loads user list from `GET /api/users`.
3. Users are rendered in the table (desktop) or cards (mobile).

### UP-02 – Add a new user (happy path)
1. Fill **Name** field.
2. Fill **Email** field (valid email format).
3. Select **Role** (optional; defaults to Viewer).
4. (Optional) Fill **Avatar URL**.
5. Click **Dodaj użytkownika**.
6. `POST /api/users` is called with form data.
7. On `201` response: new user is prepended to the table, all form fields are cleared.

### UP-03 – Form validation – missing Name
1. Leave **Name** empty, fill Email, click submit.
2. Browser native validation blocks submission (field marked invalid).

### UP-04 – Form validation – missing Email
1. Fill Name, leave **Email** empty, click submit.
2. Browser native validation blocks submission.

### UP-05 – Form validation – invalid email format
1. Fill Name, type a non-email string in **Email**, click submit.
2. Browser native `type="email"` validation blocks submission.

### UP-06 – Add user with avatar URL
1. Fill Name, Email, select Role.
2. Enter a valid image URL in **Avatar URL**.
3. Click submit.
4. New table row shows `<img>` avatar instead of initials fallback.

### UP-07 – Add user without avatar URL (initials fallback)
1. Fill Name, Email, select Role; leave Avatar URL empty.
2. Click submit.
3. New table row shows initials avatar (gradient background).

### UP-08 – API flaky mode (Lab setting)
1. Enable **API Flaky** toggle in Lab Settings.
2. Any form submission or page load appends `?lab_api_flaky=true` to API calls.
3. Server may respond with intermittent errors; error is surfaced via LabContext.

### UP-09 – Navigate away and back
1. Click **Dashboard** or **Tasks** nav link.
2. Return to **Users** via nav link.
3. State is re-fetched; form fields are empty.

### UP-10 – Collapse sidebar
1. Click **Collapse** button in the sidebar.
2. Sidebar collapses to icon-only mode; main content area expands.
3. Table remains functional.

---

## 5. Page Object Model

The POM is generated at [`tests/pages/UsersPage.ts`](../tests/pages/UsersPage.ts).

### Quick reference

```typescript
import { UsersPage } from './pages/UsersPage';

const usersPage = new UsersPage(page);

// Navigate
await usersPage.goto();

// Add user
await usersPage.addUser('Jane Doe', 'jane@example.com', 'Editor');

// Assert user appears in table
await expect(usersPage.rowByUserName('Jane Doe')).toBeVisible();
await expect(usersPage.userRoleBadge('Jane Doe')).toContainText('editor');
await expect(usersPage.userStatus('Jane Doe')).toContainText('Active');

// Check avatar fallback (no URL given)
await expect(usersPage.avatarFallback('Jane Doe')).toBeVisible();

// Form fields cleared after submit
await expect(usersPage.nameInput).toHaveValue('');
await expect(usersPage.emailInput).toHaveValue('');

// Sidebar
await usersPage.collapseButton.click();
```

### POM method summary

| Method / Getter | Returns | Description |
|-----------------|---------|-------------|
| `goto()` | `Promise<void>` | Navigates to `/users` |
| `heading` | `Locator` | H1 "Users" |
| `subheading` | `Locator` | Subtitle paragraph |
| `form` | `Locator` | The `<form>` element |
| `nameInput` | `Locator` | Name text field |
| `emailInput` | `Locator` | Email text field |
| `roleSelect` | `Locator` | Role `<select>` |
| `avatarUrlInput` | `Locator` | Avatar URL text field |
| `submitButton` | `Locator` | Submit button |
| `addUser(name, email, role, avatarUrl?)` | `Promise<void>` | Fills and submits the form |
| `table` | `Locator` | Users `<table>` |
| `tableRows` | `Locator` | All data rows (tbody) |
| `rowByUserName(name)` | `Locator` | Single row matching name |
| `userRoleBadge(name)` | `Locator` | Role badge cell for user |
| `userStatus(name)` | `Locator` | Status cell for user |
| `avatarImage(name)` | `Locator` | Avatar `<img>` with `data-testid` |
| `avatarFallback(name)` | `Locator` | Initials fallback div with `data-testid` |
| `sidebarNav` | `Locator` | `<nav>` element |
| `dashboardNavLink` | `Locator` | Dashboard link |
| `tasksNavLink` | `Locator` | Tasks link |
| `usersNavLink` | `Locator` | Users link |
| `collapseButton` | `Locator` | Collapse sidebar button |

---

## 6. Observations & Recommendations

| # | Observation | Recommendation |
|---|-------------|----------------|
| O-01 | No `data-testid` attributes on the form fields or table cells | Add `data-testid` attributes to improve selector stability (use `getTestId` utility already present in the codebase) |
| O-02 | Form labels are in Polish (`Nazwa`, `Rola`, etc.) while the app UI language is English | Align form labels with the rest of the UI for consistency |
| O-03 | Role select default is `viewer` in state but displayed as "Viewer" – server normalises unknown roles to `viewer` | Covered; no action needed |
| O-04 | `DELETE /api/users/:id` endpoint exists on the server but the UI provides no delete button | If delete functionality is planned, add a row action button with a `data-testid` |
| O-05 | Status column is always "Active" (hardcoded in template) | Consider adding a `status` field to the data model or removing the column if it carries no information |
| O-06 | `VITE_REFACTOR_SELECTORS=true` changes `data-testid` prefixes – `UserAvatar` handles this, but form/table have none | POM uses dual-selector pattern `[data-testid="…"], [data-testid="refactored-…"]` for `UserAvatar`; extend this when IDs are added elsewhere |
