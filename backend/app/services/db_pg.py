import os
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://appuser:secret@db:5432/appdb")
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, max_idle=30)


DDL = """CREATE TABLE IF NOT EXISTS documents (
    file_hash TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    keywords TEXT,
    summary TEXT,
    category VARCHAR(128),
    fulltext TEXT,
    file_path TEXT
    );
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category);


-- Chat / conversation tables
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(file_hash) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_doc ON chat_sessions(document_id);


CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sess ON chat_messages(session_id, created_at);
"""


def ensure_schema():
    with pool.connection() as con:
        con.execute(DDL)


def get_conn():
    con = pool.connection()
    # return dict rows by default for conn.execute and cursors
    con.row_factory = dict_row
    return con

