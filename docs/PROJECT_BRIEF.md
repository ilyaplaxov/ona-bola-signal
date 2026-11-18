# Ona-Bola Signal
## Project Brief, Product Requirements & Technical Implementation Plan

> **Working tagline:** “See the risk in time, not too late.”
>
> **Project:** AI National Hackathon — Medicine track  
> **Problem:** #9 — perinatal high-risk registry and real-time alerts  
> **Document purpose:** A shared source of truth for the team: what we are building, why, how it should work, the proposed architecture, implementation scope, and the rules we must not violate.

---

## 1. Executive summary

**Ona-Bola Signal** is a perinatal monitoring platform for district-level healthcare teams. It provides a unified registry of pregnant women (and, in the broader product vision, newborns), stores measurements over time, highlights cases using **Green / Yellow / Red** risk zones, and notifies the responsible specialists when a patient's recorded indicators deteriorate.

The MVP will demonstrate one complete workflow:

1. A healthcare worker opens the patient registry.
2. They select a synthetic patient and review her profile and measurement history.
3. They add a new measurement or clinical note.
4. The **deterministic Risk Engine** evaluates configured rules and recent trends.
5. The patient's risk zone and the reasons for the result are displayed.
6. The backend creates an alert when the configured conditions require attention.
7. The responsible specialist sees the alert and acknowledges it.
8. The system records the event in an audit log.

We are building a **decision-support and early-warning prototype**, not an autonomous diagnostic or treatment system. A qualified clinician remains responsible for interpreting the information and deciding what action to take.

## 2. Problem statement and source requirement

The selected hackathon problem (#9) describes the following gap:

- Pregnant women and newborns are not monitored in real time at district level.
- When test results deteriorate, OvaBMU specialists may learn about the situation too late.
- The requested solution is a perinatal high-risk registry with **Red / Yellow / Green** zones and automatic notifications to OvaBMU specialists when results worsen.

The MVP must visibly address these core requirements:

| Official requirement | How our MVP addresses it |
|---|---|
| Perinatal high-risk registry | Searchable registry of synthetic patients and patient profiles |
| Red / Yellow / Green zones | Risk Engine returns a zone with transparent reasons |
| Monitoring of results over time | Measurement history and trend view |
| Automatic notification when results worsen | Backend creates an alert when configured rules/trends trigger |
| Specialists can act on alerts | Alert inbox with acknowledgement status and audit event |

**Terminology note:** The source material uses the abbreviation **OvaBMU** but does not expand it. Do not guess its meaning in the product, pitch, or documentation. Confirm the intended recipient/role with the domain mentor.

## 3. Product vision

### 3.1 Target users

- **District obstetrician-gynecologists and family doctors:** maintain the registry and enter/review patient measurements.
- **Patronage nurses:** collect and submit patient information during follow-up.
- **OvaBMU specialists:** receive and review escalated alerts.
- **District health managers:** monitor workload and aggregated status.

The exact permissions and organizational responsibilities must be confirmed with a domain expert before any real deployment.

### 3.2 Core value

- Earlier visibility into deteriorating measurements.
- A single view of patient history and current risk status.
- Transparent reasons behind every rule-based risk result.
- Clear ownership and acknowledgement of alerts.
- An auditable record of measurements, assessments, and alert handling.

### 3.3 What success looks like for the hackathon

A judge should be able to watch a short, reliable end-to-end demo in which a new synthetic measurement changes a patient's displayed status, creates an alert, and allows a specialist to acknowledge it.

The demo should show **how the workflow operates**, not claim that the prototype has proven clinical accuracy or reduced maternal mortality.

---

## 4. Scope

### 4.1 MVP — Must have

1. Patient registry with search/filter.
2. Patient profile with basic synthetic demographic and pregnancy information.
3. Measurement entry and measurement history.
4. Deterministic TypeScript Risk Engine.
5. Green / Yellow / Red status with human-readable reasons.
6. Basic trend detection across recent measurements.
7. Alert creation and alert inbox.
8. Alert acknowledgement.
9. Dashboard summary (counts by zone and pending alerts).
10. Audit log for important actions.
11. Seeded synthetic data and a repeatable demo scenario.

### 4.2 Should have, if time allows

- Claude-powered extraction of structured fields from a free-text clinical note.
- Claude-generated plain-language summary of the Risk Engine result.
- Charts showing measurement history.
- Filters by risk zone, district, and alert status.
- Role-based UI views for doctor and specialist.
- A simple district-level overview.

### 4.3 Later product scope — not required for the hackathon MVP

- Full newborn registry and newborn follow-up workflows.
- Real Telegram/SMS/push delivery and escalation timers.
- Offline-first mobile/tablet data collection and synchronization.
- Integration with national or hospital information systems.
- Production-grade identity management and organization-wide permissions.
- A clinically validated predictive ML model with a representative, licensed dataset.
- District maps and advanced analytics.

Do not let these future features delay the core working workflow.

---

## 5. Product behavior

### 5.1 Patient registry

Each patient record should include, at minimum:

- Internal patient ID.
- Display name or synthetic demo name.
- Date of birth or age (synthetic).
- District / facility.
- Pregnancy week or estimated due date, where applicable.
- Assigned healthcare worker.
- Current risk zone.
- Last measurement date.
- Open alert count.

For the hackathon, use only synthetic data. Do not use real patient names, phone numbers, medical records, or identifiable health information.

### 5.2 Patient profile

The profile should show:

- Basic patient information.
- Current risk zone and the timestamp of the latest assessment.
- Measurement history.
- Trend/chart view when available.
- Recent alerts and their status.
- Risk assessment explanation: triggered rules, observed trend, missing information, and assessment timestamp.

### 5.3 Measurement workflow

A healthcare worker can add a measurement to a patient record. The backend should:

1. Validate the payload.
2. Persist the measurement.
3. Load the relevant recent history.
4. Run the deterministic Risk Engine.
5. Persist the risk assessment.
6. Update the patient's current zone.
7. Create an alert if the configured alert policy says one is required.
8. Record the important action in the audit log.

The operation should be safe against accidental duplicate submissions where practical.

### 5.4 Risk zones

The engine returns one of three zones:

- **Green:** no configured rule currently indicates elevated risk.
- **Yellow:** one or more configured warning conditions or concerning trends require review.
- **Red:** a configured high-priority condition requires urgent clinical review according to the approved rule configuration.

These descriptions are product-level labels only. The actual clinical meaning, thresholds, and required response must come from an approved clinical protocol and clinician validation.

Every assessment should include:

- Zone.
- Triggered rule IDs.
- Human-readable reasons.
- Trend findings.
- Data-quality or missing-data warnings.
- Assessment timestamp.
- Rule-set version.

Never display a zone without explaining why it was assigned.

### 5.5 Alerts

An alert should contain:

- Alert ID.
- Patient ID (avoid exposing unnecessary personal information in notification previews).
- Severity / zone.
- Triggering rule IDs and concise reasons.
- Created timestamp.
- Intended recipient or responsible role.
- Status: `pending`, `acknowledged`, and optionally `resolved`.
- Acknowledged by and acknowledged timestamp.
- Optional due time / escalation metadata for a later version.

For the MVP, the **in-app alert inbox** is the required notification channel. Do not claim Telegram/SMS delivery unless it is actually integrated and tested.

### 5.6 Audit log

Record important events such as:

- Patient created or updated.
- Measurement added.
- Risk assessment generated.
- Alert created.
- Alert acknowledged.
- Relevant changes to rule configuration.

Each event should include actor (or demo actor), action, target entity, timestamp, and minimal structured metadata.

---

## 6. Hybrid AI approach

We have chosen a **hybrid architecture: our own deterministic TypeScript Risk Engine + Anthropic Claude API for bounded language tasks**.

The two components have different responsibilities.

### 6.1 Deterministic Risk Engine — authoritative for zones

The Risk Engine is our own backend module. It:

- Accepts validated patient context and measurements.
- Applies an explicit, versioned set of configured rules.
- Evaluates recent measurement trends.
- Returns a risk zone and explainable reasons.
- Does not depend on an LLM response.
- Produces reproducible results for the same input and rule-set version.

Suggested conceptual output:

```ts
type RiskZone = "GREEN" | "YELLOW" | "RED";

interface RiskAssessment {
  patientId: string;
  zone: RiskZone;
  triggeredRuleIds: string[];
  reasons: string[];
  trendFindings: string[];
  dataWarnings: string[];
  assessedAt: string;
  ruleSetVersion: string;
}
```

The exact types can be adapted to the repository conventions.

### 6.2 Clinical rules and thresholds

Potential clinical inputs mentioned in the project research include blood pressure, hemoglobin (Hb), proteinuria, gestational diabetes, previous C-section, and age. This list is a starting point for discussion, **not authorization to invent or implement clinical cutoffs**.

Rules must be sourced from national clinical protocols or another explicitly approved clinical reference and reviewed by a qualified clinician.

If the team cannot obtain clinical validation before the demo:

- Use clearly labeled **illustrative demo rules** only.
- Keep demo rules in a separate configuration/module from validated clinical rules.
- Put a visible disclaimer in the UI and presentation.
- Do not present demo thresholds as medical recommendations.
- Do not claim clinical validation, diagnostic performance, sensitivity, specificity, or accuracy.

### 6.3 Trend detection

The MVP can implement a transparent trend check over recent measurements, for example:

- Compare the latest measurement with previous measurements.
- Calculate a simple change or slope across the last few readings.
- Flag a concerning direction or rapid change only when a clinician-approved rule defines what that means.

A simple recent-history trend is sufficient for the MVP. CUSUM or more advanced statistical methods are optional and should only be added after the basic workflow works.

### 6.4 Claude API — assistant, not decision-maker

Claude may be used for bounded language tasks:

- Extract structured fields from a free-text note.
- Summarize a patient's recent measurements and already-computed Risk Engine findings.
- Explain the engine's triggered rules in plain language.
- Identify missing or ambiguous information that a clinician may need to review.

Claude must **not**:

- Independently assign Green / Yellow / Red.
- Override the Risk Engine's zone.
- Invent clinical thresholds or protocols.
- Diagnose a patient.
- Prescribe treatment or tell a patient what medication to take.
- Turn uncertain or missing information into fabricated facts.

Recommended flow:

1. Backend sends only the minimum necessary, synthetic/demo-safe context to Claude.
2. Claude returns structured JSON for a narrowly defined task.
3. Backend validates the response with Zod.
4. Invalid or incomplete output is rejected or shown as unavailable.
5. The deterministic Risk Engine remains the source of truth for the zone.

Keep the Anthropic API key on the server. Never expose it in frontend code or a Vite `VITE_*` variable.

---

## 7. Proposed technical stack

| Layer | Proposed technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript | Doctor/specialist interface |
| Styling | Tailwind CSS | Layout and UI styling |
| Backend | Node.js + Express + TypeScript | API, orchestration, validation |
| Database | PostgreSQL / Supabase | Persistent application data |
| AI language tasks | Anthropic Claude API | Note extraction and summaries |
| Validation | Zod | Request and AI-response validation |
| Charts | Recharts | Measurement history and dashboard charts |
| Version control | Git | Collaboration and integration |

Use the existing repository and conventions where possible. Before adding dependencies or changing project structure, inspect what is already installed.

---

## 8. High-level architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    React + TypeScript                    │
│                                                          │
│  Dashboard | Patient Registry | Patient Profile | Alerts │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS / REST API
                            ▼
┌──────────────────────────────────────────────────────────┐
│                Node.js + Express + TypeScript            │
│                                                          │
│  Routes / Controllers                                    │
│       │                                                  │
│       ├── Zod validation                                  │
│       ├── Patient & Measurement services                 │
│       ├── Risk Assessment orchestration                  │
│       ├── Alert service                                  │
│       ├── Audit service                                  │
│       └── Claude service (bounded language tasks)        │
│                    │                    │                │
│                    ▼                    ▼                │
│           Deterministic Risk       Anthropic Claude      │
│           Engine (authoritative)   (summaries/extraction) │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                  PostgreSQL / Supabase                   │
│                                                          │
│ patients | measurements | risk_assessments | alerts      │
│ users    | audit_logs   | clinical_rules (optional)     │
└──────────────────────────────────────────────────────────┘
```

### 8.1 Important architectural rule

The frontend must not calculate or decide clinical risk zones. It displays the backend assessment. The backend calls the deterministic Risk Engine and persists its result.

Claude is a separate optional service. A Claude outage must not prevent the deterministic Risk Engine from producing a risk assessment.

---

## 9. Suggested backend modules

Adapt names to the current repository; do not create duplicate structures if equivalent modules already exist.

```text
backend/src/
  app.ts
  server.ts
  routes/
    patients.routes.ts
    measurements.routes.ts
    alerts.routes.ts
    dashboard.routes.ts
  controllers/
    patients.controller.ts
    measurements.controller.ts
    alerts.controller.ts
    dashboard.controller.ts
  services/
    patient.service.ts
    measurement.service.ts
    risk-assessment.service.ts
    alert.service.ts
    audit.service.ts
    claude.service.ts
  risk-engine/
    index.ts
    types.ts
    rules/
      demo-rules.ts
      validated-rules.ts
    trend-detector.ts
  schemas/
    patient.schema.ts
    measurement.schema.ts
    alert.schema.ts
    ai-output.schema.ts
  db/
    client.ts
```

## 10. Suggested frontend structure

```text
frontend/src/
  app/
  components/
    layout/
    ui/
    patients/
    risk/
    alerts/
    charts/
  pages/
    DashboardPage.tsx
    PatientsPage.tsx
    PatientDetailsPage.tsx
    AlertsPage.tsx
  services/
    api.ts
    patients.api.ts
    measurements.api.ts
    alerts.api.ts
  types/
  hooks/
```

Suggested pages:

- **Dashboard:** counts by risk zone, pending alerts, recent activity.
- **Patients:** searchable/filterable patient table.
- **Patient details:** profile, current zone, measurements, trends, reasons, alerts.
- **Alerts:** pending/acknowledged alerts and acknowledgement action.

Keep the UI focused. A polished end-to-end workflow is more valuable than many incomplete pages.

---

## 11. Suggested database model

The exact schema must be aligned with the existing project and database migrations. The following is a conceptual MVP model.

### `patients`

- `id` — UUID primary key.
- `external_reference` — optional synthetic/reference ID.
- `display_name` — synthetic display name.
- `date_of_birth` — optional.
- `district` — district/facility label.
- `gestational_week` — optional current pregnancy week.
- `estimated_due_date` — optional.
- `assigned_user_id` — optional responsible user.
- `current_risk_zone` — `GREEN | YELLOW | RED`.
- `created_at`, `updated_at`.

### `measurements`

- `id` — UUID primary key.
- `patient_id` — foreign key.
- `type` — measurement type, e.g. blood pressure or Hb.
- `value` — numeric or structured value as appropriate.
- `unit` — explicit unit.
- `measured_at` — measurement time.
- `recorded_by` — user ID or demo actor.
- `source` — manual entry / import / demo seed.
- `created_at`.

For measurements with multiple components (for example, systolic/diastolic blood pressure), use an explicit structured representation or separate numeric columns. Do not hide units or silently mix incompatible formats.

### `risk_assessments`

- `id` — UUID primary key.
- `patient_id` — foreign key.
- `zone` — `GREEN | YELLOW | RED`.
- `triggered_rule_ids` — JSON/array.
- `reasons` — JSON/array.
- `trend_findings` — JSON/array.
- `data_warnings` — JSON/array.
- `rule_set_version` — string.
- `assessed_at` — timestamp.

### `alerts`

- `id` — UUID primary key.
- `patient_id` — foreign key.
- `risk_assessment_id` — foreign key.
- `severity` — zone/severity.
- `title`, `message`.
- `status` — `PENDING | ACKNOWLEDGED | RESOLVED`.
- `recipient_user_id` or recipient role.
- `created_at`, `acknowledged_at`, `acknowledged_by`.

### `users` (if not already provided by Supabase Auth)

Use the existing authentication provider if configured. Do not build a parallel password system just for the demo unless absolutely necessary.

### `audit_logs`

- `id` — UUID primary key.
- `actor_user_id` — nullable for system events/demo actor.
- `action` — event name.
- `entity_type`, `entity_id`.
- `metadata` — minimal JSON.
- `created_at`.

---

## 12. Suggested API contract

Adapt endpoint names to existing conventions.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Dashboard counts and summary |
| `GET` | `/api/patients` | List/search/filter patients |
| `POST` | `/api/patients` | Create a patient |
| `GET` | `/api/patients/:id` | Patient details |
| `GET` | `/api/patients/:id/measurements` | Measurement history |
| `POST` | `/api/patients/:id/measurements` | Add measurement and trigger assessment |
| `GET` | `/api/patients/:id/risk` | Latest risk assessment/history |
| `POST` | `/api/patients/:id/analyze-note` | Optional Claude note extraction/summary |
| `GET` | `/api/alerts` | List/filter alerts |
| `PATCH` | `/api/alerts/:id/acknowledge` | Acknowledge an alert |

For `POST /measurements`, return the saved measurement, the new Risk Engine assessment, and any newly created alert IDs. This makes the demo flow easy to integrate.

All API inputs must be validated. Return consistent error responses and appropriate HTTP status codes.

---

## 13. End-to-end demo scenario

Use a fully synthetic patient and synthetic measurements.

1. Open the dashboard and show registry totals.
2. Open the patient registry.
3. Select a synthetic patient.
4. Show the patient's current zone and measurement history.
5. Add a new synthetic measurement chosen to trigger a **demo-only configured rule**.
6. The backend runs the Risk Engine.
7. The profile updates with the new zone, triggered rule ID, and explanation.
8. A pending alert appears in the Alerts page.
9. Open the alert as the responsible specialist and acknowledge it.
10. Show the acknowledgement and audit event.

The scenario must be rehearsed with seeded data. Include a reset/seed script so the team can restore the demo state quickly.

---

## 14. Team work split

For a team of 3–4 people, split work by clear interfaces. Adjust based on actual team size and skill sets.

| Workstream | Main responsibilities | Deliverable |
|---|---|---|
| Backend & database | DB schema, migrations, patient/measurement APIs, seed data | Working persistence and API |
| Risk Engine & AI | Rule engine, trend detector, Zod schemas, Claude service | Reproducible assessment and bounded AI feature |
| Frontend | Dashboard, registry, patient profile, alerts UI | Complete user workflow |
| Integration & demo (or shared responsibility) | API integration, error handling, audit flow, testing, pitch demo | Stable end-to-end demo |

### Parallelization rules

- Agree on API request/response shapes before frontend and backend work diverge.
- Agree on Risk Engine input/output types before the engine and backend integration begin.
- Use mock data in the frontend while the API is being built.
- Commit small changes and integrate frequently.
- Assign one person to resolve merge conflicts and protect the main branch.
- Do not let every developer edit the same files.

---

## 15. Implementation sequence

### Phase 0 — Inspect and agree

- Inspect the existing repository, installed dependencies, environment variables, and database setup.
- Read the hackathon source documents.
- Confirm the exact demo scope and team size.
- Confirm with the domain mentor who OvaBMU refers to and which clinical rules/thresholds may be used.
- Agree on API contracts and shared TypeScript types.

**Exit criteria:** everyone understands the demo flow, folder structure, and interfaces.

### Phase 1 — Data foundation

- Create or verify the patient, measurement, assessment, alert, and audit tables.
- Add migrations without resetting or destroying existing data.
- Create synthetic seed data.
- Implement patient list and patient details endpoints.

**Exit criteria:** the frontend can retrieve synthetic patients and their measurement histories.

### Phase 2 — Risk Engine

- Define typed input/output contracts.
- Implement rule evaluation using explicit configuration.
- Implement simple recent-history trend detection.
- Return zone, rule IDs, reasons, warnings, timestamp, and rule-set version.
- Add unit tests for each rule and zone transition.

**Exit criteria:** identical input and rule-set version produce identical output; tests cover Green, Yellow, and Red demo cases.

### Phase 3 — Measurement-to-alert pipeline

- Implement measurement validation and persistence.
- Trigger Risk Engine after a new measurement.
- Persist the assessment.
- Create an alert according to the alert policy.
- Write audit events.
- Implement alert listing and acknowledgement.

**Exit criteria:** adding a measurement can update the risk assessment and create an alert end to end.

### Phase 4 — Frontend workflow

- Build registry and patient profile.
- Add measurement form.
- Display zone, reasons, and measurement history.
- Build dashboard summary.
- Build alerts inbox and acknowledgement action.
- Add loading, empty, and error states.

**Exit criteria:** a user can complete the demo flow entirely through the UI.

### Phase 5 — Claude integration (only after the core works)

- Add server-side Anthropic SDK integration.
- Implement one narrow task first: structured extraction from a synthetic clinical note or summary of an existing Risk Engine result.
- Validate structured output with Zod.
- Handle timeouts, malformed output, and provider errors.
- Keep the risk zone controlled by the Risk Engine.

**Exit criteria:** Claude improves explanation or data entry without changing the authoritative risk zone.

### Phase 6 — Stabilize and rehearse

- Run backend and frontend tests.
- Test the complete demo from a clean seed state.
- Verify environment variables and API key handling.
- Check that no real patient data is present.
- Prepare screenshots or a backup recording in case the live environment fails.
- Prepare a concise explanation of architecture, limitations, and future work.

**Exit criteria:** the demo can be repeated reliably without manual database repair.

---

## 16. Testing checklist

### Risk Engine

- [ ] Green case.
- [ ] Yellow case.
- [ ] Red demo case.
- [ ] Missing measurement.
- [ ] Invalid measurement/unit.
- [ ] Out-of-order measurement timestamps.
- [ ] Trend with insufficient history.
- [ ] Trend with enough history.
- [ ] Stable output for the same input and rule-set version.
- [ ] Every result contains reasons and rule-set version.

### Backend

- [ ] Patient list and details.
- [ ] Measurement validation and persistence.
- [ ] Assessment persisted after measurement entry.
- [ ] Alert created only when configured.
- [ ] Alert acknowledgement works.
- [ ] Audit log records key actions.
- [ ] Claude failure does not break the Risk Engine path.

### Frontend

- [ ] Registry loads and filters.
- [ ] Patient profile loads.
- [ ] Measurement form validates input.
- [ ] Updated zone and reasons are visible.
- [ ] Alert appears without requiring a manual page refresh, if feasible.
- [ ] Acknowledgement status updates.
- [ ] Loading, empty, and error states are handled.

### Demo readiness

- [ ] Seed/reset command works.
- [ ] Synthetic patient and scenario are ready.
- [ ] API keys are not committed.
- [ ] No real patient data is used.
- [ ] Demo can be completed in a few minutes.
- [ ] Backup screenshots/video are available.

---

## 17. Safety, privacy, and reliability constraints

These constraints are mandatory even for a hackathon prototype:

1. **Synthetic data only** in the demo.
2. Do not send real patient health information to a third-party LLM without the necessary legal, security, and organizational approval.
3. Keep API keys on the backend and out of source control.
4. Use role-based access and audit logging as the intended production direction.
5. Minimize personal information in alerts and notification previews.
6. Do not claim that the system diagnoses, predicts with validated accuracy, or replaces a clinician.
7. Do not invent clinical thresholds. Validate rules with a qualified clinician.
8. Label any unvalidated demo rules clearly and visibly.
9. Claude cannot override the deterministic Risk Engine.
10. Handle missing, invalid, and stale measurements explicitly rather than silently treating them as normal.

This document describes a hackathon prototype. It is not a clinical protocol, medical device specification, or authorization for clinical use.

---

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| No clinician-approved thresholds in time | Use clearly labeled illustrative demo rules; do not make clinical claims |
| Claude API unavailable or slow | Make Claude optional; core risk workflow must work without it |
| Scope becomes too large | Prioritize one complete patient-to-alert workflow |
| Frontend/backend integration delays | Agree on contracts early and use mock responses |
| Database setup or migration issues | Inspect existing setup first; avoid destructive resets |
| Demo data becomes inconsistent | Provide deterministic seed/reset scripts |
| Judges ask about clinical validity | Explain rule provenance, validation gap, and clinician-in-the-loop design honestly |
| OvaBMU role is unclear | Ask the domain mentor; do not invent an expansion |

---

## 19. What we should explicitly not build now

- Do not train a custom ML model during the short hackathon window.
- Do not add gradient boosting or SHAP unless the core MVP is already stable and a suitable dataset/evaluation is available.
- Do not build a complex microservice architecture.
- Do not build a mobile app and web app in parallel.
- Do not build real Telegram delivery before the in-app alert workflow works.
- Do not add newborn workflows at the expense of the pregnant-patient monitoring demo.
- Do not let an LLM decide the risk zone.
- Do not fabricate performance metrics, clinical validation, or integrations.

A future version may evaluate a properly validated predictive model using representative, licensed data. That is not a prerequisite for this MVP.

---

## 20. Immediate next actions

1. Open the current repository and inspect its structure before changing files.
2. Confirm the actual team size and assign workstreams.
3. Agree on the patient, measurement, assessment, and alert TypeScript contracts.
4. Ask the domain mentor about OvaBMU and approved clinical rules.
5. Start the database/API foundation, Risk Engine, and frontend mock screens in parallel.
6. Integrate measurement → assessment → alert → acknowledgement as early as possible.
7. Add Claude only after that pipeline works.
8. Rehearse the same seeded demo scenario repeatedly.

**Priority order:** working workflow first, reliability second, AI enhancement third, visual polish fourth.

---

## 21. Instructions for Claude Code

When this document is given to Claude Code, follow these instructions:

1. Read this entire document and inspect the existing repository before proposing file changes.
2. Read the available hackathon source documents and distinguish official requirements from our implementation choices.
3. Do not assume the repository is empty. Preserve existing code, conventions, migrations, and working functionality.
4. First produce a repository-specific implementation plan: current state, gaps, proposed files, dependencies, and task order.
5. Identify any conflicts between this document and the existing codebase; explain them before making destructive changes.
6. Implement in small, testable steps. Do not generate the entire application in one unreviewable change.
7. Keep shared types and API contracts consistent between frontend and backend.
8. Add tests for the Risk Engine and the measurement-to-alert pipeline.
9. Keep all clinical rules configurable and traceable to a source. Never invent thresholds.
10. Keep Claude API usage server-side and bounded to extraction/summarization. It must never determine or override the risk zone.
11. Use synthetic demo data only.
12. After each phase, report changed files, commands run, test results, remaining work, and any blockers.
13. If a requirement is ambiguous, ask instead of silently inventing a product or clinical decision.

**First requested output from Claude Code:** a concise audit of the current repository and a task plan tailored to the actual codebase. Do not start large-scale implementation until the team has reviewed that plan.
