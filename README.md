# AudioScribe

AudioScribe is an AI-assisted audio transcription and summarization app. It allows users to upload or record audio, generate structured transcript segments, summarize the transcript, and export the result into multiple document formats.

This project is currently a strong prototype. It is suitable for demo and development, but it still needs security hardening, backend validation, and architecture cleanup before public production deployment.

---

## Features

- Upload audio files
- Record audio from microphone
- Transcribe audio using Gemini AI
- Generate speaker-based transcript segments
- Include timestamps, language labels, translations, and emotion labels where available
- Summarize transcript text
- Export transcript and summary to multiple formats
- Play audio with timestamp navigation
- Responsive React interface

---

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Express, Node.js |
| AI | Google Gemini via `@google/genai` |
| Upload | Multer |
| Export | DOCX, jsPDF, JSON, TXT |
| UI | Lucide React, Motion |

---

## Project Structure

```txt
AudioScribe/
├── docs/
│   ├── architecture-v2.md
│   ├── backend-refactor-v1.md
│   ├── debug-v1.md
│   ├── deployment-guide.md
│   ├── frontend-refactor-v1.md
│   └── security-audit-v1.md
│
├── src/
│   ├── services/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
│
├── server.ts
├── package.json
├── index.html
└── README.md
```

---

## How It Works

```txt
User uploads or records audio
        ↓
React frontend sends audio to backend
        ↓
Express receives and processes upload
        ↓
Backend sends audio to Gemini
        ↓
Gemini returns structured transcript data
        ↓
Backend formats response
        ↓
Frontend displays transcript and summary tools
        ↓
User exports result
```

---

## Environment Variables

Create a `.env` or `.env.local` file.

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
APP_URL=http://localhost:3000
PORT=3000
```

### Notes

- `GEMINI_API_KEY` is required.
- `GEMINI_MODEL` should be configurable instead of hardcoded.
- Do not commit real API keys to GitHub.

---

## Run Locally

### Prerequisites

- Node.js
- npm
- Gemini API key

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

The app should run at:

```txt
http://localhost:3000
```

---

## Build for Production

```bash
npm run build
```

Start production server:

```bash
npm run start
```

---

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build frontend and backend |
| `npm run start` | Run production server |
| `npm run preview` | Preview Vite build |
| `npm run clean` | Remove build output |
| `npm run lint` | Run TypeScript check |

---

## Documentation

More planning and technical notes are available in the `docs/` folder.

| Document | Purpose |
|---|---|
| `docs/debug-v1.md` | Fix checklist and known issues |
| `docs/security-audit-v1.md` | Security risks and hardening plan |
| `docs/backend-refactor-v1.md` | Backend cleanup plan |
| `docs/frontend-refactor-v1.md` | Frontend cleanup plan |
| `docs/architecture-v2.md` | Proposed scalable architecture |
| `docs/deployment-guide.md` | Deployment notes and checklist |

---

## Current Limitations

AudioScribe is not production-ready yet.

Known limitations:

- Backend upload validation needs improvement
- File size limit needs to be enforced properly
- API rate limiting is needed
- No authentication yet
- No transcript history yet
- No database-backed job tracking yet
- Gemini response should be schema-validated
- `App.tsx` should be split into smaller components and hooks
- Long transcription should eventually use job-based processing

See `docs/debug-v1.md` and `docs/security-audit-v1.md` for details.

---

## Recommended Next Fixes

Priority order:

1. Add backend MIME validation
2. Add file size limit
3. Add API rate limiting
4. Move Gemini model config fully into environment variables
5. Add Gemini response schema validation
6. Improve error handling
7. Improve temporary file cleanup
8. Refactor `App.tsx` into components and hooks
9. Improve chunk upload safety
10. Add transcript TypeScript types

---

## Deployment Notes

For early testing, the app can be deployed as one full-stack Node.js app.

For a more scalable setup:

```txt
Frontend: Vercel
Backend: Render / Railway / VPS
Database: Supabase
Auth: Supabase Auth / Clerk / Firebase Auth
```

Read `docs/deployment-guide.md` before deploying publicly.

---

## Security Warning

Do not expose the app publicly without adding:

- Upload validation
- File size limit
- Rate limiting
- Authentication
- Temporary file cleanup
- Safe error handling

Without these protections, users may abuse the API or consume Gemini quota.

---

## Project Status

Current stage: **Prototype**

Target stage: **Reliable demo-ready AI transcription tool**

Future direction:

- User accounts
- Transcript history
- Job queue processing
- Better transcript editor
- Team/workspace support
- Searchable transcript archive
- AI action item extraction

---

## License

No license has been specified yet.

Add a license before public distribution if this project will be shared or reused by others.
