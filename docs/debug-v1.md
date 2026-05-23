# AudioScribe Debug v1

Status: strong prototype, not production-ready yet.

This file lists the main bugs and weaknesses that should be fixed before demo or deployment.

## P0 — Must Fix

### 1. Backend upload validation

Problem: frontend filters audio, but backend can still be called directly.

Fix:
- Validate MIME type on backend.
- Reject non-audio files.
- Return clear `400 Bad Request` errors.

Allowed types:

```ts
const allowedMimeTypes = [
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
];
```

### 2. File size limit

Problem: uploaded files can be too large.

Fix:

```ts
const upload = multer({
  dest: "/tmp/uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
```

### 3. API rate limit

Problem: public users can spam `/api/transcribe` and `/api/summarize`.

Fix:

```bash
npm install express-rate-limit
```

```ts
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

app.use("/api", apiLimiter);
```

### 4. Move Gemini model to env

Problem: model is hardcoded.

Fix:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
APP_URL=http://localhost:3000
```

### 5. Temp file cleanup

Problem: failed uploads or cancelled chunk uploads may leave temp files.

Fix:
- Delete temp files after success and failure.
- Add cleanup for files older than 1 hour.
- Clean abandoned chunk uploads.

## P1 — Important

### 6. Split `App.tsx`

Current issue: too many responsibilities in one file.

Suggested structure:

```txt
src/components/AudioRecorder.tsx
src/components/FileUploader.tsx
src/components/AudioPlayer.tsx
src/components/TranscriptPanel.tsx
src/components/SummaryPanel.tsx
src/components/ExportButtons.tsx
src/hooks/useAudioRecorder.ts
src/hooks/useAudioPlayer.ts
src/hooks/useTranscription.ts
src/types/transcript.ts
```

### 7. Add schema validation

Problem: Gemini response is parsed but not fully validated.

Fix:

```bash
npm install zod
```

Validate `segments`, `speaker`, `timestamp`, `content`, `language`, and `emotion` before sending data to frontend.

### 8. Improve error handling

Create specific error categories:
- Missing API key
- Invalid API key
- Unsupported file type
- File too large
- Gemini quota issue
- Invalid AI response
- Unknown server error

### 9. Improve chunk upload safety

Fix:
- Use `crypto.randomUUID()`.
- Track chunk index and total chunks.
- Reject duplicate or missing chunks.
- Avoid sync file operations for large files.

### 10. Add transcript types

Create `src/types/transcript.ts`:

```ts
export type TranscriptSegment = {
  speaker: string;
  timestamp: string;
  content: string;
  language: string;
  language_code?: string;
  translation?: string;
  emotion: "Happy" | "Sad" | "Angry" | "Neutral";
};

export type TranscriptData = {
  segments: TranscriptSegment[];
};
```

## P2 — Product Improvements

- Add authentication before public deployment.
- Add transcript history.
- Add job status flow: `pending -> processing -> completed -> failed`.
- Add tests for upload validation, schema validation, export utilities, and time parsing.

## Suggested Fix Order

1. Backend upload validation
2. File size limit
3. API rate limit
4. Gemini model env config
5. AI response schema validation
6. Error handling
7. Temp cleanup
8. Split `App.tsx`
9. Chunk upload safety
10. Transcript types
11. README cleanup
12. Tests

## Minimum Demo Standard

Before demo, the app should have:

- Backend file validation
- File size limit
- Rate limit
- `.env.example`
- Clear README setup
- No hardcoded unstable model dependency
- Clean error messages
- Basic component separation
