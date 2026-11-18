# Ona-Bola Signal

Perinatal high-risk registry for district healthcare teams: a registry of pregnant patients, measurements over time, Green / Yellow / Red risk zones with reasons, and alerts that a specialist acknowledges. Built for the AI National Hackathon (Tashkent stage, medicine track, problem #9).

> **Prototype.** Synthetic data only. Demo rules are illustrative and are not clinical guidance. The deterministic Risk Engine sets every zone; Claude only extracts, summarises and explains. A clinician stays responsible for every decision.

## Quick start

Requirements: Node 22.12 or newer (24 works), npm 10+, Docker Desktop running. Run every command from the repository folder, the one that holds this README.

```bash
cd ona-bola-signal
npm install
npm run db:up      # Postgres 16 on localhost:5433
npm run db:reset   # tables + synthetic demo data (24 patients, demo patient OB-DEMO-01)
npm run dev        # API on http://localhost:3001, web app on http://localhost:5173
```

The app runs with built-in defaults. Copy `backend/.env.example` to `backend/.env` only to change one.

Check the whole demo flow in Chrome (resets the local demo data before and after, saves screenshots to `docs/demo/`):

```bash
npm run e2e
```

**Claude features** (reading a note into the form, explaining an assessment) are off by default. To turn them on, set `AI_ENABLED=true` and `ANTHROPIC_API_KEY` in `backend/.env` and restart `npm run dev`. Without them, or without internet, everything else works and the AI controls stay hidden.

**Taking over the project?** Start with [`docs/HANDOVER.md`](docs/HANDOVER.md) (in Russian): status, how everything fits together, and what to do next. The demo and checkpoint script is [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## Scripts (from the repository root)

| Script                            | What it does                                             |
| --------------------------------- | -------------------------------------------------------- |
| `npm run dev`                     | Backend (tsx watch) and frontend (Vite) together         |
| `npm run typecheck`               | TypeScript checks in every workspace                     |
| `npm test`                        | Vitest in `shared` and `backend`                         |
| `npm run e2e`                     | Playwright demo flow in Chrome (resets local demo data)  |
| `npm run build`                   | Production build of the frontend                         |
| `npm run format` / `format:check` | Prettier                                                 |
| `npm run db:up` / `db:down`       | Start or stop the Postgres container                     |
| `npm run db:generate`             | Generate a SQL migration from `backend/src/db/schema.ts` |
| `npm run db:migrate`              | Apply migrations to `DATABASE_URL`                       |
| `npm run db:reset`                | Migrate, wipe and reload the demo data (local DBs only)  |

## Layout

```
shared/     contracts: Zod schemas and types used by both sides (no logic, no build step)
backend/    Express 5 API, Drizzle + Postgres, Risk Engine (backend only), Claude service
frontend/   Vite + React app: registry, patient page, alert inbox, dashboard
e2e/        Playwright demo flow (playwright.config.ts at the root)
docs/       brief, handover, decisions, rule provenance, mentor questions, demo script, demo screenshots
data-pack/  domain research pack: protocol PDFs, extended rules, risk scales, synthetic seed (kept as delivered)
```

## Working agreements

- **Contracts first.** Every request and response is defined in `shared/src/api.ts` and validated on the server. Once v1 is frozen, contracts change only by adding optional fields: never rename or remove.
- **The frontend never computes a zone.** It shows what the backend returns.
- **One owner per file** (team of three).
  - Person 1, Backend: `backend/src/db`, `backend/drizzle/`, `backend/src/scripts/`, services, routes, middleware, `app.ts`, integration tests.
  - Person 2, Risk Engine and domain: `backend/src/risk-engine/`, `docs/RULES_PROVENANCE.md`, demo data content, the Claude service, mentor questions, pitch.
  - Person 3, Frontend: `frontend/`.
  - Changes to `shared/` get a quick review from persons 1 and 3.
- **Migrations are append-only.** Never edit a merged migration; never reset a shared database.
- **No real patient data, ever.** No secrets in git. The Anthropic key lives only in `backend/.env`.
- **Every rule has a provenance row** in `docs/RULES_PROVENANCE.md`.

## Status

| Phase                                                 | State                                     |
| ----------------------------------------------------- | ----------------------------------------- |
| P0 Scaffold and contracts v1                          | Done; contracts await the team's sign-off |
| P1 Data foundation (schema, seed, read API)           | Done, including `POST /api/patients`      |
| P2 Risk Engine (illustrative rules, national sources) | Done                                      |
| P3 Measurement → assessment → alert → acknowledgement | Done                                      |
| P4 Frontend workflow (Uzbek UI, Russian and English)  | Done                                      |
| P5 Claude (note → form draft, explanation)            | Done, off by default; not yet run live    |
| P6 Stabilise and rehearse                             | e2e, offline and secrets checks done      |

See `docs/DECISIONS.md` for the choices behind the code and `docs/HANDOVER.md` for the full picture.
