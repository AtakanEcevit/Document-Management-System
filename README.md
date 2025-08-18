# Özellikler

PDF Yükleme: Tek dosya yükle, hızlı kayıt.

Otomatik Analiz: PDF’ten metin çıkarma → anahtar kelimeler, kısa özet, kategori (LLM destekli).

Kütüphane Görünümü: Grid / liste; arama, kategori, tarih, etiket filtreleri; sıralama.

Detay Sayfası: Etiket/özet/kategori düzenleme + tek Kaydet butonu; benzer dokümanlar paneli; “Yeniden analiz”.

Inline Önizleme: PDF’i tarayıcı içinde aç veya indir.

Öneriler: Otomatik kategori ve etiket (tag) önerileri.

Sağlam Backend: FastAPI, PostgreSQL (psycopg pool), CORS, problem+json hata formatı.


 # Mimari

Frontend (Angular, PrimeNG)

 ├─ Pages: Library (listeleme/filtre), Detail (düzenleme/önizleme)
 
 └─ Services: ApiService (REST istemcisi)

Backend (FastAPI)

 ├─ Routes: /api/v1
 
 │   ├─ GET  /health
 
 │   ├─ GET  /files                    (legacy list)
 
 │   ├─ POST /files                    (upload)
 
 │   ├─ GET  /files/{id}/download      (inline/attachment)
 
 │   ├─ GET  /documents                (paged list + filtre/sıralama)
 
 │   ├─ GET  /documents/{id}           (detay)
 
 │   ├─ PATCH /documents/{id}          (tags/summary/category)
 
 │   ├─ POST /documents/{id}/reanalyze (yeniden analiz)
 
 │   ├─ GET  /documents/suggest/categories
 
 │   └─ GET  /documents/suggest/tags
 
 └─ Services: pdf_utils, groq_utils, db_pg

DB: PostgreSQL (psycopg_pool)

Storage: Dosyalar (uploads/) + dosya yolu DB’de

# Ekranlar

Library: Arama/filtre, grid/liste, seç-çoklu analiz, CSV export, sağdan inline önizleme paneli.

Detail: PDF viewer ortada, sol meta, sağda tab’ler (Etiketler / Özet / Özellikler).

Üst barda tek “Kaydet” ve kısayollar (Ctrl+S, Ctrl+K, Zen vs).

# Kısayollar

Ctrl+S Kaydet • Ctrl+K Komut paleti • / Arama alanına odak • ? Yardım

Hızlı Başlangıç

Docker ile Repo kökünde bir docker-compose.yml ile;

# İlk kurulum / yeniden kurulum
docker compose up --build

# Sonraki açılışlar
docker compose up -d
Web: http://localhost:4200
API: http://localhost:8080/api/v1

İlk çalıştırmada DB tablo oluşturulur, uploads klasörü yoksa yaratılır.

Yerelde (backend)
Gereksinim: Python 3.11+, PostgreSQL çalışır durumda.

cd backend/           # dizin adına göre uyarlanmalı
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# .env oluştur (aşağıdaki Yapılandırma bölümüne bak)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

Yerelde (frontend)
Gereksinim: Node 18+, npm.

cd frontend-angular/  # dizin adına göre uyarlanmalı
npm install
npm start             # veya: ng serve
# http://localhost:4200

Frontend, API taban adresini runtime’da window.__APP_API_BASE__ üzerinden okuyabilir.
Geliştirmede çoğunlukla http://localhost:8080/api/v1 kullanılır.

Yapılandırma
.env (backend):
APP_ENV=dev
DATABASE_URL=postgresql://appuser:secret@localhost:5432/appdb
STORAGE_ROOT=/app/uploads
ALLOWED_ORIGINS=http://localhost:4200

# LLM analiz için
# GROQ_API_KEY=...

# Önemli notlar
ALLOWED_ORIGINS: CORS için frontend adresini ekle. STORAGE_ROOT: yüklenen PDF’lerin saklanacağı klasör (container içinde kalıcı volume önerilir).
LLM analiz (özet/etiket/kategori) için groq_utils benzeri sağlayıcı anahtarını ayarla.
API Referansı (özet)
/api/v1 altında:
GET /health → { ok: true, env: "dev" }
GET /files?q&limit → (legacy) basit liste
POST /files (form-data, field: file) → yükle + analiz + kaydet → belge döner
GET /files/{id}/download?disposition=inline|attachment → PDF stream
GET /documents → sayfalı liste (query: q, category, tags, dateFrom, dateTo, hasTags, sort, offset, limit)
GET /documents/{id} → detay
PATCH /documents/{id} → gövde: { tags?: string[], summary?: string, category?: string }
POST /documents/{id}/reanalyze → yeniden analiz (metin çıkar + özet/etiket/kategori günceller)
GET /documents/suggest/categories?prefix&limit
GET /documents/suggest/tags?prefix&limit



Geliştirici Notları
Frontend
Angular standalone bileşenler (LibraryPage, DetailPage).
PrimeNG kullanımı (Table, Dropdown, Sidebar, Toast, Splitter, TabView vs.).
ApiService backend sözleşmesine (v1) göre güncellenmiş: patchDocument, suggest*, reanalyze.
Kaydet düğmesi tek ve üst barda; autosave kaldırıldı.

Backend
FastAPI + psycopg_pool bağlantı havuzu.
documents tablosu: file_hash, filename, uploaded_at, keywords, summary, category, file_path, fulltext.
PDF metin çıkarma (pdf_utils), anahtar kelime/özet/kategori (LLM; groq_utils).
“Problem+JSON” hata yanıtları ve düzgün CORS.

Sorun Giderme
Yüklemede 405 Not Allowed
Frontend upload URL’si POST /api/v1/files olmalı.
PrimeNG FileUpload kullanıyorsan customUpload ile ApiService.upload()’a yönlendir.
CORS ALLOWED_ORIGINS içinde frontend adresi var mı?

Özet/Kategori güncellenmiyor
Frontend saveAll() → ApiService.patchDocument() gidiyor olmalı.
Backend PATCH /documents/{id} alanlarını güncelliyor; DB kullanıcı yetkisi ve commit akışını kontrol et.
PDF inline açılmıyor
GET /files/{id}/download?disposition=inline çağrısını ve Content-Disposition header’ını doğrula.
Tarayıcı PDF eklentisi/engelleyici varsa test et.
Font/stylesheet hataları
Font paketleri/paths doğru mu? (opsiyonel)
Cache temizleyip tekrar dene.
