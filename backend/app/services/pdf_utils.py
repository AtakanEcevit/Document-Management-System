# app/services/pdf_utils.py
from typing import Optional, List
from io import BytesIO

import fitz  
from doctr.io import DocumentFile
from doctr.models import ocr_predictor


def _export_to_text(export: dict) -> str:
    """doctr OCR output -> düz metin"""
    lines: List[str] = []
    for page in export.get("pages", []):
        for block in page.get("blocks", []):
            for line in block.get("lines", []):
                words = [w.get("value", "") for w in line.get("words", [])]
                txt = " ".join(w for w in words if w).strip()
                if txt:
                    lines.append(txt)
        # sayfa sonu için boş satır
        if lines and lines[-1] != "":
            lines.append("")
    return "\n".join(lines).strip()


def extract_text_from_pdf(file_bytes: bytes, max_pages: Optional[int] = None) -> str:
    """
    SADECE OCR: PDF -> (görüntüler) -> DocTR OCR -> metin.
    - PyTorch tabanlı, önceden eğitili modeller kullanılır.
    - max_pages verildiyse yalnız ilk N sayfa işlenir (performans için).
    """
    with fitz.open(stream=file_bytes, filetype="pdf") as pdf:
        total = len(pdf)
        limit = total if max_pages is None else min(total, max_pages)

        doc = DocumentFile.from_pdf(BytesIO(file_bytes))

    if max_pages is not None and limit < len(doc):
        images = doc.as_images()[:limit]  
        doc = DocumentFile.from_images(images)

    predictor = ocr_predictor(pretrained=True, assume_straight_pages=True)

    result = predictor(doc)          
    export = result.export()         
    text = _export_to_text(export)
    return text
