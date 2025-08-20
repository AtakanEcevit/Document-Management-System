import os, time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import groq

load_dotenv()
MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")
TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
_client = None


def _client_ok() -> bool:
    global _client
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return False
    if _client is None:
        _client = groq.Groq(api_key=key)
    return True


def _chat(messages: List[Dict[str, Any]]) -> str:
    if not _client_ok():
        return ""
    for _ in range(3):
        try:
            res = _client.chat.completions.create(
                messages=messages, model=MODEL, temperature=TEMPERATURE
            )
            return (res.choices[0].message.content or "").strip()
        except Exception:
            time.sleep(0.7)
    return ""


def extract_keywords(text: str) -> Dict[str, Any]:
    sys = {
        "role": "system",
        "content": "You extract high-precision Turkish keyphrases from the document. "
        "No prefix/suffix. conf in [0,1]. Phrases must be 1-3 words, informative, not generic."
        "Output in Turkish",
    }
    usr = {
        "role": "user",
        "content": f"Metinden 5-12 arası anahtar kelime üret. Cevabında sadece virgülle ayrık liste döndür, anahtar kelimeden başka bir cümle koyma. \nMetin:\n{text}",
    }
    raw = _chat([sys, usr]) or ""
    kws = [k.strip() for k in raw.replace("\n", " ").split(",") if k.strip()]
    seen, ordered = set(), []
    for k in kws:
        ck = k.casefold()
        if ck not in seen:
            seen.add(ck)
            ordered.append(k)
    return {"keywords": [{"kw": k} for k in ordered]}


def summarize_text(text: str) -> str:
    sys = {
        "role": "system",
        "content": (
            "You are a summarization assistant. "
            "Return a concise summary. "
            "Do not add headings or any prefix/suffix."
            "Output in turkish."
        ),
    }
    usr = {
        "role": "user",
        "content": (
            "Aşağıdaki belgenin **Türkçe** kısa ve yüksek kaliteli bir özeti çıkar. "
            "**kısa** ve **etiketlemeye uygun** olsun. "
            "Sadece özeti döndür; açıklama veya başlık ekleme.\n\n"
            f"Belge:\n{text}"
        ),
    }
    raw = _chat([sys, usr]) or ""
    return raw.strip()


def predict_category(
    text: str, allowed: Optional[List[str]] = None, fallback: str = "General"
) -> str:
    sys = {"role": "system", "content": "Belgeleri sınıflandır."}
    usr = {
        "role": "user",
        "content": f"Metnin türünü türkçe tek kısa kategori adıyla döndür (ör: Fatura, Özgeçmiş). Sadece ad.\n\n{text}",
    }
    raw = _chat([sys, usr]) or ""
    cat = next((ln.strip() for ln in raw.splitlines() if ln.strip()), fallback)
    if allowed and cat not in allowed:
        return fallback
    return cat
