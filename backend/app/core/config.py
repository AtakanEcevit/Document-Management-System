import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://appuser:secret@db:5432/appdb")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_TEMPERATURE: float = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    APP_ENV: str = os.getenv("APP_ENV", "dev")
    STORAGE_ROOT: str = os.getenv("STORAGE_ROOT", "/app/uploads")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200,http://web")
    
settings = Settings()

# Ensure storage directory exists to prevent FileNotFoundError on uploads
os.makedirs(settings.STORAGE_ROOT, exist_ok=True)
