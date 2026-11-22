"""Vercel entrypoint.

Vercel detects the ``app`` object below and deploys the whole FastAPI
application as a single serverless function. The React build is mounted on the
same app, so the API and the frontend are served from one deployment and one
domain.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.staticfiles import StaticFiles  # noqa: E402
from app.main import app  # noqa: E402

# Built by the build command in vercel.json (npm run build --prefix frontend).
# Mounted last so every /api route above keeps priority over static files.
DIST = ROOT / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
