# Task Plan: Java Backend Full Delivery

## Goal
Deliver a production-grade Java backend for the WeChat check-in miniapp with extension-first database design, Linux-oriented deployment support, and frontend/backend directory split (`frontend/` + `backend/`).

## Current Phase
Phase 5

## Phases

### Phase 1: Plan and Requirement Alignment
- [x] Read API contract and requirement docs
- [x] Analyze legacy schema and extension strategy
- [x] Confirm Java implementation direction
- **Status:** complete

### Phase 2: Project Restructure and Backend Bootstrap
- [x] Move `src/` to `frontend/`
- [x] Update miniapp root config to `frontend/`
- [x] Create `backend/` Spring Boot project skeleton
- **Status:** complete

### Phase 3: Core Backend Implementation
- [x] Add Flyway migrations for extension tables (`wx_*`) including `wx_token`
- [x] Implement entities/repositories/services/controllers for A-01~A-06
- [x] Add compatibility endpoints for existing frontend wrappers
- [x] Implement sync jobs (legacy pull + outbox relay, config-gated)
- **Status:** complete

### Phase 4: Ops and Documentation Completion
- [x] Add Linux-friendly ops files (`Dockerfile`, `docker-compose.yml`, shell scripts)
- [x] Add backend operation docs (`backend/README.md`, `.editorconfig`)
- [x] Fix root docs that still said backend folder was missing
- [x] Keep frontend default mock mode while enabling real backend integration
- **Status:** complete

### Phase 5: Final Verification and Handoff
- [x] Re-run backend verification commands after final doc/script updates
- [x] Capture verification evidence in `progress.md`
- [x] Run frontend real test suite (`npm test`) and verify pass
- [x] Update README + docs to full-stack final state
- [ ] Commit and push to GitHub
- **Status:** in_progress

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| Java 17 + Spring Boot 3.5 | Long-term maintainability, Linux deployment maturity, clear layered architecture |
| Extension-first DB design | Keep legacy `suda_union` schema intact and add `wx_*` tables |
| `wx_token` stored in extension user table | Satisfies requirement without modifying legacy user table directly |
| Sync as config-gated scheduled jobs | Safe rollout and rollback (`LEGACY_SYNC_ENABLED`, `OUTBOX_RELAY_ENABLED`) |
| Linux-first scripts + Docker support | Match production deployment target while keeping Windows development support |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` direct execution failed on Windows | 1 | Executed with `node .../superpowers-codex` |
| `rg docs/*.md` pattern failed in PowerShell | 1 | Switched to `rg ... docs` directory search |
| `docker compose` validation unavailable in local shell | 1 | Docker CLI not installed in current environment |

## Notes
- The working tree includes a directory rename (`src/` -> `frontend/`), so git shows deletions/additions; this is expected.
- Final completion claim must be based on fresh command outputs.
