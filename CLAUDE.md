# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server (Vite on localhost:8080)
- `npm run build` - Build production version
- `npm run build:dev` - Build development version
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Electron Development
- `npm run electron:dev` - Start Electron app in development mode (runs both dev server and Electron)
- `npm run electron:build` - Build complete Electron application
- `npm run electron:pack` - Package Electron app using electron-builder
- `npm run build:electron` - Compile TypeScript files for Electron main process

### Testing
No test framework is currently configured. The README suggests adding automated testing (Vitest, Jest, Playwright, or Cypress) as a future improvement.

## Architecture Overview

This is a desktop time tracking application built with:

### Technology Stack
- **Framework**: Electron + React + TypeScript
- **Build Tool**: Vite with vite-plugin-electron
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **Database**: SQLite with sqlite3 package
- **State Management**: React Context (TimerContext, AuthContext) + TanStack Query
- **Routing**: React Router

### Electron Architecture
- **Main Process** (`src/electron/main.ts`): Application lifecycle, window management (main/mini/tray), database operations, system integrations
- **Renderer Process** (`src/main.tsx`, `src/App.tsx`): React SPA with routing
- **Preload Script** (`src/electron/preload.ts`): Secure API bridge using contextBridge
- **Database Service** (`src/electron/database.ts`): SQLite operations and schema management
- **Auth Service** (`src/electron/auth-service.ts`): User authentication and JWT handling

### Key Features
- Multi-window support (main window, mini overlay, system tray)
- Hierarchical time tracking (Client > Project > Task)
- User authentication with role-based permissions
- System integration (power monitoring, idle detection)
- Data export (CSV/JSON)
- Real-time state synchronization across windows

### Directory Structure
- `src/components/` - Reusable UI components including auth and shadcn/ui components
- `src/features/tracker/` - Timer-specific components and TimerContext
- `src/pages/` - Main application pages (Dashboard, Reports, Admin, Analytics)
- `src/contexts/` - React contexts for global state
- `src/lib/` - Utility functions and Electron database interface
- `src/electron/` - Electron main process, preload, database, and auth services

### Database Schema
Key entities include:
- **Users**: Authentication with roles (admin/user/director), team assignments, billing rates
- **Sessions**: Time tracking records with client/project/task hierarchy
- **Projects**: With user permissions for time tracking access

### State Management
- **TimerContext**: Manages timer state, sessions, and time tracking operations
- **AuthContext**: Handles user authentication and permissions
- **TanStack Query**: Data fetching and caching for API operations

### Build Configuration
- TypeScript configuration split across multiple files for different contexts
- Vite handles both renderer and main process compilation
- Electron-builder configured for cross-platform packaging (macOS, Windows, Linux)

## Development Notes

### Important Patterns
- Use `electronDB` interface from `@/lib/electron-database.ts` for database operations in renderer
- Follow the hierarchical Client > Project > Task structure for time tracking
- Window state is managed in main process and synchronized across all windows
- Authentication tokens are managed securely through the preload script

### Security
- contextBridge is properly implemented for secure IPC
- User authentication with JWT tokens
- Role-based access control throughout the application