import os, time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import groq

load_dotenv()
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
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
            "Türkçe metinlerden yüksek isabetli, kritik anahtar ifadeler çıkaran bir yardımcıdır.\n"
            "Kurallar:\n"
            "1. Sadece Türkçe yaz.\n"
            "2. 1–5 kelimelik, bilgi değeri yüksek öbekler üret.\n"
            "3. Genel/boş (ör. 'giriş', 'özet') veya stopword içeren ifadeleri çıkarma.\n"
            "4. Özel adları, teknik terimleri, marka/kurum isimlerini koru.\n"
            "5. Metindeki sayısal/veri tipindeki kritik bilgileri mutlaka çıkar:\n"
            "   - Tutarlar (₺, TL, USD vb. para miktarları)\n"
            "   - Tarihler (gün, ay, yıl, tam tarih)\n"
            "   - Telefon numaraları\n"
            "   - E-posta adresleri\n"
            "   - Adres, il/ilçe, ülke adları\n"
            "6. Yalnızca benzersiz ve önemli ifadeler döndür; aynı kökten tekrarları çıkar.\n"
            "7. Küçük/büyük harfleri doğal biçimde koru.\n"
        ),
    }
    usr = {
        "role": "user",
        "content": (
            "Aşağıdaki metinden EN AZ 5, EN FAZLA 15 kritik anahtar ifade çıkar.\n"
            "YANIT BİÇİMİ: Sadece virgülle ayrık TEK SATIR CSV döndür; "
            "virgülden sonra boşluk bırakma; tırnak, numara, madde imi, açıklama ekleme.\n\n"
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
    return {"keywords": [{"kw": k} for k in ordered[:15]]}



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
