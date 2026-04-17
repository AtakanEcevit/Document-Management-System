from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

class DocumentPatch(BaseModel):
    category: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None

class DocumentOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="file_hash")
    filename: str
    uploadedAt: str = Field(alias="uploaded_at")
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    keywords: Optional[str] = None  # deprecated (CSV)

class PagedOut(BaseModel):
    items: List[DocumentOut]
    total: int
    offset: int
    limit: int
