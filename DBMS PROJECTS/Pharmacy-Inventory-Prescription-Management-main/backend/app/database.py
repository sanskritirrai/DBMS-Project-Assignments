import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://pharmacy_user:pharmacy_pass@localhost:3307/pharmacy_db"
)
# Serverless hosts (Vercel) run many short-lived instances, so keep the pool small
# and recycle connections before the database closes idle ones.
engine_options = {"pool_pre_ping": True, "pool_recycle": 280}
if not DATABASE_URL.startswith("sqlite"):
    engine_options.update(pool_size=2, max_overflow=3, pool_timeout=10)

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
