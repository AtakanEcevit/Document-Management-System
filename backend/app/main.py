# main.py (psycopg + pool ile, Postgres uyumlu)

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime, timezone
import hashlib, os

from app.services.db_pg import get_conn, ensure_schema
from app.services.pdf_utils import extract_text_from_pdf
from app.services.groq_utils import extract_keywords, summarize_text, predict_category
from psycopg.rows import dict_row  # psycopg3 dict rows

APP_ENV = os.getenv("APP_ENV", "dev")
STORAGE_ROOT = os.getenv("STORAGE_ROOT", "/app/uploads")
os.makedirs(STORAGE_ROOT, exist_ok=True)

app = FastAPI(title="Document Analyzer API", version="1.0.0")
api = APIRouter(prefix="/api/v1")

# --- CORS ---
_raw = os.getenv("ALLOWED_ORIGINS", "")
origins = [o.strip().rstrip("/") for o in _raw.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:4200", "http://127.0.0.1:4200", "http://web"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)

# --- DB init (app start) ---
@app.on_event("startup")
def _init_db():
    ensure_schema()

# --- Modeller / Şemalar ---
class Document(BaseModel):
    id: str = Field(alias="file_hash")
    filename: str
    uploadedAt: str = Field(alias="uploaded_at")
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    keywords: Optional[str] = None  # deprecated (CSV)
    class Config:
        allow_population_by_field_name = True

class DocOut(BaseModel):
    id: str = Field(alias="file_hash")
    filename: str
    uploadedAt: str = Field(alias="uploaded_at")
    category: Optional[str] = None
    summary: Optional[str] = None
    tags: List[str] = []
    class Config:
        allow_population_by_field_name = True

class DocumentPatch(BaseModel):
    category: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None

class PagedOut(BaseModel):
    items: List[Document]
    total: int
    offset: int
    limit: int


def to_iso_utc(dt_val: Optional[Union[str, datetime]]) -> str:
    """Postgres TIMESTAMPTZ (datetime) ya da string → ISO-8601 UTC."""
    if not dt_val:
        return datetime(1970, 1, 1, tzinfo=timezone.utc).isoformat()
    if isinstance(dt_val, datetime):
        return dt_val.astimezone(timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(dt_val.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except Exception:
        dt = datetime.strptime(dt_val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return dt.isoformat()

def row_to_document(r) -> Document:
    tags = [t.strip() for t in (r.get("keywords") or "").split(",") if t.strip()]
    return Document(
        file_hash=r["file_hash"],
        filename=r["filename"],
        uploaded_at=to_iso_utc(r["uploaded_at"]),
        category=r.get("category"),
        tags=tags,
        summary=r.get("summary"),
        keywords=r.get("keywords") or None,
    )

# -------------------------------------------------
# Sağlık ucu
# -------------------------------------------------
@api.get("/health")
def health():
    return {"ok": True, "env": APP_ENV}

@app.exception_handler(HTTPException)
async def problem_http_exception_handler(request: Request, exc: HTTPException):
    body = {"type":"about:blank","title":exc.detail or "HTTP Error","status":exc.status_code,
            "detail":exc.detail,"instance":str(request.url)}
    return JSONResponse(status_code=exc.status_code, content=body, media_type="application/problem+json")

@app.exception_handler(RequestValidationError)
async def problem_validation_exception_handler(request: Request, exc: RequestValidationError):
    body = {"type":"about:blank","title":"Validation Error","status":422,
            "detail":"Request validation failed","instance":str(request.url),
            "errors":exc.errors()}
    return JSONResponse(status_code=422, content=body, media_type="application/problem+json")

# -------------------------------------------------
# Listeleme / Arama (legacy)
# -------------------------------------------------
@api.get("/files")
def list_files(q: Optional[str] = None, limit: int = 50):
    base = """
        SELECT file_hash, filename, uploaded_at, keywords, summary, category
        FROM documents
        WHERE 1=1
    """
    params: List[object] = []
    if q:
        like = f"%{q}%"
        base += " AND (filename ILIKE %s OR summary ILIKE %s OR keywords ILIKE %s)"
        params += [like, like, like]
    base += " ORDER BY uploaded_at DESC LIMIT %s"
    params.append(limit)

    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(base, tuple(params)).fetchall()
        return [row_to_document(r).dict() for r in rows]

# -------------------------------------------------
# Sayfalı liste: /documents
# -------------------------------------------------
@api.get("/documents")
def list_documents(
    q: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    hasTags: Optional[bool] = None,
    sort: str = "date_desc",
    offset: int = 0,
    limit: int = 24,
):
    where: List[str] = ["1=1"]
    params: List[object] = []

    if q:
        like = f"%{q}%"
        where.append("(filename ILIKE %s OR summary ILIKE %s OR keywords ILIKE %s)")
        params += [like, like, like]

    if category:
        where.append("category = %s")
        params.append(category)

    if hasTags is True:
        where.append("TRIM(COALESCE(keywords,'')) <> ''")
    if hasTags is False:
        where.append("TRIM(COALESCE(keywords,'')) = ''")

    # Tarih filtreleri (YYYY-MM-DD)
    if dateFrom:
        where.append("uploaded_at::date >= %s")
        params.append(dateFrom)
    if dateTo:
        where.append("uploaded_at::date <= %s")
        params.append(dateTo)

    if tags:
        for t in tags:
            t = (t or "").strip()
            if t:
                where.append("COALESCE(keywords,'') ILIKE %s")
                params.append(f"%{t}%")

    order_map = {
        "date_desc": "uploaded_at DESC",
        "date_asc":  "uploaded_at ASC",
        "name_asc":  "LOWER(filename) ASC",
        "name_desc": "LOWER(filename) DESC",
        "cat_asc":   "LOWER(COALESCE(category,'')) ASC",
    }
    order_sql = order_map.get(sort, "uploaded_at DESC")

    where_sql = " AND ".join(where)

    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        total = cur.execute(
            f"SELECT COUNT(*) AS c FROM documents WHERE {where_sql}",
            tuple(params)
        ).fetchone()["c"]

        rows = cur.execute(
            f"""SELECT file_hash, filename, uploaded_at, keywords, summary, category
                FROM documents
                WHERE {where_sql}
                ORDER BY {order_sql}
                LIMIT %s OFFSET %s""",
            tuple(params + [limit, offset])
        ).fetchall()

    docs = [row_to_document(r).dict() for r in rows]
    return {"items": docs, "total": total, "offset": offset, "limit": limit}

# -------------------------------------------------
# Tek doküman
# -------------------------------------------------
@api.get("/documents/{id}")
def get_document(id: str):
    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        r = cur.execute(
            "SELECT file_hash, filename, uploaded_at, keywords, summary, category FROM documents WHERE file_hash=%s",
            (id,)
        ).fetchone()
    if not r:
        raise HTTPException(404, "Belge bulunamadı")
    return row_to_document(r).dict()

@api.patch("/documents/{id}")
def patch_document(id: str, patch: DocumentPatch):
    updates, params = [], []
    if patch.tags is not None:
        keywords = ", ".join(dict.fromkeys([t.strip() for t in patch.tags if t.strip()]))
        updates.append("keywords=%s"); params.append(keywords)
    if patch.category is not None:
        updates.append("category=%s"); params.append(patch.category)
    if patch.summary is not None:
        updates.append("summary=%s"); params.append(patch.summary)

    if updates:
        with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
            cur.execute(f"UPDATE documents SET {', '.join(updates)} WHERE file_hash=%s", tuple(params + [id]))
            con.commit()
    return get_document(id)

# -------------------------------------------------
# Öneriler
# -------------------------------------------------
@api.get("/documents/suggest/categories")
def suggest_categories(prefix: Optional[str] = "", limit: int = 100):
    like = f"{(prefix or '')}%"
    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(
            """
            SELECT DISTINCT category FROM documents
            WHERE TRIM(COALESCE(category,''))<>'' AND category ILIKE %s
            ORDER BY category ASC LIMIT %s
            """,
            (like, limit)
        ).fetchall()
    return [r["category"] for r in rows]

@api.get("/documents/suggest/tags")
def suggest_tags(prefix: Optional[str] = "", limit: int = 50):
    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(
            "SELECT keywords FROM documents WHERE TRIM(COALESCE(keywords,''))<>''"
        ).fetchall()
    freq = {}
    for r in rows:
        for t in (r["keywords"] or "").split(","):
            s = t.strip()
            if not s:
                continue
            if prefix and not s.lower().startswith(prefix.lower()):
                continue
            freq[s] = freq.get(s, 0) + 1
    return [k for k, _ in sorted(freq.items(), key=lambda x: -x[1])][:limit]

# -------------------------------------------------
# Yükleme
# -------------------------------------------------
@api.post("/files")
async def upload_file(file: UploadFile = File(...)):
    if (file.content_type or "").lower() not in (
        "application/pdf", "application/x-pdf", "binary/octet-stream", "application/octet-stream"
    ):
        raise HTTPException(400, "Sadece PDF kabul edilir.")
    data = await file.read()

    file_hash = hashlib.md5(data).hexdigest()  # FE id beklentisi ile uyumlu
    abs_path = os.path.join(STORAGE_ROOT, f"{file_hash}.pdf")
    with open(abs_path, "wb") as f:
        f.write(data)

    # Analiz (hata olursa kayıt yine de oluşsun)
    text, tags_csv, summary, category = "", "", None, None
    try:
        text = extract_text_from_pdf(data, max_pages=10) or ""
        kw_struct = extract_keywords(text) or {}
        tags_csv = ", ".join([k.get("kw", "") for k in kw_struct.get("keywords", []) if k.get("kw")])
        summary = summarize_text(text) or None
        category = predict_category(text) or None
    except Exception:
        pass

    now_dt = datetime.now(timezone.utc)

    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO documents (file_hash, filename, uploaded_at, keywords, summary, category, file_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (file_hash) DO UPDATE SET
              filename=EXCLUDED.filename,
              uploaded_at=EXCLUDED.uploaded_at,
              keywords=EXCLUDED.keywords,
              summary=EXCLUDED.summary,
              category=EXCLUDED.category,
              file_path=EXCLUDED.file_path
            """,
            (file_hash, file.filename, now_dt, tags_csv, summary, category, abs_path)
        )
        con.commit()

        r = cur.execute(
            "SELECT file_hash, filename, uploaded_at, keywords, summary, category FROM documents WHERE file_hash=%s",
            (file_hash,)
        ).fetchone()

    return row_to_document(r).dict()

# -------------------------------------------------
# İndirme / Önizleme
# -------------------------------------------------
@api.get("/files/{file_hash}/download")
def download(file_hash: str, disposition: str = "attachment"):
    disp = "inline" if str(disposition).lower() == "inline" else "attachment"

    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        r = cur.execute(
            "SELECT file_path, filename FROM documents WHERE file_hash=%s",
            (file_hash,)
        ).fetchone()

    if not r or not r["file_path"] or not os.path.exists(r["file_path"]):
        raise HTTPException(404, "Dosya bulunamadı")

    fname = (r["filename"] or f"{file_hash}.pdf").replace("\n", " ").replace('"', "")

    def _iter():
        with open(r["file_path"], "rb") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        _iter(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="{fname}"'}
    )

# -------------------------------------------------
# Yeniden analiz
# -------------------------------------------------
def _reanalyze_now(file_hash: str):
    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        r = cur.execute(
            "SELECT file_path, filename FROM documents WHERE file_hash=%s",
            (file_hash,)
        ).fetchone()
        if not r:
            return False, "Belge bulunamadı"
        if not r["file_path"] or not os.path.exists(r["file_path"]):
            return False, "Dosya bulunamadı"

        try:
            with open(r["file_path"], "rb") as f:
                data = f.read()

            text = extract_text_from_pdf(data, max_pages=10) or ""
            kw_struct = extract_keywords(text) or {}
            tags_csv = ", ".join([k.get("kw", "") for k in kw_struct.get("keywords", []) if k.get("kw")])
            summary = summarize_text(text) or None
            category = predict_category(text) or None

            cur.execute(
                "UPDATE documents SET keywords=%s, summary=%s, category=%s WHERE file_hash=%s",
                (tags_csv, summary, category, file_hash)
            )
            con.commit()
            return True, None
        except Exception as e:
            return False, str(e)

@api.post("/documents/{id}/reanalyze")
def reanalyze(id: str):
    ok, err = _reanalyze_now(id)
    if not ok:
        raise HTTPException(400, err or "Yeniden analiz başarısız")
    with get_conn() as con, con.cursor(row_factory=dict_row) as cur:
        r = cur.execute(
            "SELECT file_hash, filename, uploaded_at, keywords, summary, category FROM documents WHERE file_hash=%s",
            (id,)
        ).fetchone()
    return row_to_document(r).dict()

# Router’ı bağla
app.include_router(api)
