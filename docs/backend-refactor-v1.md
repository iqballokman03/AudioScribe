# AudioScribe Backend Refactor v1

## Goal

Refactor backend into modular structure for maintainability and scalability.

---

## Current Problems

- Everything inside one `server.ts`
- Upload logic mixed with Gemini logic
- No route separation
- No middleware separation
- No validation layer
- Hard to debug and scale

---

## Suggested Structure

```txt
server/
  index.ts

  routes/
    transcribe.route.ts
    summarize.route.ts
    upload.route.ts

  controllers/
    transcribe.controller.ts
    summarize.controller.ts
    upload.controller.ts

  services/
    gemini.service.ts
    upload.service.ts
    transcript.service.ts

  middleware/
    upload.middleware.ts
    rateLimit.middleware.ts
    error.middleware.ts

  validators/
    transcript.schema.ts
    upload.schema.ts

  utils/
    logger.ts
    cleanup.ts
```

---

## Refactor Goals

### 1. Separate routes

Each route should only register endpoints.

### 2. Separate controllers

Controllers should handle request/response only.

### 3. Separate services

Business logic should live in services.

### 4. Add middleware

Middleware should handle:
- upload validation
- rate limiting
- errors
- logging

### 5. Add validation layer

Use Zod for:
- Gemini response validation
- request validation
- upload metadata validation

---

## Recommended Middleware

```bash
npm install helmet cors express-rate-limit zod
```

---

## Recommended Backend Features

- Structured logger
- Job queue system
- Retry handling
- Async chunk upload
- User authentication
- Usage tracking
- Background cleanup worker

---

## Refactor Priority

1. Extract routes
2. Extract Gemini service
3. Add validation
4. Add middleware
5. Add logger
6. Add auth layer
7. Add job queue
