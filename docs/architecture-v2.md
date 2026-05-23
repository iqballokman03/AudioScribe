# AudioScribe Architecture v2

## Goal

Move AudioScribe from prototype architecture into scalable production-ready architecture.

---

## Current Architecture

```txt
Frontend (React)
  ↓
Express Server
  ↓
Gemini API
```

Current limitations:
- No auth
- No database
- No job queue
- No transcript history
- Long requests handled directly

---

# Proposed Architecture v2

```txt
Frontend (React + Vite)
  ↓
API Gateway / Express Server
  ↓
Authentication Layer
  ↓
Transcription Job Queue
  ↓
Gemini Processing Service
  ↓
Database Storage
  ↓
Export Service
```

---

## Frontend Responsibilities

- Audio upload
- Audio recording
- Job status polling
- Transcript rendering
- Summary rendering
- Export handling
- Transcript history UI

---

## Backend Responsibilities

- Authentication
- Upload validation
- API rate limiting
- Job creation
- AI processing
- Error handling
- Transcript storage
- Export generation

---

## Database Design

### users

```txt
id
email
name
created_at
```

### transcription_jobs

```txt
id
user_id
status
audio_file
created_at
completed_at
```

### transcript_segments

```txt
id
job_id
speaker
timestamp
content
language
emotion
```

### summaries

```txt
id
job_id
summary
created_at
```

---

## Recommended Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Query

### Backend

- Express
- Zod
- Multer
- Helmet
- Rate Limit

### Database

- Supabase PostgreSQL
- SQLite for local development

### Auth

- Supabase Auth
- Clerk
- Firebase Auth

---

## Recommended Future Features

- Real-time progress updates
- Speaker timeline view
- Transcript search
- Transcript tagging
- Multi-language summary
- AI action items extraction
- Team workspace
