# Production Deploy Checklist (K2S)

## 1) Prepare environment
1. Copy env template:
   - `cp .env.production.example .env.production`
2. Set real secrets and domains in `.env.production`:
   - `APP_KEY` (generate from backend once)
   - `DB_PASSWORD`, `DB_ROOT_PASSWORD`
   - `BACKEND_APP_URL`, `VITE_API_BASE_URL`
   - `CORS_ALLOW_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`
   - `QUEUE_CONNECTION` (default: `database`)

## 2) Build and run
1. Start containers:
   - `docker compose --env-file .env.production up -d --build`
2. Backend setup is automated by `backend-init` service:
   - `php artisan migrate --force`
   - `php artisan db:seed --force`
3. Queue worker is automated by `queue-worker` service:
   - `php artisan queue:work --sleep=3 --tries=3 --timeout=120`
4. If `APP_KEY` still empty, generate once:
   - `docker compose --env-file .env.production exec backend php artisan key:generate --show`
   - copy value to `.env.production`, then restart services

## 3) Storage and file access
- For non-Docker local deploy, ensure:
  - `php artisan storage:link`
- For this Docker setup, direct `/storage/*` access is blocked.
- File access should use Laravel auth/signed endpoints only.

## 4) Security baseline
- `APP_ENV=production`
- `APP_DEBUG=false`
- `SESSION_SECURE_COOKIE=true` (if HTTPS)
- `CORS_ALLOW_ORIGINS` must be explicit domains (avoid `*`)
- Rotate DB passwords and `APP_KEY` for production

## 5) Post-deploy validation
- API health: `GET /up`
- Login works from frontend domain
- File upload/download works (signed/auth endpoints)
- Background sync/queue features tested if used
