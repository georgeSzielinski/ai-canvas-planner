# Roadmap

## Phase 2 — Google authentication and Calendar connection (implemented)

Implemented server-side Google identity/Calendar OAuth, revocable sessions, onboarding/profile persistence, encrypted credential storage/refresh, discovery and selection, busy-time reads, study-calendar creation, ownership-safe publishing, idempotency, and preservation of user-edited events. Live-provider sign-off requires deployment-specific Google credentials.

## Phase 3 — Canvas connection and sync (implemented)

Implemented environment-backed local credential resolution behind a provider abstraction, institution verification, guarded async Canvas reads, course/assignment/submission normalization, source hashing, idempotent per-user synchronization, partial-failure preservation, freshness/recovery UX, course inclusion controls, authenticated list/filter/detail APIs, and deterministic assignment categorization. Live operation requires an institution-approved token; production OAuth remains the planned credential-provider replacement.

## Phase 4 — Deterministic scheduling engine

Build constraint-based scheduling for routines, availability, assignment milestones, capacity, sleep, training recovery, and calendar locks with explainable proposals.

## Phase 5 — Canvai AI analysis

Add a provider-neutral AI adapter for classification, duration estimates, explanations, and recommendations with structured output validation and user approval.

## Phase 6 — Learning and adaptive estimates

Use completion history and feedback to calibrate per-subject estimates, difficulty trends, session lengths, and confidence without obscuring user control.

## Phase 7 — Reliability, deployment, and multi-user support

Move to managed persistence, background jobs, observability, disaster recovery, privacy operations, accessibility audits, security review, and production deployment.
