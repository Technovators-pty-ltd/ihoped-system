# iHOPED Housing Application Management System

Full-stack housing application platform with a React frontend and Express + Prisma (SQLite) backend/database.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite via Prisma (`server/prisma/dev.db`)

## Prerequisites

- Node.js 18+

## First-time setup

```bash
# Frontend deps
npm install

# Backend deps + database schema + seed data
cd server
npm install
npm run db:setup
cd ..
```

## Run locally (two terminals)

**Terminal 1 — API + database**
```bash
cd server
npm run dev
```
API: http://localhost:4000

**Terminal 2 — Frontend**
```bash
npm run dev
```
App: http://localhost:5173

## Demo accounts (seeded in the database)

| Role | Login | Password |
|------|--------|----------|
| Client | `thandi` or `thandi.ndlovu@example.com` | `Client@123` |
| Admin | `Tech` | `T3ch` |

Register new clients on `/register` with a **username** and email. Sign in with either.

## Password reset

Forgot password still uses a **demo on-screen reset link** (no real email is sent yet). Use a real email when registering so you can add SMTP later.

## Project layout

```
ihoped-system/
  src/                 React frontend
  server/
    prisma/            Database schema + seed
    src/               Express API
    uploads/           Stored document files
    .env               DATABASE_URL, JWT_SECRET, PORT
```

## Notes

- Document files are stored on disk under `server/uploads` and served at `/uploads/...`
- JWT sessions are used for API auth
- To reset the database: delete `server/prisma/dev.db`, then run `npm run db:setup` inside `server`
