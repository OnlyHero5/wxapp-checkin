# Task Plan: Java Backend Full Delivery

## Goal
Deliver a production-grade Java backend for the WeChat check-in miniapp with extension-first database design, Linux-oriented deployment support, and frontend/backend directory split (`frontend/` + `backend/`).

## Current Phase
Phase 9

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

### Phase 6: Independent Project Audit (2026-02-10)
- [x] Re-verify frontend commands on current workspace
- [x] Re-verify backend commands on current workspace
- [x] Check frontend/backend API mapping and runtime prerequisites
- [x] Identify security/consistency risks with file-line evidence
- **Status:** complete

### Phase 7: Security Fix + Chinese Docs + Push (2026-02-10)
- [x] Add regression test for record detail cross-user access and verify RED failure
- [x] Implement session + ownership validation for `GET /api/checkin/records/{recordId}`
- [x] Update backend docs to Chinese and align API/spec docs with security constraint
- [x] Re-run frontend/backend verification commands after code/doc changes
- [ ] Commit and push to GitHub
- **Status:** in_progress

### Phase 8: Root README Enhancement + Push (2026-02-10)
- [x] Enhance root README visual badges and full-stack positioning copy
- [x] Add architecture and repository-structure sections for readability
- [x] Keep README Chinese-first and consistent with backend-included repo state
- [ ] Commit and push to GitHub
- **Status:** in_progress

### Phase 9: Legacy Schema Compatibility Hardening (2026-02-10)
- [x] Confirm current DB bootstrap strategy (`ddl-auto`, Flyway, profile behavior)
- [ ] Enforce production-safe mode (no auto create/alter on existing legacy schema)
- [ ] Keep test/dev runnable with isolated/local schema option
- [ ] Update backend docs to clearly separate test vs production DB behavior
- [ ] Re-run backend verification after config changes
- **Status:** in_progress

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| Java 17 + Spring Boot 3.5 | Long-term maintainability, Linux deployment maturity, clear layered architecture |
| Extension-first DB design | Keep legacy `suda_union` schema intact and add `wx_*` tables |
| `wx_token` stored in extension user table | Satisfies requirement without modifying legacy user table directly |
| Sync as config-gated scheduled jobs | Safe rollout and rollback (`LEGACY_SYNC_ENABLED`, `OUTBOX_RELAY_ENABLED`) |
| Linux-first scripts + Docker support | Match production deployment target while keeping Windows development support |
| Project review must separate "test/build passed" from "full runtime verified" | Avoid over-claiming completion when DB/container runtime prerequisites are unavailable |
| Production startup must not mutate legacy tables | Production profile should disable ORM DDL and Flyway auto-migration, only read/write business data |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` direct execution failed on Windows | 1 | Executed with `node .../superpowers-codex` |
| `rg docs/*.md` pattern failed in PowerShell | 1 | Switched to `rg ... docs` directory search |
| `docker compose` validation unavailable in local shell | 1 | Docker CLI not installed in current environment |
| `mvnw ... -Dspring-boot.run.profiles=test` parsed incorrectly in PowerShell | 1 | Re-ran with quoted `-D` arguments |
| `spring-boot:run` startup failed with `Access denied for user 'root'@'localhost'` | 1 | Confirmed local runtime still depends on reachable MySQL credentials/environment |
| New security regression test failed as expected before fix (`expected forbidden but was success`) | 1 | Added endpoint token extraction + ownership check; reran test to green |

## Notes
- Current `main` working tree is clean.
- Review evidence must rely on fresh command outputs from this session.
