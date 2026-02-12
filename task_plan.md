# Task Plan: Java Backend Full Delivery

## Goal
Deliver a production-grade Java backend for the WeChat check-in miniapp with extension-first database design, Linux-oriented deployment support, and frontend/backend directory split (`frontend/` + `backend/`).

## Current Phase
Phase 15

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
- [x] Enforce production-safe mode (no auto create/alter on existing legacy schema)
- [x] Keep test/dev runnable with isolated/local schema option
- [x] Update backend docs to clearly separate test vs production DB behavior
- [x] Re-run backend verification after config changes
- **Status:** complete

### Phase 10: Active `suda_union` Positioning & Sync Guard (2026-02-10)
- [x] Align terminology: `suda_union` is active Web management primary schema, not deprecated
- [x] Add production startup guard for dual-schema deployment safety
- [x] Add tests for production guard and dedicated cross-schema datasource
- [x] Update backend/requirement docs to Chinese wording with primary-schema semantics
- [x] Re-run backend full verification after guard changes
- **Status:** complete

### Phase 11: Backend Test Environment Provisioning (2026-02-10)
- [x] Audit missing local runtime dependencies in current WSL environment
- [x] Install Java 17, Docker/Compose, MySQL 8, Redis 7
- [x] Resolve local port conflicts for MySQL/Redis in test environment
- [x] Configure Maven proxy for Java dependency resolution
- [x] Run backend test suite and dev runtime health verification
- **Status:** complete

### Phase 12: Liquid Glass Frontend Audit + Push (2026-02-10)
- [x] Audit current liquid-glass frontend style changes and identify regressions
- [x] Fix missing global class definitions causing cross-page style breakage
- [x] Re-verify frontend tests and class-definition coverage checks
- [ ] Commit and push to GitHub
- **Status:** in_progress

### Phase 13: Bind Failure Cross-Repo Root Cause Investigation (2026-02-10)
- [x] Verify effective frontend runtime base URL and mock mode
- [x] Reproduce backend startup and health status on target LAN port
- [x] Reproduce bind flow with controlled API requests and inspect backend responses
- [x] Audit session lifecycle and WeChat identity derivation behavior in dev mode
- [ ] Implement and verify remediation
- **Status:** in_progress

### Phase 14: Review-Driven Frontend Hardening (2026-02-12)
- [x] Parse external review report and verify claims against current codebase
- [x] Add TDD coverage for API resilience (`GET` retry + concurrent dedupe) and register form validation
- [x] Implement frontend fixes: request resilience, register validation, error feedback, reusable empty-state component
- [x] Re-run frontend test suite with new cases and verify all green
- [ ] Commit and push to GitHub
- **Status:** in_progress

### Phase 15: API Split + Signed Register Payload End-to-End (2026-02-12)
- [x] Split frontend request stack into `request-core` + `mock-api` + endpoint facade
- [x] Implement frontend signed register payload envelope generation (`HMAC-SHA256`, timestamp, nonce)
- [x] Implement backend register payload verification and nonce replay protection
- [x] Add/upgrade tests for missing/tampered/replay signatures and signed payload generation
- [x] Re-run frontend and backend verification commands after split + security changes
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
| Project review must separate "test/build passed" from "full runtime verified" | Avoid over-claiming completion when DB/container runtime prerequisites are unavailable |
| Production startup must not mutate legacy tables | Production profile should disable ORM DDL and Flyway auto-migration, only read/write business data |
| `suda_union` is active Web management primary schema | Extension schema must stay isolated; cross-schema sync must be enabled in production |
| Liquid-glass UI migration must preserve legacy shared utility classes | Existing pages still depend on global `.hint/.network-banner/.info-row` helpers; deleting them causes visual regressions |
| HTTP retry should apply to idempotent methods only | Avoid duplicate write side effects while improving transient network resilience for `GET` |
| Register payload integrity must be verified server-side with timestamp + nonce replay guard | Prevent unsigned/tampered payload acceptance and reduce replay risk on `/api/register` |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` direct execution failed on Windows | 1 | Executed with `node .../superpowers-codex` |
| `rg docs/*.md` pattern failed in PowerShell | 1 | Switched to `rg ... docs` directory search |
| `docker compose` validation unavailable in local shell | 1 | Docker CLI not installed in current environment |
| `mvnw ... -Dspring-boot.run.profiles=test` parsed incorrectly in PowerShell | 1 | Re-ran with quoted `-D` arguments |
| `spring-boot:run` startup failed with `Access denied for user 'root'@'localhost'` | 1 | Confirmed local runtime still depends on reachable MySQL credentials/environment |
| New security regression test failed as expected before fix (`expected forbidden but was success`) | 1 | Added endpoint token extraction + ownership check; reran test to green |
| `mysql-server-8.0` post-install script failed in WSL test env | 1 | Root cause was local port conflict (`3306`, `33060`); moved MySQL to `3307` / `33061` and reconfigured dpkg successfully |
| `redis-server` failed to start in WSL test env | 1 | Root cause was local port conflict (`6379`/`6380`/`6381` busy); moved Redis to `16379` and restarted service successfully |
| Maven dependency resolution hung at HTTPS response read | 1 | Root cause was Java/Maven proxy path in this environment; added Maven proxy config in `~/.m2/settings.xml` |
| `ui-ux-pro-max` referenced script path was missing in local skill install | 1 | Followed fallback path: use available skill rules and continue without script automation |

## Notes
- Current `main` working tree contains pending liquid-glass frontend updates and awaits commit/push.
- Review evidence must rely on fresh command outputs from this session.
