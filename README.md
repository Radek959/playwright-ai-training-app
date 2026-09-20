# Playwright AI Training App

A training application created for workshops and hands-on sessions focused on **Playwright, API testing and AI-assisted QA**.

The repository is used during live training to practice:

* generating and modifying Playwright E2E tests with AI,
* creating and improving API tests,
* analyzing existing tests and application code,
* working with AI agents in testing workflows,
* improving test quality, stability and maintainability.

The application is intentionally simple to run locally:

```bash
npm install
npm run dev
```

> [!WARNING]
> The application has no authentication or authorization layer. It is designed to be run locally for training purposes only.
> By default, the backend listens only on `127.0.0.1` and the Vite dev server also only accepts connections from the local machine, so nothing is reachable from other devices unless you deliberately open both up.
>
> To expose the app to other devices on your local network:
>
> 1. Start the backend bound to all interfaces: `HOST=0.0.0.0 npm run dev:server` (PowerShell: `$env:HOST="0.0.0.0"; npm run dev:server`). This only opens the API — it does **not** expose the frontend.
> 2. In a separate terminal, start Vite with `--host` so it also accepts LAN connections: `npm run dev:client -- --host`.
> 3. Allow the frontend's LAN origin in CORS with the `ALLOWED_ORIGINS` environment variable when starting the backend, e.g. `HOST=0.0.0.0 ALLOWED_ORIGINS=http://192.168.1.10:5173 npm run dev:server` (PowerShell: `$env:HOST="0.0.0.0"; $env:ALLOWED_ORIGINS="http://192.168.1.10:5173"; npm run dev:server`).
>
> Doing this exposes the application (with no login and no access control) to everyone on your network — only do it on a network you trust, and only for as long as you need it. Do not widen the default `npm run dev` setup, which stays local-only.

📄 **Product documentation:** [`docs/dokumentacja-produktowa.md`](./docs/dokumentacja-produktowa.md) (Polish) describes the application's expected behavior — tasks, users, search, archiving and validation rules.

Created and maintained by **Radosław Wasik**.

📘 **Learning Playwright?**
Check out the free [Playwright Starter Pack](https://starter.rwasik.pl/) with useful commands, locators, assertions, configuration examples and practical checklists.

---

## Features

* 📋 **Task Management** — Create, edit and organize tasks with priority levels, due dates, tags and dependencies
* 👥 **User Management** — Add, edit and remove team members, including their role
* 🔍 **Search** — Find tasks by title, description, tags or assignee and jump straight to their details
* ✅ **Approval Workflow** — Mark a task as requiring approval and record an approve/reject decision with an optional comment
* 💬 **Comments** — Discuss a task with a flat, chronological, author-attributed comment list
* 🕒 **Activity History** — See a per-task audit trail of what changed and when
* 🔗 **Dependencies** — Link tasks together and block completion until their dependencies are done
* 📊 **Dashboard** — Linked statistics and analytics that jump straight to the matching filtered task list
* 🎨 **Modern UI** — Responsive interface built with Tailwind CSS
* 🔄 **Dynamic Data Management** — Application state handled with React
* 📱 **Responsive Design** — Works across desktop and mobile devices
* 🔌 **REST API** — Backend endpoints available for API testing
* 📚 **Swagger Documentation** — Interactive API documentation

---

## Tech Stack

### Frontend

* React 18
* TypeScript
* React Router
* Tailwind CSS
* Vite

### Backend

* Node.js
* Express
* TypeScript
* Swagger UI

---

## Prerequisites

Before running the application, make sure you have installed:

* **Node.js 22.12+ (22.x) or 24.x** — both LTS lines are supported; CI installs and checks the project on each of them, on Linux, Windows and macOS. [`.nvmrc`](./.nvmrc) pins the recommended version, and `engines.node` declares the supported range. Node 20 and older will not work: the application itself starts, but the unit tests do not run.
* npm (bundled with Node.js)
* Git

Check what you have before installing anything:

```bash
node -v
npm -v
git --version
```

If you use [nvm](https://github.com/nvm-sh/nvm) on macOS or Linux, run `nvm use` in the repository root to pick up the recommended version automatically. [nvm-windows](https://github.com/coreybutler/nvm-windows) does not read `.nvmrc`, so name the version explicitly: `nvm use 22.23.2`.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/Radek959/playwright-ai-training-app.git
cd playwright-ai-training-app
```

Install dependencies:

```bash
npm install
```

A single `npm install` at the repository root installs the root tooling and then automatically installs the dependencies for both `client/` and `server/` (via the `postinstall` script, which delegates to [`scripts/npm-in.mjs`](./scripts/npm-in.mjs)). You do not need to run `npm install` separately inside `client/` or `server/`.

---

## Running the Application

Start the frontend and backend together:

```bash
npm run dev
```

This starts:

* **Frontend (UI):** http://localhost:5173 — open this in your browser
* **Backend (API):** http://localhost:3001 — not a page to open directly; `/` returns `Cannot GET /`. Useful addresses are `/api/health` (health check) and `/api-docs` (Swagger UI)

> **Ports must be free:** the backend needs port `3001` and the frontend needs port `5173`. The app does not automatically pick a different port if one is busy. If startup fails because a port is in use, stop the process using that port and run `npm run dev` again.

Open the frontend in your browser:

```text
http://localhost:5173
```

---

## Stopping the Application

Press **Ctrl+C** in the terminal running `npm run dev`. This stops both the backend and the frontend.

Closing the terminal window (or killing it from Task Manager) can leave the `node` processes running in the background, still holding ports `3001` and `5173`. If the next `npm run dev` complains that a port is in use, free it:

```powershell
# Windows (PowerShell or CMD)
netstat -ano | findstr ":3001 :5173"
taskkill /PID <pid> /F
```

```bash
# macOS / Linux
lsof -i :3001 -i :5173
kill <pid>
```

---

## Running Client and Server Separately

Start only the backend:

```bash
npm run dev:server
```

Start only the frontend:

```bash
npm run dev:client
```

---

## API Documentation

After starting the backend, Swagger documentation is available at:

```text
http://localhost:3001/api-docs
```

You can use it to explore the API, inspect endpoints and send requests directly from the browser.

A basic health check endpoint is also available at:

```text
http://localhost:3001/api/health
```

---

## Data Persistence

The application does not use a database. Tasks and users are stored in memory on the backend and are seeded with fixed sample data on startup. Any changes made through the UI or API (creating, editing or deleting tasks and users) are lost when the backend restarts, and the original sample data is restored.

---

## Troubleshooting

Start by collecting this — it answers most questions at once:

```bash
node -v
npm -v
git --version
```

**Wrong Node.js version.** `npm install` only prints an `EBADENGINE` warning and carries on, so an unsupported version shows up later as a confusing failure. Node 22.12+ (22.x) and 24.x are supported; on Node 20 the application starts but `npm run test` fails inside jsdom. Switch versions with `nvm use` (on Windows, nvm-windows needs the version spelled out: `nvm use 22.23.2`) or install a supported release.

**A port is already in use.** The backend needs `3001` and the frontend needs `5173`; neither falls back to another port. The backend now says so explicitly and stops; Vite reports `Port 5173 is already in use`. Free the port using the commands in [Stopping the Application](#stopping-the-application) — the culprit is usually a leftover `node` process from an earlier run.

**Incomplete or broken installation.** If `npm run dev` cannot find a package, reinstall from scratch:

```bash
rm -rf node_modules client/node_modules server/node_modules
npm install
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules, client/node_modules, server/node_modules
npm install
```

Only if that still fails, clear the npm cache (`npm cache clean --force`) and repeat. The cache is rarely the cause, and clearing it makes the next install slower for every project on the machine.

**The install downloads blocked binaries.** Installation fetches prebuilt native binaries (`esbuild`, `rolldown`, `lightningcss`). Corporate antivirus or a proxy can block them, which shows up as a download or integrity error. Try a different network before debugging the repository.

**`git status` shows a modified `package-lock.json` after installing.** This is expected and harmless: some lockfile metadata depends on the npm version you have. Leave it as it is, or restore just those files:

```bash
git restore package-lock.json client/package-lock.json server/package-lock.json
```

Check `git status` first and only run this when the lockfiles are the *only* changes listed. Never use `git checkout -- .` for this — it would also throw away the tests and code you wrote during the workshop.

**The backend did not start.** Open http://localhost:3001/api/health. `{"status":"ok"}` means it is running. If there is no response, scroll the terminal **up**, past the Vite banner — the backend's error is printed above it.

**The frontend did not start.** The terminal must show `VITE … ready`. If the page does not load, check that line first; if it is missing, the frontend never started.

**The UI loads but shows no data.** That means the frontend is up and the backend is not. Open the browser DevTools (F12) → Network, reload, and look at `/api/tasks`. A failed request there points back to the backend — see the two entries above. A single 404 on `favicon.ico` is normal and harmless.

---

## Project Structure

```text
playwright-ai-training-app/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── routes/
│   │   └── styles/
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── data.ts
│   │   └── index.ts
│   └── package.json
│
└── package.json
```

---

## Available Scripts

### Root

```bash
npm run dev
```

Runs both the frontend and backend.

```bash
npm run dev:server
```

Runs only the backend.

```bash
npm run dev:client
```

Runs only the frontend.

```bash
npm run install:all
```

Installs dependencies for both parts of the application.

```bash
npm run build
```

Builds both the server and the client for production.

```bash
npm run lint
```

Runs ESLint against both `client/src` and `server/src`.

```bash
npm run typecheck
```

Runs the TypeScript compiler (no emit) for both the client and the server.

```bash
npm run test
```

Runs the Vitest unit test suites for both the server (business-logic and validation functions) and the client (no Playwright/browser tests).

```bash
npm run check
```

Runs the module-name collision check, `lint`, `typecheck`, the unit tests (application and scripts) and `build` in sequence. This is the command CI runs to validate the application.

### Client

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run test
```

Lint the whole repository from the root with `npm run lint`.

### Server

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run test
```

---

## Continuous Integration

Every push and pull request targeting `main` runs the [`CI` workflow](./.github/workflows/ci.yml), which:

1. checks out the repository;
2. sets up Node.js using the version pinned in `.nvmrc`;
3. installs dependencies with separate, lockfile-respecting installs — `npm ci --ignore-scripts` at the root, `npm ci --prefix server` and `npm ci --prefix client` (this is not the same as the single `npm install` participants run locally; see [Installation](#installation));
4. verifies that the install did not modify any of the three committed lockfiles;
5. runs `npm run audit:all` (security audit);
6. runs `npm run check` (module-name collision check, lint, typecheck, unit tests, build);
7. starts the application with `npm run dev`;
8. waits for the backend (`http://localhost:3001/api/health`) and the frontend (`http://localhost:5173`) to become available, failing the build if either does not start;
9. stops the application processes.

A second job, `Clean install`, runs the participant's own path — a clean checkout, `npm install` (not `npm ci`), `npm run check` and finally [`scripts/ci-smoke.mjs`](./scripts/ci-smoke.mjs), which starts the application with `npm run dev`, checks that the backend and the frontend both answer, stops it and verifies that both ports were released — across a matrix of `ubuntu-latest`, `windows-latest` and `macos-latest` (Apple Silicon), each on Node 22 and Node 24. That job deliberately does not assert that the lockfiles are unchanged: npm rewrites some platform metadata depending on its own version, which is expected locally too (see [Troubleshooting](#troubleshooting)).

This workflow intentionally does not run Playwright or install browsers — end-to-end tests are written by participants during the training and are not part of this baseline.

---

## Training Use

This repository is primarily intended for educational purposes.

It may be used during workshops, conference training sessions and hands-on exercises related to:

* Playwright,
* end-to-end test automation,
* API testing,
* AI-assisted software testing,
* AI agents,
* test refactoring,
* test review and analysis.

Some training scenarios may use dedicated branches containing different versions or states of the application.

If you are attending a workshop, follow the instructions provided by the trainer regarding which branch to use.

---

## More Resources

### 📘 Playwright Starter Pack

A free collection of practical Playwright materials, including commands, locators, assertions, configuration examples and checklists.

[Playwright Starter Pack →](https://starter.rwasik.pl/)

### 🤖 Prompt Hub for QA

A free collection of practical AI prompts for software testers and QA engineers.

Prompts cover areas such as:

* test case generation,
* exploratory testing,
* requirements analysis,
* regression scope,
* risk-based testing,
* Playwright,
* code review,
* DevTools analysis.

[Prompt Hub for QA →](https://prompty.rwasik.pl/)

---

## About the Author

This project is created and maintained by **Radosław Wasik** — QA Tech Lead, trainer and software testing practitioner focused on test automation, Playwright and practical use of AI in QA.

* 🌐 [rwasik.pl](https://rwasik.pl/)
* 💼 [LinkedIn](https://www.linkedin.com/in/rwasik/)
* 📸 [Instagram](https://instagram.com/radwasik)

---

## Usage

This project is intended primarily for educational, workshop and training purposes.
