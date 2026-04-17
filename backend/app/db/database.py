from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# SQLAlchemy 2.0 mapping to use async psycopg3 driver
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Using SQLAlchemy native async engine
engine = create_async_engine(db_url, echo=(settings.APP_ENV == "dev"), pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)

Base = declarative_base()

async def get_db():
    """Dependency injection payload for FastAPI to handle Db sessions per-request"""
    async with AsyncSessionLocal() as session:
        yield session
