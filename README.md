# Document Management System (DMS) with AI Chatbot

[![Angular](https://img.shields.io/badge/Frontend-Angular-red?logo=angular)](https://angular.dev/)
[![PrimeNG](https://img.shields.io/badge/UI-PrimeNG-blue?logo=primefaces)](https://primeng.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](https://github.com/AtakanEcevit/Document-Management-System/pulls)


---




## ✨ Highlights

* **Drag & drop** PDF uploads with automatic text extraction
* **AI‑generated** summaries, keywords, and category tagging
* **Inline preview** with PDF.js
* **Chat with your documents** (context‑aware Q\&A)
* **FastAPI + PostgreSQL** backend, **Angular + PrimeNG** frontend
* **Dockerized** for easy setup and deployment
* <img width="1917" height="911" alt="analyze_view_in_use" src="https://github.com/user-attachments/assets/7ea9ac17-1905-4da9-93ea-7e46e0ad5ca6" />
* <img width="1918" height="901" alt="library_view_filter" src="https://github.com/user-attachments/assets/f5ea475a-985e-4bf8-8e19-4b662b9d4fb4" />


> \[!TIP]
> The chatbot remembers the **currently opened document** so you don’t need to repeat file context.


---




## 🧱 Architecture

```
[Angular + PrimeNG]  ──►  [FastAPI]  ──►  [PostgreSQL]
         │                        │
   PDF.js preview           AI layer (LLM)
```

* **Frontend (Angular)**: Library view, search/filter, document detail, chat UI
* **Backend (FastAPI)**: Document ingestion, metadata & AI endpoints, REST API
* **Database (PostgreSQL)**: Documents, metadata (keywords/categories/summaries), chat history
* **AI Layer**: Pluggable LLM provider for summarization, keywording, and Q\&A

---

## 🧰 Tech Stack

| Layer    | Technology                                     |
| -------- | ---------------------------------------------- |
| Frontend | Angular (standalone), PrimeNG, PDF.js          |
| Backend  | FastAPI (Python)                               |
| Database | PostgreSQL (with connection pooling)           |
| AI Layer | LLM integration (summaries, keywords, chatbot) |
| Dev/Ops  | Docker / Docker Compose                        |

---


## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
# in project root
cd deploy
docker-compose up --build
```

* Frontend: [http://localhost:8080](http://localhost:8080)
* Backend: [http://localhost:8000](http://localhost:8000)
* Database: localhost:5432

> \[!CAUTION]
> Stop any services already using **5432 (PostgreSQL)**, **4200 (frontend)**, or **8080 (backend)** before running Compose.

### Option B — Local Development

#### Prerequisites

* Node.js (LTS recommended)
* Python 3.10+
* PostgreSQL running locally

> \[!IMPORTANT]
> Start PostgreSQL **before** booting the backend, or the API won’t connect.

#### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# set your env vars (see below), then run:
uvicorn app.main:app --reload --port 8080
```

#### Frontend

```bash
cd frontend-angular
npm install
ng serve --port 4200
```

---

## ⚙️ Configuration

Create a `.env` file for the backend (example):

```env
# Database
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/dms

# AI Provider (set one or more depending on your implementation)
LLM_PROVIDER=openai            # or azure, anthropic, etc.
OPENAI_API_KEY=your_key_here   # if using OpenAI-compatible API

# App
BACKEND_CORS_ORIGINS=["http://localhost:4200"]
LOG_LEVEL=info
```

> \[!NOTE]
> Adjust variable names to match your codebase. If you support multiple providers, document them here.

If the frontend needs environment config, add `frontend/src/environments/*.ts` (Angular standard) and document the keys here (e.g., `apiBaseUrl`).

---

## 🧠 AI Features

* **Summaries**: Short overviews per document
* **Keywords & Categories**: Auto‑generated tags for search & filtering
* **Chatbot**: Ask natural‑language questions about the open document; responses are context‑aware

> Implementation notes
>
> * Keep prompts and provider settings configurable via env vars.
> * Consider rate‑limiting and caching for cost & latency control.
> * Log model + version for reproducibility.

---

## 🖥️ Frontend (Angular)

* **Views**: Library (grid/list), Detail, Chat panel
* **UX**: Keyboard shortcuts — `/` to focus search, `Ctrl+S` to save
* **PrimeNG**: Tables, dialogs, toasts, inputs, file upload
* **PDF.js**: Inline preview with pagination & zoom

Development scripts (examples):

```bash
# dev
ng serve -o
# build
ng build --configuration production
```

---

## 🔐 Security & Privacy

* Validate and sanitize uploads (size/type), store safely
* Restrict accessible origins via CORS
* Consider PII handling and data retention policies
* Plan authentication/authorization (see Roadmap)

---

## 🛠️ Troubleshooting

> **Backend fails to start**: Check `DATABASE_URL`, ensure PostgreSQL is running and reachable.
>
> **CORS errors**: Confirm `BACKEND_CORS_ORIGINS` includes your frontend URL.
>
> **Large PDFs are slow**: Increase worker processes, chunk processing, or enable async streaming.
>
> **Port conflicts**: Stop services on 5432/4200/8080 or change exposed ports.

---

## 🗺️ Roadmap

* Multi‑file chatbot support (ask across several PDFs)
* Export chats and notes
* User authentication & accounts (JWT/OAuth)
* Advanced NLP features (summarization modes, clustering)
* Usage analytics (opt‑in)
* Basic RBAC for shared workspaces

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repo and create your branch: `feature/branch_name`
2. Commit with clear messages (consider Conventional Commits)
3. Open a PR and fill out the template
4. Link any related issues

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## SPECIAL THANKS FOR MY PROJECT MEMBERS FOR MAKING THIS APPLICATION POSSIBLE:
* Alp Demiral
* Betül Tüncel
* Beyza Savaşçı
* Engin Büyükdığan
* Yasin Berk Şimşek

---

## 🙏 Acknowledgements

* [FastAPI](https://fastapi.tiangolo.com/) & \[Pydantic]
* [Angular](https://angular.dev/) & [PrimeNG](https://primeng.org/)
* [PDF.js](https://mozilla.github.io/pdf.js/)

---

## 📖 FAQ

**Q: Can I use another LLM provider?**
A: Yes — the AI layer is provider‑agnostic as long as you implement the provider client and set the correct env vars.

**Q: How big can PDFs be?**
A: This depends on your server limits and parsing strategy. Consider a size cap and chunking for reliability.

**Q: Is authentication required?**
A: Not yet — it’s on the roadmap. For production, enable auth and HTTPS.
