# Pharmacy Inventory & Prescription Management

A full-stack starter application with:
- React + Vite frontend (JavaScript, CSS, Node.js tooling)
- FastAPI backend with JWT authentication
- MySQL database
- Inventory, medicines, customers, suppliers, prescriptions, and dashboard
- Indian demo names and commonly used medicine catalogue

> **Demo-data notice:** Seed medicines and stock levels are for software demonstration only. They are not prescribing guidance. Verify every medicine, formulation, strength, schedule, batch, expiry, and price with an authorised pharmacist and current Indian regulatory requirements before real use. Prescription-only medicines must only be dispensed against a valid prescription.

## Project structure

```text
pharmacy-inventory-prescription-management/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── .env.example
│   ├── .env (local only, not committed)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── schema.sql
├── worker/
│   ├── index.js          # deployed API (Cloudflare Worker + D1)
│   ├── wrangler.jsonc    # local Worker preview config
│   └── README.md
├── deploy.json           # deployment manifest (Worker + built frontend)
└── docker-compose.yml
```

## Requirements

- Python 3.10+
- Node.js 18+
- Docker Desktop (recommended) or MySQL 8+

## 1. Start MySQL

From the project root:

```bash
docker compose up -d db
```

This creates database `pharmacy_db` and imports the demo schema and seed data on first startup. MySQL is exposed on host port `3307` (container port `3306`), which is what `backend/.env.example` uses.

If you already have MySQL, run `database/schema.sql` manually and update the backend `.env`.

## 2. Start FastAPI backend

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

macOS/Linux activation:

```bash
source .venv/bin/activate
```

Backend: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

Change `SECRET_KEY` in `.env` before deployment. The default demo admin is created automatically if the database is empty:

- Email: `admin@shreepharmacy.in`
- Password: `Admin@123`

Change this password immediately and do not use demo credentials in production.

## 3. Start frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

The frontend calls `http://localhost:8000/api` in development. To point it at a different backend, copy `frontend/.env.example` to `frontend/.env.development.local` and set `VITE_API_URL=http://localhost:PORT/api`. Development-only env files are git-ignored and are not loaded by a production build, which always uses the same-origin `/api` path, so a local URL can never leak into a deployment.

## Main workflows

- Sign in using the demo admin account.
- Dashboard shows inventory totals, low-stock items, and recent prescriptions.
- Inventory lets you search medicines and add stock items.
- Customers and suppliers are listed from MySQL.
- Prescriptions can be recorded with customer, doctor, and medicine details.
- Backend endpoints require a bearer token except `/api/auth/login` and `/api/health`.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/dashboard` | Dashboard summary |
| GET/POST | `/api/medicines` | List/add medicines |
| GET/POST | `/api/inventory` | List/add inventory batches |
| GET | `/api/customers` | List customers |
| GET | `/api/suppliers` | List suppliers |
| GET/POST | `/api/prescriptions` | List/create prescriptions |

## Deployment

Production URL: <https://pharmacy-inventory-prescription-management-3dqfk7.freebuff.site>  
Preview URL: <https://pharmacy-inventory-prescription-management-3dqfk7-preview.freebuff.site>

The app is deployed as one Cloudflare Worker (Freebuff Sites): `worker/index.js` serves the JSON API and the built React app from a single origin, with data in a D1 (SQLite) database bound as `DB`.

- **Frontend** — `npm --prefix frontend run build` produces `frontend/dist`, uploaded as static assets.
- **API** — `worker/index.js` implements the same endpoints as the FastAPI service, using D1 and WebCrypto (PBKDF2-SHA256 passwords, HS256 JWTs).
- **Database** — D1. The Worker creates its tables and seeds the demo data on first request, so a fresh environment starts ready to use.
- **Manifest** — `deploy.json` lists the Worker module and the asset directory.
- **Configuration** — `SECRET_KEY` (JWT signing key) and optional `ACCESS_TOKEN_MINUTES`. Passwords use PBKDF2-SHA256; the Workers runtime caps PBKDF2 at 100,000 iterations.

To redeploy after changing `worker/index.js` or the frontend:

```bash
npm --prefix frontend run build
# then deploy deploy.json with the hosting tool
```

### Local Worker preview

```bash
npm --prefix frontend run build
cd worker
npx wrangler@3.99.0 dev --local --persist-to "$TEMP/pharmacy-d1"
```

The preview serves the API and the built UI on one port. On a OneDrive-synced folder, workerd cannot create its SQLite file inside the project, so keep `--persist-to` outside the synced directory.

### FastAPI on Vercel

`server.py`, `vercel.json` and the root `requirements.txt` are still in the repo, but a Vercel deployment needs an external MySQL server through `DATABASE_URL` — Vercel cannot host MySQL itself. The Worker deployment above is the one that runs without any external service.

## Editor setup

The project is editor-agnostic: no editor-specific settings are required. `.editorconfig` and `.gitattributes` keep encoding, indentation and line endings (UTF-8, LF) consistent in VS Code, Cursor, PyCharm, Zed, NeoVim or anything else. Python dependencies live in `backend/requirements.txt`, frontend dependencies in `frontend/package.json`.

## Before production

Add role-based access control, password reset, audit logs, refresh-token rotation, rate limiting, HTTPS, backups, migration management, input/security testing, and proper prescription image/document handling. Review applicable Indian pharmacy, privacy, and data-retention requirements. This starter is not a certified pharmacy-management or clinical system.
