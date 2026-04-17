from sqlalchemy import Column, String, Text, DateTime, ForeignKey, BigInteger, func
from sqlalchemy.orm import relationship
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    file_hash = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    keywords = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    category = Column(String(128), nullable=True)
    fulltext = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)

    chat_sessions = relationship("ChatSession", back_populates="document", cascade="all, delete-orphan")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.file_hash", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    document = relationship("Document", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")
