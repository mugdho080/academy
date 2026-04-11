# Academy

This repository deploys a single Railway-ready full-stack app from the repository root:

- Vite React frontend at the repo root
- Hono Node server in `server/`
- Production frontend build output in `dist/`
- Production server build output in `server/dist/`

The following folders are not part of the Railway deploy target:

- `api/` contains legacy PHP endpoints kept for migration reference
- `claw-game/` contains a separate experimental arcade app and is not built or started by Railway

## Local Development

Install dependencies in both app layers:

```bash
npm install
npm --prefix server install
```

Run the frontend and backend together:

```bash
npm run dev
```

## Railway Deployment

Deploy from the repository root.

- Root directory: `/`
- Install command: handled by `nixpacks.toml`
- Build command: handled by `nixpacks.toml` and runs `npm run build`
- Start command: `npm run start`

### Production Flow

1. `npm run build:frontend` builds the Vite app into `dist/`
2. `npm run build:server` compiles the Hono server into `server/dist/`
3. `npm run start` starts the server from `server/dist/index.js`
4. The server serves:
   - API routes under `/api/*`
   - built frontend assets under `/assets/*`
   - SPA HTML fallback for extensionless frontend routes

### Required Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `NODE_ENV=production`

Recommended while testing on the Railway URL directly:

- `FRONTEND_URL=https://<your-railway-domain>`

Optional:

- `VITE_ARCADE_URL=https://<deployed-claw-game-url>`
  - The `/arcade` screen embeds a separately deployed claw game.
  - If this variable is not set, the page now shows a configuration notice instead of trying to load `localhost`.

### Railway Notes

- Do not deploy from `server/` or any subfolder.
- Do not use Vite dev server in production.
- The production entry path is always `server/dist/index.js` via `npm run start`.
- Frontend assets are served by the backend in production; Railway is not serving `dist/` as a separate static site.
- `JWT_SECRET` is required at startup; there is no production fallback secret.
