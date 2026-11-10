# Upra frontend

React 19 + Vite single-page app for [Upra](../README.md): job marketplace, contract and escrow screens, Kanban workspace, chat, notifications and admin pages.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Node's built-in test runner) |
| `npm run e2e:install` | Install the Playwright Chromium browser (once) |
| `npm run e2e` | Playwright E2E suite (desktop and mobile) |
| `npm run e2e:ui` | E2E suite in Playwright's UI mode |

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` | Backend API base URL. Must end in `/api`. The Socket.IO URL is derived from it. Read at build time. |

## E2E tests

The Playwright config starts its own backend (port 5100) and frontend (port 5174) against a **separate** database and refuses to run otherwise:

```powershell
$env:E2E_DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/upra_e2e?schema=public"
npm run e2e:install   # first time only
npm run e2e
```

The database name must end in `_e2e`. The backend's `.env` is not read, so no real email or Cloudinary credentials are used.

## Structure

```
src/
├── app/            # Redux store
├── components/     # layout (AppLayout, Sidebar, Topbar, ...) and ui/ primitives
├── features/       # one folder per domain: RTK Query API + components
│                   # (auth, jobs, proposals, contracts, escrow, issues, wallet,
│                   #  chat, notifications, reviews, attachments, admin, ...)
├── lib/            # baseApi (auth header, re-login on 401), formatting, labels, demo-money texts
├── pages/          # route-level pages (admin/ for ADMIN-only pages)
├── validations/    # Zod schemas for forms
└── App.jsx         # routes and role guards
e2e/                # Playwright specs and helpers
```

Routes are guarded in `App.jsx`: guests are redirected to `/login`, signed-in users skip the auth pages, and `CLIENT`, `FREELANCER` and `ADMIN` areas are role-protected. The "Demo · test money" labels live in `src/lib/demo.js`.
