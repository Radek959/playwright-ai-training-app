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

📄 **Product documentation for participants:** [`docs/dokumentacja-produktowa.md`](./docs/dokumentacja-produktowa.md) (Polish) describes the application's expected behavior — tasks, users, search, archiving and validation rules — as a source of requirements for writing tests.

Created and maintained by **Radosław Wasik**.

📘 **Learning Playwright?**
Check out the free [Playwright Starter Pack](https://starter.rwasik.pl/) with useful commands, locators, assertions, configuration examples and practical checklists.

---

## Features

* 📋 **Task Management** — Create, edit and organize tasks with priority levels
* 👥 **User Management** — Add and remove team members and view their roles (roles are set when a user is created; there is no UI to edit an existing user's role)
* 📊 **Dashboard** — View statistics and analytics
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

* **Node.js 22.x** (LTS) — the officially supported version, pinned in [`.nvmrc`](./.nvmrc) and `engines.node`
* npm (bundled with Node.js)
* Git

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repository root to pick up the pinned version automatically.

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

A single `npm install` at the repository root installs the root tooling and then automatically installs the dependencies for both `client/` and `server/` (via the `postinstall` script). You do not need to run `npm install` separately inside `client/` or `server/`.

---

## Running the Application

Start the frontend and backend together:

```bash
npm run dev
```

This starts:

* **Frontend (UI):** http://localhost:5173 — open this in your browser
* **Backend (API):** http://localhost:3001 — not a page to open directly; `/` returns `Cannot GET /`. Useful addresses are `/api/health` (health check) and `/api-docs` (Swagger UI)

Open the frontend in your browser:

```text
http://localhost:5173
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

Runs `lint`, `typecheck`, `test` and `build` in sequence. This is the command CI runs to validate the application.

### Client

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test
```

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
3. runs `npm install` (the same install path participants use locally);
4. verifies that `npm install` did not modify any of the three committed lockfiles;
5. runs `npm run check` (lint, typecheck, unit tests, build);
6. starts the application with `npm run dev`;
7. waits for the backend (`http://localhost:3001/api/health`) and the frontend (`http://localhost:5173`) to become available, failing the build if either does not start;
8. stops the application processes.

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
