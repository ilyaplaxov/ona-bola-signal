# Decisions

Short log of choices that shape the code, newest first. Add an entry whenever a decision is made or changed.

## 2026-11-18 · After the mentor session: sign-in, access rules, referrals, files, patient signals, document reading, DIMED

Built by participant 1 (backend and `shared/`) from `docs/TEAM_PLAN.md`. Contracts went to `main` first so the frontend could start.

- **Sign-in replaces the role switcher (this changes brief section 11).** The brief said no password system for the demo; the mentor asked for doctor accounts. Seeded accounts sign in with a username and a shared demo password (`demo2026`, shown on the login page while `DEMO_ACCOUNTS` is on). Passwords are scrypt hashes (Node's `crypto`, no new dependency). The session is an httpOnly, SameSite=Lax cookie for 12 hours; only the token's SHA-256 is stored. Sign-in, failed attempts (without the typed username) and sign-out are audited.
  - **Transition:** the old `x-demo-user-id` header still works behind `AUTH_DEMO_HEADER` (on outside production), and anonymous reads stay open in that mode, so the current frontend and e2e keep working. Once the login page lands, set `AUTH_DEMO_HEADER=false`: every route except health, sign-in, the rule set and the patient's own signal page then needs a session.
- **Access matrix enforced on the server** (`shared/src/permissions.ts`, draft from TEAM_PLAN section 2, to be checked with a doctor). Who sees which patients:
  - doctors and nurses: their district;
  - the alert recipient (SPECIALIST without a specialty): their district, or all districts when none is set;
  - consultants (SPECIALIST with a specialty): only patients with an open referral (SENT, ACCEPTED, CONCLUDED) to them or their specialty;
  - managers: everything, read-only.

  Other patients answer 403. Registration and edits are the doctor's, in their own district; nurses record visits. Lists, the dashboard and the audit feed are filtered the same way. `?assigned=me` gives "My patients".

- **Interpretation:** "see their own patients" in the plan's matrix is read as "their district", because a polyclinic obstetrician covers a district and the demo data is organised that way. The `assigned=me` filter gives the narrower list.
- **Referrals** (mentor item 3).
  - Flow: SENT → ACCEPTED → CONCLUDED → CLOSED. The addressee accepts and concludes; the author closes or cancels. A step that does not fit the status is a 409.
  - Addressing: a specialty, or a named consultant of that specialty.
  - The specialty list (`Specialty`) is a draft; participant 3 confirms it with a doctor.
  - The reason and the conclusion never go to the audit log.
  - Two consultants (endocrinologist, cardiologist) were added to the seed.
- **Attachments** (mentor items 5–7). One file per upload, 10 MB limit, parsed with multer 2.5.0 (the one new dependency).
  - The type is decided from the file's first bytes: PDF, JPEG, PNG or DICOM. A file renamed to `.pdf` is refused.
  - Files are stored under random keys in `UPLOADS_DIR` (git-ignored). The original name is kept for clinicians and never written to the audit log.
  - MRI (DICOM) is stored and downloadable but not rendered; a viewer comes after the hackathon.
- **Patient signals** (TEAM_PLAN section 2a; our own idea, the assumptions there still need a mentor).
  - The buttons are the protocol's 13 alarm signs (АУ с. 30, same ids as `data-pack/protocol-data.ts`), plus "labour has started" and "call me back".
  - The patient is told at once: seek medical help now / call 103 or go to the maternity hospital / your doctor will call. The first is the protocol's wording; 103 is the ambulance number.
  - Signals never change the zone. A NEW signal counts as escalated after 30 minutes; this is a setting, not a clinical rule.
  - Linking uses a one-time 8-character code (24 hours, hash stored) and needs the patient's consent first. One Telegram chat holds one patient.
  - Abuse limits: code attempts are limited per address; the same button within 5 minutes counts as one signal; at most 10 signals an hour per device.
  - The Telegram bot uses long polling with `fetch`, so it needs no public server and no extra dependency. It runs only with `TELEGRAM_BOT_TOKEN`. It never asks for a name or phone and never sends a zone, a diagnosis or a lab value.
  - Texts in uz/ru/en live in `shared/src/patient-signal-texts.ts` for the bot and the web page; a native speaker should check them.
- **AI reads uploaded reports.**
  - What Claude gets: a PDF as a document block, an image as an image block.
  - What it returns: the same four measurements as note analysis, plus the gestational age an ultrasound report states for its scan date. It copies the age and never computes it from biometry.
  - Checks: unit conversion and form checks as for notes. The dating gets the same checks as typed input.
  - Nothing is saved: the clinician confirms.
  - A live run on Haiku 5.5 with a synthetic PDF took 7 s and returned the correct values. It first listed absent measures as "missing", so the prompt now says not to.
  - The audit records the kind of draft, never the content.
  - Sending real documents to an external model would need a data-processing agreement; the demo uses synthetic files only.
- **DIMED** (mentor items 1 and 8). We have neither access nor documentation, so we built the integration layer with a stub at the far end.
  - The outbox gets a row in the same transaction as each new patient, visit, file and consultant conclusion.
  - A sender in the API process delivers it every 5 s, with back-off up to 5 attempts, and audits each delivery and failure.
  - `DIMED_MODE=stub` is the default; only `DimedClient` changes when access arrives. Participant 3 is finding out what DIMED accepts.
- Migrations 0003–0007. All tests: 29 shared, 162 backend, 5 e2e.

## 2026-11-18 · Pregnancy dating, patient editing, district overview, AI chat

- **The pregnancy is dated, not the due date typed in.** The form asks for the first day of the last menstrual period, or for an ultrasound scan (date plus gestational age in weeks and days). The server derives the LMP-equivalent start and the due date (+280 days, Naegele) with shared helpers (`shared/src/pregnancy.ts`).
  - New contract fields: `CreatePatientRequest.dating`, plus `pregnancyStartDate`, `datingMethod` and `gestationalAgeDays` on `PatientDetail`. `estimatedDueDate` stays for API clients, but not together with `dating`.
  - Migration 0002 adds `patients.pregnancy_start_date` and `dating_method`.
  - A date in the future, or a start more than 45 weeks ago, is rejected. That is a data-entry bound (no pregnancy lasts 45 weeks), not a clinical rule.
  - The card shows "32 нед. 3 дн. (по последней менструации)".
- **`PATCH /api/patients/:id`** edits a patient; the reference never changes. `PATIENT_UPDATED` records the changed field names only. Changing the dating, date of birth or risk factors of an assessed patient re-runs the engine in the same transaction (a re-check, with the normal alert policy), so the zone never lags behind a corrected record. The registration and edit form also takes parity, BMI and 15 common anamnesis flags, so risk groups work for new patients.
- **Protocol actions on risk-group cards are labelled** "in the protocol (illustrative, the clinician decides)" (brief 6.2 and 17.6: demo rules are not medical recommendations).
- **District overview** on the dashboard: zone counts and pending alerts per district (`DashboardStats.districts`, optional field), each district linking to the filtered registry. Profile edits now appear in the activity feed.
- **AI chat for the clinician** (`POST /api/patients/:id/ai/chat`, the card "AI assistant").
  - The conversation lives in the browser; at most the last 12 messages are sent, alternating and ending with the clinician's question.
  - Claude gets a de-identified record in the system prompt: age, gestational age, risk factors and groups, the engine's facts, and the measurement history. No name, reference, district, facility or date of birth (a test checks this).
  - The prompt forbids setting or questioning a zone, diagnosing, and naming medicines, doses or durations. It also forbids adding facts that are not in the record, and quoting codes.
  - The first live run on Haiku 5.5 added "until 38 weeks" to aspirin, which was not in the record. The prompt was tightened, and the answer now refers to the risk-group card and the protocol instead.
  - Audit `AI_CHAT_ANSWERED` records model, language and sizes, never the text.
- **Git:** first commit made on 18 Nov; the team asked for no Claude co-author trailer in commits. Hackathon materials in the repository root (organiser slides, problem list, pitch template, a copy of the brief) are left out of git.

## 2026-11-18 · Russian interface

- **A third interface language, Russian** (UZ / RU / EN buttons; Uzbek stays the default). Every dictionary in `frontend/src/i18n/strings.ts` has a `ru` entry, and TypeScript fails the build if one is missing. Dates read "18 ноября 2026", protocol pages "с. 34".
- **`Language` in the contracts gained `"ru"`** (additive), so Claude also writes explanations, note warnings and its own remarks in Russian; `services/note-draft.ts` has Russian warning texts.
- **Counts agree with the number** ("1 причина", "3 причины", "0 причин"): `patient.reasonsCount` became a function in every language.
- `npm run e2e` checks the Russian switch and saves `docs/demo/07-russian-interface.png`.

## 2026-11-18 · Rule set `demo-0.2`: protocol pages on the card, trimester haemoglobin, stale data by the visit schedule, risk-group badges

The four checkpoint items of `data-pack/README.md` ("Идеи — что даст очки", items 1–4). The set stays ILLUSTRATIVE; zones are still set only by `assess()`. Details and pages: `docs/RULES_PROVENANCE.md`.

- **A protocol page under every reason.** Rule sources gain structured `citations` (document and printed pages; new optional field `RuleSource.citations`, document ids in `SourceDocument`), next to the full English reference. The patient card shows "Manba: «Антенатальный уход» milliy protokoli, 34-bet" under each reason and under stale-data warnings; the rules page shows the same line next to the reference. A rule no protocol supports says "protokolda yoʻq, jamoa tanlovi" (not in the protocols, team choice).
  - The card matches rules by id in `GET /api/ruleset` (the active set) instead of storing the source in each assessment, so stored assessments do not change. A reason whose rule is not in the active set shows no source line; after `npm run db:reset` every assessment comes from the active set.
  - The Uzbek interface names the protocols by their official Russian titles, as doctors cite them; English uses translations; hovering shows the full official title and the order. All of it is in `SOURCE_LABELS` (`frontend/src/i18n/strings.ts`).
  - A test checks that every cited page also appears in the reference text, so the two cannot drift apart.
- **Week ranges on rules** (`gestationalWeeks`; new optional field on `RuleInfo`, engine field on threshold and data-quality rules). `{ from, to }` is half-open: `from ≤ week < to`.
  - **A threshold rule checks the week on the date of each reading it reads**, not today's week. A lab value is judged by the norm of the week it was taken in, so a re-check later in pregnancy never re-reads an old value (and cannot raise an alert without new data). The reading's week is added to the reason as an observed value ("homiladorlik muddati: 28 hafta").
  - **A data-quality rule checks today's week**, because the schedule asks what is due now.
  - **`{ unknown: true }`** limits a rule to patients without a due date. Each week-specific family has one, with the stricter value, so a missing due date never hides a finding. Such a rule still needs the reading itself: the engine never fires on missing values.
- **Haemoglobin by trimester** (antenatal protocol p. 28, anaemia protocol p. 13). `DEMO-HB-LOW` became `DEMO-HB-LOW-T1` (below 110 g/L before week 14), `-T2` (below 105 g/L in weeks 14–27), `-T3` (below 110 g/L from week 28) and `-NO-WEEK` (below 110 g/L, anaemia protocol p. 12). Zone unchanged: Yellow. Haemoglobin of 105–109 g/L in the second trimester is no longer anaemia.
  - The protocol ends the first trimester at 13+6 weeks (p. 16) but gives no second/third boundary; 28 weeks is the domain pack's convention. The third-trimester threshold contradicts p. 20 (105 g/L); we follow p. 28 and the anaemia protocol (110). Both are mentor questions.
- **Stale data by the visit schedule** (antenatal protocol pp. 14, 17, 20; values from the domain pack). The flat 56-day `DEMO-DQ-BP-STALE` became `DEMO-DQ-BP-STALE-EARLY` (105 days before week 28), `-LATE` (35 days from week 28) and `-NO-WEEK` (35 days, the shortest gap). New `DEMO-DQ-HB-STALE`: from week 28, haemoglobin older than 112 days means the 26-week blood count was missed. Warnings only, as before. The missing 26–28-week OGTT needs a glucose context in the contracts and is not implemented.
- **Not adopted from the pack yet:** split systolic/diastolic rules, moderate and very severe anaemia bands, glucose by sample type and HbA1c, response-to-iron and the other trend rules. Each needs a contract change, a mentor answer or a source; the list is in `docs/RULES_PROVENANCE.md`.
- **Seed** (`backend/src/scripts/seed-data.ts`): OB-0001 now has haemoglobin 107 g/L at 22 weeks (Green, second-trimester norm) and OB-0002 has 104 → 107 g/L, the last at 28 weeks (Yellow, third-trimester norm), so the pitch can show one value giving two zones. OB-0019's falling haemoglobin is 116 → 104 → 100 g/L, so its Yellow zone and acknowledged alert still come from the same visit. Zone counts (3 / 9 / 11 / 1), alerts (10, 7 pending) and the demo patient OB-DEMO-01 are unchanged.
- **Labels are tested:** `backend/test/risk-engine.test.ts` now also fails when a rule has no entry in `RULE_LABELS`.
- **Risk-group badges** (README item 3). The five scales of the antenatal protocol (pp. 33–41: pre-eclampsia, gestational diabetes, thromboembolism, postpartum haemorrhage, fetal growth restriction), ported from `data-pack/risk-scales.ts` to `backend/src/risk-engine/risk-groups.ts`, a pure function beside the engine. They are a profile from the history, not a zone: they never set or change one, and the UI draws them in blue, never red, amber or green.
  - Contracts, additive only: `RiskFactors` gains `parity`, `bmi` and `flags` (the pack's codes, `RiskFlag`); `PatientDetail` gains `riskGroups` (level, matched factors, action codes, cited pages), worked out when the patient is read, from her age today and latest haemoglobin. The column is JSONB, so no migration.
  - `riskGroups` is null when the parity or the age is not recorded, so a missing history never reads as low risk. A recorded previous caesarean counts as a uterine scar.
  - Differences from the pack: actions are codes worded in Uzbek and English (`frontend/src/i18n/strings.ts`), a LOW scale lists no actions, and the placenta-praevia admission appears only when praevia is recorded. `backend/test/risk-groups.test.ts` runs the port on the pack's 25 synthetic patients and gets every level the pack expects.
  - Seed: every patient except OB-0014 and OB-0016 has parity and BMI. OB-DEMO-01 (first birth, pre-eclampsia in the family) shows "Preeklampsiya: yuqori xavf" with aspirin, daily blood-pressure checks and urine protein at every visit, which sets up the demo visit. The registration form does not ask for the history yet.

## 2026-11-18 · Phases 5 and 6: Claude, registration, end-to-end check

**Claude (phase 5).** Off unless `AI_ENABLED=true` and `ANTHROPIC_API_KEY` is set in `backend/.env`. With `AI_ENABLED=true` and no key, the server starts with AI off and says why.

- **Two jobs only:**
  - `POST /api/patients/:id/analyze-note` reads a free-text note into a draft for the measurement form;
  - `POST /api/patients/:id/risk/explain` explains the current assessment in plain words.

  Neither output schema has a zone field, and the prompts forbid naming or changing a zone.

- **Request:**
  - model `claude-opus-5-5` from `CLAUDE_MODEL`, effort `low`, `max_tokens` 4000;
  - structured output from the shared Zod schemas (`betaZodOutputFormat`);
  - server-side refusal fallback on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`);
  - `CLAUDE_TIMEOUT_MS` (15 s) with one retry.
- **`messages.create` plus our own Zod parse, not `messages.parse`:** `parse` throws on a non-JSON reply before `stop_reason` can be read, so a refusal and a cut-off reply would look the same. A refusal, a `max_tokens` stop, non-JSON or a schema mismatch all become 503 `AI_UNAVAILABLE` with a `reason` in `details`. Only the text after the last `fallback` block is used, because output before it belongs to the model that declined.
- **Units are converted in code, never by Claude.** Claude copies each value and its unit as written. `services/note-draft.ts` converts:
  - haemoglobin: g/dL × 10;
  - protein: mg/dL ÷ 100, mg/L ÷ 1000;
  - glucose: mg/dL ÷ 18.016.

  It accepts Cyrillic and Uzbek spellings, and checks every reading with `MeasurementReading`. **A value without a unit is left out with a warning** (blood pressure excepted: always mmHg), because a guess such as g/L for "11.2" would turn normal haemoglobin into severe anaemia, and the engine has no plausibility ranges to catch it. This replaces the earlier plan to assume the canonical unit.

- **A note time without an offset is read as Tashkent time** (+05:00). A date without a time, or a time in the future, is dropped with a warning.
- **The draft is never saved by the API.** The clinician checks the form and saves it with `source: AI_ASSISTED`. The measurement history marks such visits with an "AI" badge.
- **Explanations see de-identified facts only:** zone, rule-set version and kind, gestational week, reasons with observed values, triggered trends and data warnings. Never the name, reference, district, facility or date of birth (an integration test checks this). Explanations are cached in memory per assessment and language, since an assessment never changes.
- **Audit:** `AI_NOTE_ANALYZED` and `AI_EXPLANATION_GENERATED` record the model, language and counts, never the note or the reply.
- **`HealthResponse.aiEnabled`** (new field, contracts draft v1) lets the UI hide the AI controls when AI is off. AI text is always violet and marked "AI".
- **Tested without network or key:** a fake SDK client checks the request shape and the error handling, and fake services drive the endpoint tests. The real API has not been called yet.

**Registration.** `POST /api/patients` (any acting user) creates a patient who starts NOT_ASSESSED: the first visit gives the first zone, as for every other patient.

- A duplicate reference gives 409, a future date of birth or an unknown assigned user gives 400.
- `PATIENT_CREATED` is audited without the name.
- The registry page has a "+ Yangi bemor" form.

**Phase 6 checks.**

- **End to end:** `npm run e2e` (Playwright 1.65, installed Google Chrome through `channel: "chrome"`, so no browser download).
  - Covers the demo flow, registration and the language switch.
  - Resets the local demo database before and after.
  - Writes screenshots to `docs/demo/` for the pitch and as the fallback if the live demo fails.
- **Offline:** the production build loads nothing from other hosts (no web fonts, no CDN). Only AI needs the internet.
- **Secrets and data:**
  - no keys or `.env` files in the tree;
  - nothing secret in the bundle;
  - no e-mails, phone numbers or ID numbers in the seed or data pack.

  `npm audit` reports nothing in runtime dependencies and 10 findings in dev tooling (vite, vitest, drizzle-kit through picomatch and esbuild). Those tools only run locally, so they were left as they are.

- **Demo script:** `docs/DEMO_SCRIPT.md` (in Russian, like the handover).

**Domain data pack.** On 17 Nov the domain lane added `data-pack/`:

- the two protocol PDFs;
- an extended provenance file;
- 28 rules with trimester-specific haemoglobin norms;
- risk scales, formulas, a 25-patient synthetic seed;
- pitch figures.

It is kept exactly as delivered and excluded from Prettier. The PDFs stay there instead of the planned `docs/sources/`, and the docs point to them. The engine still runs `demo-0.1`. Adopting the pack needs the contract additions its README lists (gestational-week ranges, a glucose context, new rule types) and the mentor's answers, so it is the domain lane's next step.

**Uzbek spelling.** Server-side Uzbek text uses the same letters as the interface: ʻ (U+02BB) in oʻ and gʻ, ʼ (U+02BC) for the apostrophe.

## 2026-11-17 · Phases 3 and 4: alert pipeline and interface

- **One visit, one transaction.** `POST /api/patients/:id/measurements` locks the patient row, stores the readings, runs the engine on the full history, stores the assessment and zone, applies the alert policy and writes the audit entries, all or nothing. A repeated `submissionId` returns the stored result (200, `replayed: true`); a race between two identical submissions resolves through the unique key.
- **Alert policy** (`services/alert-policy.ts`, decision 7, still to confirm with the mentor): alert when the zone worsens; a first assessment alerts only when RED; a patient who stays RED alerts again only for a new Red rule; no duplicate while a pending alert covers the deciding rules; every alert goes to the SPECIALIST role.
- **Only the recipient role may acknowledge** (403, new error code `FORBIDDEN`), and only once (409).
- **The seed replays every visit through the same services as the API**, so demo zones and alerts follow the real rules; alerts older than 10 days are acknowledged by the specialist a day after they were raised.
- **Audit events get a `seq` column** (migration 0001), because events written in one transaction share a timestamp; lists sort by `(created_at, seq)`. Audit events also carry `patientReference` for activity feeds, and the dashboard feed shows only people's actions and alerts, not routine re-checks.
- **Notifications go through a channel interface** (`services/notification.ts`); the MVP has only the in-app inbox, so Telegram or SMS can be added later without touching the pipeline.
- **Interface**: Uzbek by default with an English switch; reasons are worded in the UI from `ruleId` + `observed`; Green with data warnings shows "incomplete data"; lists refresh every 5 seconds instead of push; charts draw values only, never thresholds; dates are formatted by hand because many browsers lack Uzbek locale data.

## 2026-11-17 · Phases 1 and 2: data foundation and Risk Engine

- **Demo rule values follow the national clinical protocols** of the Ministry of Health of Uzbekistan (order No. 180 of 23 June 2025, antenatal care and iron-deficiency anaemia), with page numbers in `docs/RULES_PROVENANCE.md`; the WHO documents they build on are cited as secondary sources. The values were first taken from WHO, then checked against the protocols once the team added them: all of them match, so the rule logic and the version (`demo-0.1`) did not change, only the references. The zone each rule gives is a team choice, so the set stays ILLUSTRATIVE until a clinician approves rules for `validated-rules.ts`. `RULE_SET` selects the set.
- **Only threshold rules change zones.** Trend rules report findings only, because no source defines which rise or fall is concerning (brief section 6.3). Data-quality rules only add warnings. The engine supports zone-raising trends for when a clinician defines them.
- **A rule never fires on missing data.** Missing, stale (BP older than 56 days, from the WHO 2016 contact schedule), future-dated and invalid readings become data warnings.
- **Reason texts are English**; each reason also carries `observed` values (measure, value, unit, time), so the Uzbek UI can word reasons itself from `ruleId` + `observed`. Contract change (draft v1, not yet frozen).
- **`RuleInfo.measure` became `measures`** (a list), because combined rules such as the pre-eclampsia pattern read several inputs. Contract change (draft v1).
- **Assessments are stored per visit, plus a re-check.** The seed assesses every visit as of that visit and re-checks each patient as of the reset time, so stale data shows up; the patient's current zone is the latest assessment. Phase 3 assesses on every new submission.
- **Seed data is deterministic**: fixed ids derived from names (`seedId`), values relative to the reset day. `OB-DEMO-01` is the demo patient.
- **`npm run db:reset` refuses non-local databases** unless `--allow-remote` is passed, so a shared database cannot be wiped by accident.
- **Registry order**: Red, Yellow, Not assessed, Green, then by name.
- **Responses are validated against the contracts** before sending (`sendJson`); a mismatch is a 500, never a silent drift.
- **Thin route handlers** in `routes/` call services directly; the brief's separate `controllers/` folder was not needed.
- **The rule set is audited**: the server writes `RULE_SET_LOADED` when the active version changes, and the seed writes one too.
- **Deferred**: `POST /api/patients` (the demo does not need it).

## 2026-11-17 · Plan defaults accepted

The seven open decisions from the build plan (section 12) were accepted with their proposed defaults.

| #   | Decision                 | Choice                                                                                                                                                                     | Status                      |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Repository               | `ona-bola-signal/` created as a local git repository (branch `main`). The GitHub host and access are still to be set up by the team.                                       | Open: GitHub host           |
| 2   | Database                 | Postgres 16 in Docker (`docker-compose.yml`, host port 5433). A shared Supabase project is the fallback for teammates without Docker; migrations are plain SQL either way. | Done                        |
| 3   | Data access              | Drizzle ORM with drizzle-kit migrations over `pg`.                                                                                                                         | Done                        |
| 4   | Interface language       | Uzbek (Latin) labels with Yashil, Sariq and Qizil; English in code and docs; one strings file per language in `frontend/src/i18n/`.                                        | Done                        |
| 5   | Lane owners              | A Backend & DB, B Risk Engine & AI, C Frontend, D Pipeline & demo; E business and domain with five people.                                                                 | Open: names                 |
| 6   | Claude at the checkpoint | Note extraction behind `AI_ENABLED`, built once the engine tests pass; shown only if the core flow already works.                                                          | Built (P5); off by default  |
| 7   | Alert policy default     | Alert when the zone worsens or a new Red rule fires; recipient is the specialist role; no duplicate while one is pending.                                                  | Pending mentor confirmation |

## 2026-11-17 · Scaffold choices

- npm workspaces: `shared` (contracts, consumed as TypeScript source with no build step), `backend`, `frontend`.
- Exact versions pinned (`.npmrc` sets `save-exact=true`); `package-lock.json` is committed.
- Main versions: Express 5.3, Zod 4.6, TypeScript 7.0, Vite 8.3, React 19.3, TanStack Query 5, Tailwind 4.3, Vitest 5.1, Drizzle ORM 0.45, Anthropic SDK 1.9. React Router stays on 7.x (8.x is out) because its API is the one most of the team knows.
- The Anthropic SDK accepts Zod 3.25+ or 4, so the contracts use Zod 4. `backend/test/ai-contract.test.ts` checks that the AI output schemas convert to structured-output formats.
- `backend/.env.example` replaces the root `.env.example` from the plan, so secrets only ever live in the backend.
- The API reads `API_PORT` (default 3001), not the generic `PORT`: preview runners and hosts set `PORT` for every process, which put the API on the web app's port during the first run.
- Changes to the brief's data model, all recorded in the contracts:
  - `current_risk_zone` is nullable ("Not assessed"); `gestational_week` is derived from the estimated due date.
  - One measurement submission (a visit) holds at most one reading per type and produces one assessment.
  - Assessments carry `ruleSetKind` (ILLUSTRATIVE or VALIDATED) and `inputHash`.
  - Audit events carry an optional `patientId`, so a patient's timeline is one query.
  - Every Yellow or Red zone must come with at least one reason, and the zone must equal the highest reason zone. The schema rejects an assessment that breaks this.
