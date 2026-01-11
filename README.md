# AI Training Sandbox

A full-stack task management application built with React, TypeScript, Express, and Tailwind CSS. This project serves as a training sandbox for testing and experimenting with AI-powered development tools and Playwright automation.

## Features

- 📋 **Task Management** - Create, edit, and organize tasks with priority levels
- 👥 **User Management** - Manage team members with avatars and roles
- 📊 **Dashboard** - View statistics and analytics at a glance
- 🎨 **Modern UI** - Beautiful responsive design with Tailwind CSS
- 🔄 **Real-time Updates** - Dynamic data management with React hooks
- 📱 **Mobile Responsive** - Fully responsive design for all devices

## Tech Stack

**Frontend:**
- React 18.3
- TypeScript
- React Router
- Tailwind CSS
- Vite

**Backend:**
- Node.js
- Express
- TypeScript
- Swagger UI (API documentation)

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd playwright-ai-training-app
```

2. Install dependencies for both client and server:
```bash
npm install
```

This will automatically install dependencies for both the client and server using the postinstall script.

Alternatively, you can install them separately:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

## Running the Application

### Development Mode

Run both the client and server concurrently:
```bash
npm run dev
```

This will start:
- **Backend server** on `http://localhost:3000`
- **Frontend client** on `http://localhost:5173`

### Run Separately

**Start the server only:**
```bash
npm run dev:server
```

**Start the client only:**
```bash
npm run dev:client
```

## Configuration

The client application uses environment variables for feature flags. Create or modify the `.env` file in the `client` directory:

```env
# Change data-testid and element IDs (simulates refactoring)
VITE_REFACTOR_SELECTORS=false

# Change layout from list to grid + add action dropdown
VITE_REFACTOR_LAYOUT=false

# Change API field names (title→name, description→content)
VITE_API_VERSION_2=false

# Enable API flakiness for testing error handling
VITE_API_FLAKY=false

# Hide labels on mobile devices
VITE_HIDDEN_ON_MOBILE=false
```

## API Documentation

Once the server is running, you can access the Swagger API documentation at:
```
http://localhost:3000/api-docs
```

## Project Structure

```
ai-training-sandbox/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable React components
│   │   ├── context/     # React context providers
│   │   ├── routes/      # Route components (pages)
│   │   └── styles/      # Global styles
│   └── package.json
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── data.ts      # Mock data
│   │   └── index.ts     # Server entry point
│   └── package.json
└── package.json         # Root package.json
```

## Available Scripts

### Root Level
- `npm run dev` - Run both client and server in development mode
- `npm run dev:server` - Run server only
- `npm run dev:client` - Run client only
- `npm run install:all` - Install dependencies for both client and server

### Client
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build

## License

This project is private and intended for training purposes.
