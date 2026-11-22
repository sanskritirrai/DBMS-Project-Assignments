# worker/

The deployed backend for the pharmacy app.

Hosting: Freebuff Sites, site id `6f1c2b7e-9a4d-4f3e-8c21-5b7d0e4a9c33`
(production `afeb95b1-5140-43ce-abf8-f9e8370c1954`, preview `d2be2e3b-2268-4ed8-9d31-7b7ccdfc258b`).

`index.js` is a Cloudflare Worker that serves the same JSON API as the FastAPI
service in `backend/app/main.py` (login, dashboard, medicines, inventory,
customers, suppliers, prescriptions) plus the built React app from
`frontend/dist`. It is deployed together with the frontend through
`../deploy.json`.

Why not FastAPI? Serverless hosting on Cloudflare cannot run a Python
process or a MySQL server, so the deployed API runs on Workers with a D1
(SQLite) database bound as `DB`. The FastAPI app remains the local
development backend and the Vercel entrypoint.

## Behaviour

- The schema is created and the demo data seeded on the first request, so a
  fresh database works immediately.
- Passwords use PBKDF2-SHA256 (100,000 iterations, the Workers WebCrypto
  maximum). JWTs are HS256, signed with `env.SECRET_KEY`.
- `/docs` on the deployed origin serves a small API reference page, so the
  "Open API docs" link in the UI has somewhere to go.

## Local preview

```bash
npm --prefix ../frontend run build
npx wrangler@3.99.0 dev --local --persist-to "$TEMP/pharmacy-d1"
```

`wrangler.jsonc` is local-only: it supplies a placeholder D1 binding and
development vars. Real bindings and secrets are provided by the hosting
platform, not by this file.

If the project sits in a OneDrive-synced folder, workerd cannot create its
SQLite file inside the project; keep `--persist-to` pointed at a local temp
directory.
