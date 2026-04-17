from pydantic import BaseModel

class ChatStartOut(BaseModel):
    session_id: str

class ChatMessageOut(BaseModel):
    role: str
    content: str
    createdAt: str

class ChatAskIn(BaseModel):
    message: str

class ChatAskOut(BaseModel):
    session_id: str
    answer: str
