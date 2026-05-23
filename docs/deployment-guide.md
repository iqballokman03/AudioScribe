# AudioScribe Deployment Guide

## Recommended Deployment Flow

Frontend and backend can be deployed together or separately.

Recommended for small deployment:

```txt
Frontend + Backend
↓
Single VPS / Railway / Render
```

Recommended for scalable deployment:

```txt
Frontend → Vercel
Backend → VPS / Railway / Render
Database → Supabase
```

---

## Environment Variables

Create `.env`:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
APP_URL=http://localhost:3000
PORT=3000
```

---

## Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

---

## Production Build

Build frontend and backend:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

---

## Recommended Security Before Deployment

- Enable HTTPS
- Add upload validation
- Add file size limit
- Add rate limiting
- Hide API keys
- Enable error sanitization
- Add authentication

---

## Recommended Hosting

### Beginner Friendly

- Railway
- Render
- Vercel + Render

### More Control

- Contabo VPS
- DigitalOcean
- Hetzner

---

## Recommended Reverse Proxy

Use Nginx:

```txt
Client
  ↓
Nginx
  ↓
Express Server
```

Benefits:
- HTTPS
- Compression
- Better security
- Better routing

---

## Recommended Monitoring

- PM2
- Uptime Kuma
- Sentry
- Better Stack

---

## Production Checklist

- [ ] `.env` configured
- [ ] HTTPS enabled
- [ ] Upload validation added
- [ ] File size limit added
- [ ] API rate limit added
- [ ] Authentication added
- [ ] Error logging added
- [ ] Temp cleanup added
- [ ] Production build tested
- [ ] Reverse proxy configured
