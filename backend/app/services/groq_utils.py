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
        "content": (
            "Türkçe metinlerden yüksek isabetli anahtar ifadeler çıkaran bir yardımcıdır. "
            "Kurallar: (1) Sadece Türkçe yaz. (2) 1–3 kelimelik, bilgi değeri yüksek öbekler üret; "
            "genel/boş (ör. 'giriş', 'özet') veya stopword içeren ifadeleri çıkarma. "
            "Özel adları ve teknik terimleri koru, küçük/büyük harfleri doğal biçimde kullan. "
            "Aynı kökten tekrarları verme."
        ),
    }
    usr = {
        "role": "user",
        "content": (
            "Aşağıdaki metinden EN AZ 5, EN FAZLA 12 anahtar ifade çıkar. "
            "YANIT BİÇİMİ: Sadece virgülle ayrık TEK SATIR CSV döndür; "
            "virgülden sonra boşluk bırakma; tırnak, numara, madde imi, açıklama ekleme. "
            "Örnek biçim: kelime1,kelime2,kelime3\n\n"
            f"Metin:\n{text}"
        ),
    }
    raw = _chat([sys, usr]) or ""
    kws = [k.strip() for k in raw.replace("\n", " ").split(",") if k.strip()]
    seen, ordered = set(), []
    for k in kws:
        ck = k.casefold()
        if ck not in seen:
            seen.add(ck)
            ordered.append(k)
    # İsteğe göre kırp (maksimum 12)
    ordered = ordered[:12]
    return {"keywords": [{"kw": k} for k in ordered]}


def summarize_text(text: str) -> str:
    sys = {
        "role": "system",
        "content": (
            "Türkçe, kısa ve etiketlemeye uygun özetler üreten bir yardımcıdır. "
            "Kurallar: (1) Sadece özeti döndür. (2) Başlık, ön/son söz, emoji, tırnak, liste yok. "
            "(3) En fazla 35 kelime, tek paragraf, tarafsız ve bilgi odaklı."
        ),
    }
    usr = {
        "role": "user",
        "content": (
            "Aşağıdaki belgenin kısa ve yüksek kaliteli bir özetini üret. "
            "YANIT BİÇİMİ: Sadece özet cümlesini döndür; başka hiçbir şey ekleme.\n\n"
            f"Belge:\n{text}"
        ),
    }
    raw = _chat([sys, usr]) or ""
    return raw.strip()


def predict_category(
    text: str, allowed: Optional[List[str]] = None, fallback: str = "General"
) -> str:
    sys = {
        "role": "system",
        "content": (
            "Belge türü sınıflandırıcısısın. "
            "Kurallar: (1) Sadece Türkçe tek kısa kategori adı döndür. "
            "(2) Başka hiçbir metin, açıklama, noktalama, emoji ekleme. "
            "(3) Çıktı TEK SATIR olmalı."
        ),
    }

    if allowed:
        allowed_list =_
