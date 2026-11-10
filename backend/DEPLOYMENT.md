# Deployment guide (Neon + Render + Vercel)

Phase A made the backend fail fast on unsafe production configuration. This guide lists
the manual steps required outside the repository, for the backend (Render + Neon) and the
frontend (Vercel).

## 1. Required production environment variables

Set these on the Render web service:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Must be `production`. |
| `DATABASE_URL` | yes | Neon **pooled** connection string. |
| `JWT_SECRET` | yes | Long random secret; startup fails without it. |
| `JWT_EXPIRES_IN` | no | Defaults to `7d`. |
| `CLIENT_URL` | yes | Frontend origin(s), comma-separated, no trailing slash. Used by CORS and Socket.IO. |
| `APP_URL` | recommended | Public frontend URL used in email links. Falls back to the first `CLIENT_URL`. |
| `TRUST_PROXY` | recommended | `1` behind Render's proxy. See `src/config/proxy.js`. |
| `UPLOAD_PROVIDER` | yes | `cloudinary`. Local storage is rejected in production. |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary credentials. |
| `CLOUDINARY_API_KEY` | yes | Cloudinary credentials. |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary credentials. |
| `BREVO_API_KEY` | yes (email) | Recommended email provider on Render. See section 7. |
| `EMAIL_FROM` | yes (email) | Verified sender, e.g. `Upra <you@example.com>`. |
| `REQUIRE_EMAIL_VERIFICATION` | no | Defaults to `true` in production. Unverified accounts cannot post jobs or send proposals. |
| `CRON_SECRET` | yes (for cron) | Shared secret for the external cron endpoint. |
| `ENABLE_SCHEDULER` | no | Set `false` if the external Render Cron Job is the only scheduler. |
| `DEMO_TOPUP_ENABLED` | no | Set `false` to disable demo wallet top-ups. |
| `UPLOAD_LOCAL_DIR` | no | Only used in development/test. |

Server startup validates upload storage and email delivery. With `NODE_ENV=production` it
exits if `UPLOAD_PROVIDER=local`, if Cloudinary credentials are incomplete, or if no email
provider is configured.

## 2. Neon / PostgreSQL

- Use the **pooled** Neon connection string for the web service and cron job
  (the host contains `-pooler`). Keep `sslmode=require`.
- Use the **direct** (non-pooled) connection string when running Prisma migrations
  from a one-off shell or CI job.
- Apply migrations explicitly:

  ```bash
  cd backend
  DATABASE_URL="<direct neon url>" npx prisma migrate deploy
  ```

  PowerShell:

  ```powershell
  cd backend
  $env:DATABASE_URL="<direct neon url>"; npx prisma migrate deploy
  ```

Do not run `prisma migrate reset` or seed scripts against production.

## 3. Render web service

- Root directory: `backend`
- Build command: `npm install && npx prisma generate`
- Start command: `npm start`
- Health check path: `/api/health`
- Add the environment variables above.

`GET /api/health` returns `{"status":"ok"}` and does not touch the database or expose secrets.

## 4. Render Cron Job (automatic milestone approval)

The endpoint is already implemented and protected by a shared secret:

`POST /api/internal/auto-approve`

- If `CRON_SECRET` is unset, the endpoint returns `404`.
- A wrong or missing `x-cron-secret` header returns `401`.
- The operation is idempotent and safe to run concurrently.

Create a Render Cron Job:

- Schedule: `0 * * * *` (hourly)
- Environment variable: `CRON_SECRET` with the same value as the web service
- Command:

  ```bash
  curl -fsS -X POST https://<your-service>.onrender.com/api/internal/auto-approve \
    -H "x-cron-secret: $CRON_SECRET"
  ```

The request also wakes a sleeping Render instance. Do not add another in-process
scheduler in production; either keep the existing one or set `ENABLE_SCHEDULER=false`
and rely on this cron job.

## 5. File storage and protected attachments

- Production uploads go to Cloudinary. There is no local-disk fallback.
- Attachment metadata responses do not expose storage URLs.
- Files are downloaded through `GET /api/attachments/:id/content`, which requires a
  valid session and checks contract participation, uploader ownership, reporter
  ownership, or admin role.
- Cloudinary assets keep their existing delivery type to avoid breaking references.
  Anyone with a raw Cloudinary URL could still fetch the asset directly; treat those
  URLs as private and do not publish them.
- Keep `backend/uploads` (development/test files) out of production containers.

## 6. Database migrations

Migrations are applied explicitly with `prisma migrate deploy` (see section 2); the web
service never applies them on startup. Before a release, review pending migrations with
`npx prisma migrate status`, apply them against the **direct** Neon URL, and only then
deploy the new backend code.

Phase B added a migration for email verification and password reset
(`phaseb_email_verification_password_reset`); later migrations add attachment foreign keys.
The taxonomy (categories and skills) ships inside a migration, so a fresh database has
the data the app needs to post jobs without running any seed.

## 7. Email (verification and password reset)

Delivery providers, in priority order: **Brevo** (HTTPS API) > **SMTP** (nodemailer) >
**Resend** (HTTPS API). In development, with none configured, emails are printed to the
server log (copy the link from there). In production at least one provider is mandatory.

Recommended on Render: **Brevo**. Render's free tier blocks outbound SMTP ports, and Brevo
works over HTTPS without owning a domain (300 emails/day on the free plan).

1. In Brevo, create an API key (SMTP & API > API Keys) and verify a sender address
   (Senders, Domains & Dedicated IPs).
2. On Render set `BREVO_API_KEY` and `EMAIL_FROM` (must be the verified sender).
3. Set `APP_URL` to the Vercel origin so links in emails open the right site.

Notes:
- With Resend's shared sender (`onboarding@resend.dev`) you can only email your own Resend
  account address. Verify a domain in Resend to email arbitrary users.
- Verification links are valid for 24 hours, password reset links for 1 hour and only once.
  A password reset also invalidates every existing session.
- Verification and reset requests are rate limited per IP, and reset requests also per email.

## 8. Frontend (Vercel)

- Root directory: `frontend`
- Framework preset: Vite (build command `npm run build`, output directory `dist`)
- Environment variable (build time): `VITE_API_URL=https://<your-service>.onrender.com/api`
  (it must end in `/api`; the Socket.IO URL is derived from it). Redeploy after changing it.
- `frontend/vercel.json` rewrites every path to `index.html`, so deep links such as
  `/contracts/<id>` and `/verify-email?token=...` work after a refresh.
- After the first deploy, set `CLIENT_URL` (and `APP_URL`) on Render to the exact Vercel
  origin. If you use Vercel preview deployments, add their origins to `CLIENT_URL` too
  (comma-separated), otherwise CORS and WebSockets will be blocked.

## 9. Demo data

`npm run seed` creates demo accounts (`*@demo.upra.local`, password `Demo12345!`), jobs,
contracts, wallets and one open dispute.

- It refuses to run with `NODE_ENV=production` and refuses non-local database hosts unless
  `--allow-remote` is passed.
- For a hosted demo, use a **separate** database (for example a Neon branch), set it as
  `DATABASE_URL` for that single command, and run `npm run seed -- --allow-remote`. Never
  point it at the production database: the demo accounts have a public, known password.
- `npm run seed:reset -- --allow-remote` removes only the demo accounts and their data.

## 10. Post-deploy smoke test

1. `GET https://<api>/api/health` returns `{"status":"ok"}`.
2. Open the frontend, register an account and receive the verification email.
3. Verify the email, post a job (as a client) or send a proposal (as a freelancer).
4. Upload a file with a milestone submission and download it through the app.
5. `POST /api/internal/auto-approve` with a wrong secret returns `401`, with the right one
   returns `200` and a summary.
6. Open a notification-producing action in two browsers and confirm the other side gets
   it instantly (WebSocket check).
7. Open the site on a phone.
