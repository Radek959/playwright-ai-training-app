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

Created and maintained by **Radosław Wasik**.

📘 **Learning Playwright?**
Check out the free [Playwright Starter Pack](https://starter.rwasik.pl/) with useful commands, locators, assertions, configuration examples and practical checklists.

---

## Features

* 📋 **Task Management** — Create, edit and organize tasks with priority levels
* 👥 **User Management** — Manage team members with avatars and roles
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

* Node.js
* npm
* Git

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

The root installation automatically installs dependencies required by both the client and server.

---

## Running the Application

Start the frontend and backend together:

```bash
npm run dev
```

This starts:

* **Backend:** http://localhost:3001
* **Frontend:** http://localhost:5173

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

After starting the application, Swagger documentation is available at:

```text
http://localhost:3001/api-docs
```

You can use it to explore the API, inspect endpoints and send requests directly from the browser.

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

### Client

```bash
npm run dev
npm run build
npm run preview
```

### Server

```bash
npm run dev
npm run build
npm start
```

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
