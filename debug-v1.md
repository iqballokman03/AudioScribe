# AudioScribe Debug v1

This document lists the main issues that need to be fixed before AudioScribe can be treated as a reliable project prototype.

Current status: **strong prototype, not production-ready yet**.

The core idea is good: upload or record audio, transcribe it with Gemini, summarize it, and export the result. However, the current version needs stronger backend validation, safer upload handling, better project structure, and clearer error handling.

---

## Priority Guide

| Priority | Meaning |
|---|---|
| P0 | Must fix first. Can break the app, create security risk, or waste API quota. |
| P1 | Important. Improves stability, maintainability, and user experience. |
| P2 | Nice to have. Makes the app more professional and scalable. |

---

# P0 — Must Fix First

## 1. Add backend upload validation

### Problem

The frontend filters audio files, but the backend still needs proper validation. A user can bypass the browser and call the API directly.

### Risk

- Non-audio files can be uploaded.
- Unsupported audio formats may break transcription.
- Public API can be abused.
- Gemini quota can be wasted.

### Fix

Add backend validation for allowed MIME types.

Suggested allowed types:

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

### Acceptance Criteria

- `.mp3`, `.wav`, `.webm`, `.ogg`, and `.m4a` uploads work.
- Non-audio uploads return `400 Bad Request`.
- Error message is clear.
- Backend does not depend only on frontend validation.

---

## 2. Add file size limit

### Problem

There is no strong backend file size limit.

### Risk

- Large uploads can overload the server.
- API quota can be wasted.
- Transcription request may timeout.

### Fix

Set a limit in Multer.

Example:

```ts
const upload = multer({
  dest: "/tmp/uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
```

### Acceptance Criteria

- Large files are rejected.
- User gets a helpful error.
- Limit applies to normal upload and chunk upload flow.

---

## 3. Add API rate limiting

### Problem

API routes can be called repeatedly without restriction.

### Risk

- Gemini quota can be drained.
- Server can be spammed.
- Public deployment becomes risky.

### Fix

Install:

```bash
npm install express-rate-limit
```

Use:

```ts
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
```

### Acceptance Criteria

- Too many requests are blocked.
- `/api/transcribe` and `/api/summarize` are protected.
- Error message is understandable.

---

## 4. Move Gemini model to environment config

### Problem

The Gemini model is hardcoded.

### Risk

- Preview model may become unavailable.
- Harder to switch to cheaper/faster models.
- Deployment becomes less flexible.

### Fix

Add this to `.env.example`:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
APP_URL=http://localhost:3000
```

Use:

```ts
const selectedModel =
  process.env.GEMINI_MODEL ||
  model ||
  "gemini-2.5-flash";
```

### Acceptance Criteria

- Model can be changed without editing source code.
- README explains the model config.
- App has a safe fallback model.

---

## 5. Improve temporary file cleanup

### Problem

Uploaded files are saved temporarily. Some cleanup exists, but failed uploads or abandoned chunks may leave files behind.

### Risk

- `/tmp/uploads` can grow over time.
- Failed transcriptions can leave files on the server.
- Cancelled chunk uploads can leave partial files.

### Fix

- Delete temp files after success or failure.
- Add cleanup for abandoned chunk uploads.
- Delete files older than a fixed time, such as 1 hour.

### Acceptance Criteria

- Failed transcription does not leave audio files behind.
- Incomplete chunk uploads are eventually removed.
- Temp directory does not grow endlessly.

---

# P1 — Important Fixes

## 6. Split `App.tsx` into smaller components

### Problem

`App.tsx` is too large and handles too many responsibilities.

### Risk

- Hard to debug.
- Hard to add new features.
- Audio logic, upload logic, UI logic, and export logic are mixed.

### Fix

Refactor into smaller components and hooks.

Suggested structure:

```txt
src/
  components/
    AudioRecorder.tsx
    FileUploader.tsx
    AudioPlayer.tsx
    TranscriptPanel.tsx
    SummaryPanel.tsx
    ExportButtons.tsx
    OnboardingModal.tsx

  hooks/
    useAudioRecorder.ts
    useAudioPlayer.ts
    useTranscription.ts

  services/
    api.ts

  utils/
    exportUtils.ts
    timeUtils.ts

  types/
    transcript.ts
```

### Acceptance Criteria

- `App.tsx` mainly handles layout and composition.
- Recording logic is moved out.
- Audio player logic is moved out.
- Export buttons are isolated.

---

## 7. Add schema validation for Gemini response

### Problem

The backend parses Gemini output with `JSON.parse`, but does not fully validate the response shape.

### Risk

- Gemini may return valid JSON with missing fields.
- UI can break when `segments` is missing.
- Transcript data becomes inconsistent.

### Fix

Install:

```bash
npm install zod
```

Create a schema:

```ts
import { z } from "zod";

const SegmentSchema = z.object({
  speaker: z.string(),
  timestamp: z.string(),
  content: z.string(),
  language: z.string(),
  language_code: z.string().optional(),
  translation: z.string().optional(),
  emotion: z.enum(["Happy", "Sad", "Angry", "Neutral"]),
});

const TranscriptSchema = z.object({
  segments: z.array(SegmentSchema),
});
```

Validate:

```ts
const parsed = TranscriptSchema.safeParse(data);

if (!parsed.success) {
  return res.status(502).json({
    error: "AI returned invalid transcript format",
  });
}
```

### Acceptance Criteria

- Invalid AI response returns a controlled error.
- Frontend does not crash.
- Missing optional fields are handled safely.

---

## 8. Improve error handling

### Problem

Error handling exists, but many failures still return broad messages.

### Risk

User cannot tell whether the issue is:

- Missing API key
- Invalid API key
- Unsupported file type
- File too large
- Gemini quota
- Invalid AI response
- Network/server issue

### Fix

Create clearer error categories.

### Acceptance Criteria

- User-facing error is simple and useful.
- Server logs keep technical detail.
- Sensitive environment details are not exposed.

---

## 9. Improve chunk upload safety

### Problem

Chunk upload appends files directly using sync file operations.

### Risk

- Server can be blocked by large chunks.
- Missing chunks may corrupt audio.
- Duplicate chunks may corrupt audio.
- Upload ID generation can be improved.

### Fix

- Use `crypto.randomUUID()` for upload IDs.
- Track chunk index.
- Track total chunks.
- Reject missing or duplicate chunks.
- Use async file operations.

Example:

```ts
import crypto from "crypto";

const uploadId = crypto.randomUUID();
```

### Acceptance Criteria

- Missing chunks are detected.
- Duplicate chunks are rejected.
- Chunk order is validated.
- Server avoids blocking sync operations for large uploads.

---

## 10. Add transcript TypeScript types

### Problem

Transcript data uses loose typing in some areas.

### Risk

- Mistyped fields can break UI.
- Refactoring becomes risky.
- Export functions may receive unexpected data.

### Fix

Create:

```txt
src/types/transcript.ts
```

Add:

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

### Acceptance Criteria

- Frontend uses `TranscriptData` instead of `any`.
- Export utilities use proper types.
- TypeScript catches invalid transcript fields.

---

## 11. Improve README accuracy

### Problem

README/product copy sounds stronger than the current implementation.

### Risk

The app may overpromise speaker recognition, timestamp precision, and emotion detection.

### Fix

Use more realistic positioning:

> AudioScribe converts audio into AI-assisted structured notes, including segmented transcripts, summaries, translations, emotions, and exportable reports.

Avoid claims like:

- “incredible accuracy”
- “world’s most advanced AI models”
- “perfect speaker recognition”
- “precise emotion detection”

### Acceptance Criteria

- README clearly explains what the app does.
- README includes limitations.
- README includes setup guide.
- README includes `.env.example`.
- README includes known issues.

---

# P2 — Product Improvements

## 12. Add authentication before public deployment

### Problem

Anyone who can access the app can use the API.

### Risk

- Gemini quota abuse.
- No user-specific transcript history.
- Cannot track usage.

### Fix

Add authentication using Supabase Auth, Firebase Auth, Clerk, or another provider.

### Acceptance Criteria

- Only logged-in users can transcribe.
- Each job belongs to a user.
- API rejects unauthenticated requests.

---

## 13. Add transcript history

### Problem

The app focuses on one active transcript at a time.

### Risk

- User loses work after refresh unless exported.
- App feels like a demo tool instead of a product.

### Fix

Store:

- Job metadata
- Transcript JSON
- Summary text
- Created timestamp
- Export timestamp

Suggested tables:

```txt
users
transcription_jobs
transcript_segments
summaries
```

### Acceptance Criteria

- User can view previous transcripts.
- User can reopen transcript.
- User can delete transcript.

---

## 14. Add job status handling

### Problem

Long transcription is handled as a direct request.

### Risk

- Request timeout.
- Bad UX for long audio.
- Hard to retry failed jobs.

### Fix

Use job states:

```txt
pending -> processing -> completed -> failed
```

### Acceptance Criteria

- Upload creates a job ID.
- Frontend can poll job status.
- Result is fetched after completion.
- Failed job shows clear reason.

---

## 15. Add tests

### Problem

There are no visible tests for critical flows.

### Risk

- Refactor can break transcription, export, upload, or summary.
- Bugs may only appear during demo.

### Fix

Add tests for:

- Time parsing utility
- Export utility
- API validation
- Transcript schema validation
- Invalid file upload rejection

### Acceptance Criteria

- Test command exists.
- Critical utilities have tests.
- API validation has basic coverage.

---

# Suggested Fix Order

Follow this order:

1. Add upload MIME validation.
2. Add file size limit.
3. Add API rate limit.
4. Move Gemini model config to `.env`.
5. Add Gemini response schema validation.
6. Improve error handling.
7. Improve temporary file cleanup.
8. Refactor `App.tsx`.
9. Improve chunk upload safety.
10. Add transcript types.
11. Rewrite README.
12. Add tests.
13. Add auth and transcript history.

---

# Minimum Standard Before Demo

Before showing this project seriously, the app should have:

- Backend file validation
- File size limit
- Rate limit
- Working `.env.example`
- Clear README setup guide
- No hardcoded unstable model dependency
- Clean error messages
- Basic component separation

---

# Final Note

AudioScribe has a good product direction. The next move should not be adding more features. The next move should be making the existing transcription flow safer, cleaner, and easier to maintain.
