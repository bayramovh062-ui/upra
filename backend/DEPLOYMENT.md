# Backend deployment guide (Render + Neon)

Phase A made the backend fail fast on unsafe production configuration. This guide lists
the manual steps required outside the repository.

## 1. Required production environment variables

Set these on the Render web service:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Must be `production`. |
| `DATABASE_URL` | yes | Neon **pooled** connection string. |
| `JWT_SECRET` | yes | Long random secret; startup fails without it. |
| `JWT_EXPIRES_IN` | no | Defaults to `7d`. |
| `CLIENT_URL` | yes | Frontend origin(s), comma-separated. Used by CORS and Socket.IO. |
| `TRUST_PROXY` | recommended | `1` behind Render's proxy. See `src/config/proxy.js`. |
| `UPLOAD_PROVIDER` | yes | `cloudinary`. Local storage is rejected in production. |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary credentials. |
| `CLOUDINARY_API_KEY` | yes | Cloudinary credentials. |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary credentials. |
| `CRON_SECRET` | yes (for cron) | Shared secret for the external cron endpoint. |
| `ENABLE_SCHEDULER` | no | Set `false` if the external Render Cron Job is the only scheduler. |
| `DEMO_TOPUP_ENABLED` | no | Set `false` to disable demo wallet top-ups. |
| `UPLOAD_LOCAL_DIR` | no | Only used in development/test. |

Server startup validates upload storage. With `NODE_ENV=production` it exits if
`UPLOAD_PROVIDER=local` or if Cloudinary credentials are incomplete.

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

Phase A requires **no schema migration**. All changes reuse existing tables and
columns. If a future migration is needed, review `npx prisma migrate status` first and
apply it explicitly with `prisma migrate deploy`.
