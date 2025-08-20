# Document Management System with AI Chatbot

[![Angular](https://img.shields.io/badge/Frontend-Angular-red?logo=angular)](https://angular.dev/)  
[![PrimeNG](https://img.shields.io/badge/UI-PrimeNG-blue?logo=primefaces)](https://primeng.org/)  
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal?logo=fastapi)](https://fastapi.tiangolo.com/)  
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql)](https://www.postgresql.org/)  
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker)](https://www.docker.com/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)  
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](https://github.com/AtakanEcevit/Document-Management-System/pulls)  

---

## 📑 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Docker Setup](#docker-setup)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview  

This project is a **document management system** with built-in **AI capabilities**.  

With this app, you can:  
- Upload and organize PDF documents  
- Automatically generate **keywords, summaries, and categories**  
- Preview documents directly in the browser  
- **Chat with your documents** in natural language  

---

## Features  

### Document Management  
- Upload PDFs via drag-and-drop or file picker  
- <ins>Automatic</ins> text extraction, keyword generation, and category tagging  
- <ins>AI-powered</ins> summaries for quick overviews  
- Library view with search, filtering, and sorting  
- Inline PDF preview  

### Chatbot Integration  
- Start a conversation with any uploaded document  
- Ask context-based questions in plain English  
- Example queries:  
  - “What’s the deadline in this contract?”  
  - “Summarize section three.”  
- Get instant, context-aware answers

> [!TIP]  
> The chatbot remembers the context of the document you opened <ins>**at that moment**</ins>, so you don’t have to re-explain what file you’re talking about.  

### User Experience  
- Grid and list view options with saved preferences  
- Keyboard shortcuts (`/` for search, `Ctrl+S` for save)  
- Responsive UI built with Angular + PrimeNG  
- Easy deployment with Docker  

---

## Tech Stack  

| Layer      | Technology |
|------------|------------|
| Frontend   | Angular (standalone), PrimeNG |
| Backend    | FastAPI (Python) |
| Database   | PostgreSQL with psycopg pool |
| AI Layer   | LLM integration (summaries, keywords, chatbot) |
| Extras     | Docker, PDF.js for inline previews |

---

## Getting Started  

### Prerequisites  
- Node.js  
- Python 3.10+  
- PostgreSQL  
- Docker (optional)

> [!IMPORTANT]  
> Make sure your PostgreSQL server is running before starting the backend. Otherwise, the API will fail to connect.  

### Installation  

Clone the repository:  
```bash
git clone https://github.com/AtakanEcevit/Document-Management-System.git
cd Document-Management-System
```

#### Backend setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Frontend setup
```bash
cd frontend
npm install
ng serve
```

#### Docker Setup
```bash
docker-compose up --build
```
>[!CAUTION]
>If you already have services running on port 5432 (PostgreSQL) or 4200/8080 (frontend/backend), you may need to stop them before running Docker Compose.

---

## Roadmap

- Multi-file chatbot support (ask questions across several PDFs)
- Export chats and notes
- User authentication and accounts
- Advanced NLP features (summarization modes, clustering)
  ---

## Contributing

Contributions, issues, and feature requests are welcome.
Please open an issue to discuss changes before submitting a pull request.

---
## License

This project is licensed under the [MIT License](LICENSE).

---
