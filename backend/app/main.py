from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routers import system, documents, chat
from app.db.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create schema if it doesn't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # No explicit pool shutdown needed, sqlalchemy async engine disposes on exit or garbage collection
    await engine.dispose()

app = FastAPI(
    title="Document Management System API",
    description="Refactored with FastAPI Routers and SQLAlchemy Async ORM",
    lifespan=lifespan
)

# Replace magic CORS string with settings logic
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire up routers with no prefix to maintain backwards compatibility with the existing Angular app
app.include_router(system.router)
app.include_router(documents.router)
app.include_router(chat.router)
