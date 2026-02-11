# AI Interview Coach - Backend

FastAPI backend for AI Interview Coach MVP.

## Setup

### 1. Create virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 4. Setup PostgreSQL database

Create a PostgreSQL database:

```sql
CREATE DATABASE ai_interviewer;
```

Update `DATABASE_URL` in `.env` with your database credentials.

### 5. Run the application

```bash
python main.py
```

The API will be available at `http://localhost:8000`.

API documentation: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py               # Configuration management
├── database.py             # Database connection
├── models/                 # SQLAlchemy models
├── schemas/                # Pydantic schemas
├── api/                    # API routes
├── agents/                 # LangGraph agents (Phase 2)
├── services/               # Business logic
└── utils/                  # Utilities
```

## API Endpoints

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `POST /api/projects/{id}/upload-resume` - Upload resume PDF

### Sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions?project_id={id}` - List sessions
- `GET /api/sessions/{id}` - Get session
- `DELETE /api/sessions/{id}` - Delete session
