This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

The following environment variables must be set (locally in `.env.local`, and in Vercel's Project Settings for production deployments):

- `DATABASE_URL` — Postgres connection string used by Drizzle (`src/db/index.ts`).
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key, used by the browser and server (session-scoped) clients.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key. Required specifically for the `/users` page's account-creation feature (`src/lib/supabase/admin.ts`), which needs elevated privileges to create auth users. Without it, admin-initiated user creation fails with a friendly error instead of a crash.
- `ANTHROPIC_API_KEY` — API key for Anthropic/Claude-powered functionality.

Missing any of these will either fail fast at startup (`DATABASE_URL`) or surface as a handled error in the affected feature (`SUPABASE_SERVICE_ROLE_KEY`), rather than crashing the app outright.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
