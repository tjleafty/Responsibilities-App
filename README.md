# ChoreReward (Responsibilities App)

A family chore app: parents set up chores, goals and rewards; kids sign in to their own themed profile with a PIN, check off chores and get a celebration when they finish.

The app was built in Overskill and exported on 2026-10-18. It runs on Vercel, with Supabase for sign-in and data.

## Run it

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # outputs dist/
```

## Layout

| Path | What |
|---|---|
| `src/` | The React + Vite + TypeScript app (Tailwind and shadcn/ui) |
| `src/components/` | App screens: parent dashboard, child dashboard, chores, goals, rewards, themes |
| `public/` | Static files, served as-is |
| `chore-rewards/` | Reward animations, sounds and themes. The live app loads these from this repo, so don't move or delete them. |
| `supabase/migrations/` | Database schema exported from Overskill |
| `api/` | Vercel functions for the invite and support emails |
| `docs/` | The original project brief from Overskill |
| `vercel.json` | Vercel build settings and single-page-app routing |

## Setup

1. Create a Supabase project and run `supabase/migrations/` against it (SQL editor or `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. In Supabase > Authentication > URL Configuration, set the Site URL to where the app runs and add `/dashboard` and `/settings` redirect URLs.
4. On Vercel, import this repo and add the same environment variables. The invite and support emails in `api/` also need `RESEND_API_KEY` and `EMAIL_FROM`.

## How it works

- Parents sign in with email and password (Supabase Auth). Every row in the database belongs to that parent account, and row-level security keeps each family's data private.
- Kids don't have their own logins. On the parent's signed-in device, each family member picks their profile and enters their four-digit PIN.
- `src/lib/db.ts` is the data layer the screens use; `src/lib/auth.ts` holds sign-in state.
- `api/` holds the two Vercel functions: friend invites and support requests, sent by email through Resend.
