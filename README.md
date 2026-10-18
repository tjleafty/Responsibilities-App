# ChoreReward (Responsibilities App)

A family chore app: parents set up chores, goals and rewards; kids sign in to their own themed profile with a PIN, check off chores and get a celebration when they finish.

The app was built in Overskill and exported on 2026-10-18. It is moving to Vercel, with Supabase for sign-in and data.

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
| `docs/` | The original project brief and Overskill reference material |
| `vercel.json` | Vercel build settings and single-page-app routing |

## Still tied to Overskill

The app builds on its own, but these still run through Overskill's servers through `overskill-sdk`:

- Sign-in (`src/lib/auth.ts`, `src/routes/login.tsx`, `src/routes/callback.tsx`)
- All data reads and writes (`overskill.entities.*`)
- Subscriptions through Whop (`useEntitlement`)
- Push notifications (`overskill.push`, `public/sw-push.js`)
- The invite and support emails (`docs/overskill-endpoints/`, not yet ported)

The four theme preview images (`/assets/images/theme-*.png`) are hosted by Overskill and still need to be added to `public/assets/images/`.
