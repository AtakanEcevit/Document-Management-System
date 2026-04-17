import uuid, re, asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.database import get_db
from app.db.models import Document, ChatSession, ChatMessage
from app.schemas.chat import ChatStartOut, ChatMessageOut, ChatAskIn, ChatAskOut
from app.services.groq_utils import _chat

router = APIRouter(tags=["Chat"])

def _split_into_spans(text: str, span_chars: int = 900) -> List[str]:
    paras = re.split(r"\n{2,}", text or "")
    spans: List[str] = []
    for p in paras:
        p = p.strip()
        if not p:
            continue
        if len(p) <= span_chars:
            spans.append(p)
        else:
            for i in range(0, len(p), span_chars):
                spans.append(p[i:i+span_chars])
    return spans

def _score_span(span: str, q: str) -> int:
    tokens_q = re.findall(r"[\wçğıöşü]+", q.lower())
    s = span.lower()
    score = 0
    for t in set(tokens_q):
        if len(t) <= 2:
            continue
        score += s.count(t)
    return score

async def _context_for_question(db: AsyncSession, doc_id: str, question: str, max_spans: int = 4) -> str:
    doc = await db.get(Document, doc_id)
    fulltext = (doc.fulltext if doc else "") or ""
    spans = _split_into_spans(fulltext)
    scored = sorted(spans, key=lambda sp: _score_span(sp, question), reverse=True)[:max_spans]
    context = "\n\n".join(scored)
    return context

@router.post("/documents/{id}/chat/start", response_model=ChatStartOut)
async def chat_start(id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(404, "Belge bulunamadı")
    sid = uuid.uuid4().hex
    
    session = ChatSession(id=sid, document_id=id, title="Sohbet")
    db.add(session)
    await db.commit()
    return {"session_id": sid}

@router.get("/chat/{sid}/messages", response_model=List[ChatMessageOut])
async def chat_messages(sid: str, db: AsyncSession = Depends(get_db)):
    query = select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    result = await db.execute(query)
    messages = result.scalars().all()
    
    return [
        {"role": m.role, "content": m.content, "createdAt": m.created_at.isoformat()}
        for m in messages
    ]

@router.post("/chat/{sid}/ask", response_model=ChatAskOut)
async def chat_ask(sid: str, body: ChatAskIn, db: AsyncSession = Depends(get_db)):
    q = (body.message or "").strip()
    if not q:
        raise HTTPException(400, "Mesaj boş olamaz")

    session = await db.get(ChatSession, sid)
    if not session:
        raise HTTPException(404, "Sohbet bulunamadı")

    context = await _context_for_question(db, session.document_id, q)

    sys = {
        "role": "system",
        "content": (
        "Sen bir belge-asistanısın. Yalnızca verilen bağlamdan yararlanarak Türkçe yanıt ver. "
        "Bağlamda yoksa \"Bu bilgiyi belgeden çıkaramadım\" de."
        ),
    }
    usr = {
        "role": "user",
        "content": f"Bağlam:\n\n{context}\n\nSoru: {q}",
    }
    answer = await asyncio.to_thread(_chat, [sys, usr])
    answer = answer or "Bu bilgiyi belgeden çıkaramadım"

    user_msg = ChatMessage(session_id=sid, role="user", content=q)
    assistant_msg = ChatMessage(session_id=sid, role="assistant", content=answer)
    
    db.add_all([user_msg, assistant_msg])
    await db.commit()

    return {"session_id": sid, "answer": answer}
