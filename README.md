# Anime Curator

Personalized anime recommendations powered by AniList and OpenAI. Built with Next.js (App Router) and TailwindCSS. Deploy-ready for Vercel.

## Features (v1)
- Chat-like UI to converse with an anime expert agent
- The agent asks for your favorite anime, fetches details from AniList, and suggests 2–3 similar titles with reasoning
- Session-only preferences (no database yet)
- API route orchestrates AniList + OpenAI

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
- Copy `.env.example` to `.env.local` and set values
- Required:
  - `OPENAI_API_KEY` – your OpenAI API key

3. Run the dev server:
```bash
npm run dev
```
Open http://localhost:3000

## Tech Notes
- Next.js App Router under `app/`
- Chat endpoint at `app/api/chat/route.ts`
- AniList helpers in `lib/anilist.ts`
- OpenAI helpers in `lib/openai.ts`
- Tailwind configured in `tailwind.config.ts`, styles in `app/globals.css`

## Deploy (Vercel)
- Push to a Git repo and import to Vercel
- Set `OPENAI_API_KEY` in Vercel Project Settings → Environment Variables
- No build customization required (`next build`)

## Future Extensions
- User accounts and persistent preferences
- Multiple content providers (e.g., MyAnimeList, Kitsu)
- Caching responses and rate limiting
- Vector similarity for richer recommendations
