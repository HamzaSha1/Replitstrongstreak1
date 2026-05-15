# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Firestore index deployment

Composite indexes for Firestore are defined in `firestore.indexes.json` (root). To apply them:

```bash
# Prerequisites: Firebase CLI installed and logged in
npm install -g firebase-tools   # one-time
firebase login                  # one-time
firebase use --add              # link to your Firebase project (one-time)

# Deploy indexes only (safe, non-destructive)
pnpm run deploy:indexes
# equivalent: firebase deploy --only firestore:indexes
```

The `firebase.json` at the repo root points Firebase CLI to `firestore.indexes.json`. Index builds are asynchronous — Firestore reports build status in the Firebase console under Firestore → Indexes. Queries against `exerciseHistory` will return a "requires an index" error until the index finishes building.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
