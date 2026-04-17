from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.db.database import get_db
from app.core.config import settings
from app.db.models import Document

router = APIRouter(tags=["System"])

@router.get("/health")
def health():
    return {"ok": True, "env": settings.APP_ENV}

@router.get("/documents/suggest/categories")
async def suggest_categories(prefix: Optional[str] = "", limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(Document.category).where(
        Document.category.ilike(f"{prefix}%"),
        Document.category.isnot(None),
        Document.category != ""
    ).distinct().order_by(Document.category.asc()).limit(limit)
    result = await db.execute(query)
    categories = result.scalars().all()
    return categories

@router.get("/documents/suggest/tags")
async def suggest_tags(prefix: Optional[str] = "", limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(Document.keywords).where(
        Document.keywords.isnot(None),
        Document.keywords != ""
    )
    result = await db.execute(query)
    keywords_rows = result.scalars().all()
    
    freq = {}
    for kw_str in keywords_rows:
        for t in (kw_str or "").split(","):
            s = t.strip()
            if not s:
                continue
            if prefix and not s.lower().startswith(prefix.lower()):
                continue
            freq[s] = freq.get(s, 0) + 1
    
    sorted_kws = [k for k, _ in sorted(freq.items(), key=lambda x: -x[1])][:limit]
    return sorted_kws
