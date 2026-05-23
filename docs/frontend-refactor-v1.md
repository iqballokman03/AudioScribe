# AudioScribe Frontend Refactor v1

## Goal

Refactor frontend into reusable components and hooks.

---

## Current Problems

- `App.tsx` is too large
- UI state mixed with audio logic
- Hard to maintain
- Hard to debug
- Difficult to scale features

---

## Suggested Structure

```txt
src/
  components/
    AudioRecorder.tsx
    FileUploader.tsx
    AudioPlayer.tsx
    TranscriptPanel.tsx
    SummaryPanel.tsx
    ExportButtons.tsx
    LoadingOverlay.tsx
    OnboardingModal.tsx

  hooks/
    useAudioRecorder.ts
    useAudioPlayer.ts
    useTranscription.ts
    useSummary.ts

  services/
    api.ts

  types/
    transcript.ts

  utils/
    exportUtils.ts
    timeUtils.ts
```

---

## Refactor Goals

### 1. Component Isolation

Each UI section should have one responsibility.

### 2. Custom Hooks

Move logic out of components:

- audio recording
- playback control
- API requests
- progress tracking

### 3. Shared Types

Create shared transcript types.

### 4. Shared API Layer

All API calls should go through `api.ts`.

### 5. Cleaner State Management

Avoid giant state management inside one component.

---

## Recommended Improvements

- Add React Query or SWR
- Add error boundary
- Add loading skeletons
- Add toast notification system
- Add retry button for failed requests
- Add transcript virtualization for long transcripts

---

## Refactor Priority

1. Split components
2. Move hooks
3. Create shared types
4. Create API layer
5. Improve loading/error UI
6. Add state management if needed
