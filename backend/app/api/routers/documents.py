import os, hashlib, urllib.parse, asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc, asc
from typing import List, Optional
from datetime import datetime, timezone

from app.db.database import get_db
from app.core.config import settings
from app.db.models import Document
from app.schemas.document import DocumentOut, DocumentPatch, PagedOut
from app.services.pdf_utils import extract_text_from_pdf
from app.services.groq_utils import extract_keywords, summarize_text, predict_category

router = APIRouter(tags=["Documents"])

def row_to_dto(db_doc: Document) -> dict:
    tags = [t.strip() for t in (db_doc.keywords or "").split(",") if t.strip()]
    return {
        "file_hash": db_doc.file_hash,
        "filename": db_doc.filename,
        "uploaded_at": db_doc.uploaded_at.astimezone(timezone.utc).isoformat() if db_doc.uploaded_at else "",
        "category": db_doc.category,
        "tags": tags,
        "summary": db_doc.summary,
        "keywords": db_doc.keywords
    }

@router.get("/files", response_model=List[DocumentOut])
async def list_files_legacy(q: Optional[str] = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(Document).order_by(desc(Document.uploaded_at)).limit(limit)
    if q:
        query = query.where(or_(
            Document.filename.ilike(f"%{q}%"),
            Document.summary.ilike(f"%{q}%"),
            Document.keywords.ilike(f"%{q}%")
        ))
    result = await db.execute(query)
    return [row_to_dto(d) for d in result.scalars().all()]


@router.get("/documents", response_model=PagedOut)
async def list_documents(
    q: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    hasTags: Optional[bool] = None,
    sort: str = "date_desc",
    offset: int = 0,
    limit: int = 24,
    db: AsyncSession = Depends(get_db)
):
    query = select(Document)

    if q:
        query = query.where(or_(
            Document.filename.ilike(f"%{q}%"),
            Document.summary.ilike(f"%{q}%"),
            Document.keywords.ilike(f"%{q}%")
        ))
    if category:
        query = query.where(Document.category == category)
    if hasTags is True:
        query = query.where(Document.keywords != None, Document.keywords != "")
    if hasTags is False:
        query = query.where(or_(Document.keywords == None, Document.keywords == ""))
    if dateFrom:
        dt = datetime.strptime(dateFrom, "%Y-%m-%d").date()
        query = query.where(func.date(Document.uploaded_at) >= dt)
    if dateTo:
        dt = datetime.strptime(dateTo, "%Y-%m-%d").date()
        query = query.where(func.date(Document.uploaded_at) <= dt)
    if tags:
        for t in tags:
            t = (t or "").strip()
            if t:
                query = query.where(Document.keywords.ilike(f"%{t}%"))

    # Sorting
    if sort == "date_desc": query = query.order_by(desc(Document.uploaded_at))
    elif sort == "date_asc": query = query.order_by(asc(Document.uploaded_at))
    elif sort == "name_asc": query = query.order_by(asc(func.lower(Document.filename)))
    elif sort == "name_desc": query = query.order_by(desc(func.lower(Document.filename)))
    elif sort == "cat_asc": query = query.order_by(asc(func.lower(Document.category)))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar()

    # Get paged rows
    query = query.offset(offset).limit(limit)
    rows_res = await db.execute(query)
    docs = [row_to_dto(r) for r in rows_res.scalars().all()]

    return {"items": docs, "total": total, "offset": offset, "limit": limit}


@router.get("/documents/{id}", response_model=DocumentOut)
async def get_document(id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(404, "Belge bulunamadı")
    return row_to_dto(doc)


@router.patch("/documents/{id}", response_model=DocumentOut)
async def patch_document(id: str, patch: DocumentPatch, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(404, "Belge bulunamadı")

    if patch.tags is not None:
        doc.keywords = ", ".join(dict.fromkeys([t.strip() for t in patch.tags if t.strip()]))
    if patch.category is not None:
        doc.category = patch.category
    if patch.summary is not None:
        doc.summary = patch.summary

    await db.commit()
    await db.refresh(doc)
    return row_to_dto(doc)


@router.post("/files", response_model=DocumentOut)
async def upload_file(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if (file.content_type or "").lower() not in ("application/pdf", "application/x-pdf", "binary/octet-stream", "application/octet-stream"):
        raise HTTPException(400, "Sadece PDF kabul edilir.")
    data = await file.read()

    file_hash = hashlib.md5(data).hexdigest()
    abs_path = os.path.join(settings.STORAGE_ROOT, f"{file_hash}.pdf")
    with open(abs_path, "wb") as f:
        f.write(data)

    text, tags_csv, summary, category = "", "", None, None
    try:
        text = await asyncio.to_thread(extract_text_from_pdf, data, 10)
        text = text or ""
        kw_struct = await asyncio.to_thread(extract_keywords, text)
        kw_struct = kw_struct or {}
        tags_csv = ", ".join([k.get("kw", "") for k in kw_struct.get("keywords", []) if k.get("kw")])
        summary = await asyncio.to_thread(summarize_text, text)
        summary = summary or None
        category = await asyncio.to_thread(predict_category, text)
        category = category or None
    except Exception:
        pass

    now_dt = datetime.now(timezone.utc)
    
    # Upsert pattern in SQLAlchemy ORM
    doc = await db.get(Document, file_hash)
    if not doc:
        doc = Document(file_hash=file_hash)
        db.add(doc)
    
    doc.filename = file.filename
    doc.uploaded_at = now_dt
    doc.keywords = tags_csv
    doc.summary = summary
    doc.category = category
    doc.fulltext = text
    doc.file_path = abs_path
    
    await db.commit()
    await db.refresh(doc)
    return row_to_dto(doc)


@router.get("/files/{file_hash}/download")
async def download(file_hash: str, disposition: str = "attachment", db: AsyncSession = Depends(get_db)):
    disp = "inline" if str(disposition).lower() == "inline" else "attachment"
    
    doc = await db.get(Document, file_hash)
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(404, "Dosya bulunamadı")

    fname = (doc.filename or f"{file_hash}.pdf").replace("\n", " ").replace('"', "")
    quoted = urllib.parse.quote(fname)

    resp = FileResponse(path=doc.file_path, media_type="application/pdf", filename=fname)
    resp.headers["Content-Disposition"] = f"{disp}; filename*=UTF-8''{quoted}; filename=\"{fname.encode('ascii','ignore').decode('ascii') or 'file.pdf'}\""
    resp.headers["Accept-Ranges"] = "bytes"
    resp.headers["Cache-Control"] = "no-store"
    return resp


@router.post("/documents/{id}/reanalyze", response_model=DocumentOut)
async def reanalyze(id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, id)
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(400, "Belge bulunamadı")

    try:
        with open(doc.file_path, "rb") as f:
            data = f.read()

        text = await asyncio.to_thread(extract_text_from_pdf, data, 10)
        text = text or ""
        kw_struct = await asyncio.to_thread(extract_keywords, text)
        kw_struct = kw_struct or {}
        tags_csv = ", ".join([k.get("kw", "") for k in kw_struct.get("keywords", []) if k.get("kw")])
        summary = await asyncio.to_thread(summarize_text, text)
        summary = summary or None
        category = await asyncio.to_thread(predict_category, text)
        category = category or None

        doc.keywords = tags_csv
        doc.summary = summary
        doc.category = category
        doc.fulltext = text
        await db.commit()
        await db.refresh(doc)
        
        return row_to_dto(doc)
    except Exception as e:
        raise HTTPException(400, str(e))
