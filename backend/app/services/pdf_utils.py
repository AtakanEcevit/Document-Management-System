from typing import Optional
import fitz  # PyMuPDF

def extract_text_from_pdf(file_bytes: bytes, max_pages: Optional[int] = None) -> str:
    out = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        n = len(doc)
        limit = n if max_pages is None else min(n, max_pages)
        for i in range(limit):
            page = doc[i]
            txt = page.get_text("text").strip()
            if txt:
                out.append(txt)
    return "\n".join(out).strip()
