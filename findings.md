# Findings & Decisions

## Requirement Alignment
- Backend language finalized as Java.
- Existing legacy database design should remain unchanged.
- New capability is implemented through extension tables and sync jobs.
- `wx_token` requirement is implemented as `wx_user_auth_ext.wx_token VARCHAR(255)`.

## Implementation Snapshot
- Frontend path renamed from `src/` to `frontend/`.
- New backend service created at `backend/` with layered package design:
  - `api`
  - `application`
  - `domain`
  - `infrastructure`
- API coverage implemented for mainline A-01~A-06 and compatibility endpoints used by existing frontend wrappers.
- Core business constraints implemented:
  - Session validation with `session_expired` machine-readable signals
  - QR payload parsing and consistency checks
  - Replay guard for idempotency
  - Checkin/checkout state machine transitions
  - Event persistence + outbox write in one transaction

## Database Findings
- Legacy schema from `suda_union.sql` does not natively cover WeChat identity/session/QR replay requirements.
- Extension-first Flyway migrations add required structures:
  - `wx_user_auth_ext`
  - `wx_admin_roster`
  - `wx_session`
  - `wx_activity_projection`
  - `wx_user_activity_status`
  - `wx_checkin_event`
  - `wx_qr_issue_log`
  - `wx_replay_guard`
  - `wx_sync_outbox`
- Sync strategy:
  - Legacy pull into projection tables by scheduled job
  - Outbox relay back to legacy schema by scheduled job
  - Both are enabled/disabled by configuration flags

## Ops and Deployment Findings
- Linux-ready runtime artifacts added:
  - `backend/Dockerfile`
  - `backend/docker-compose.yml`
  - `backend/scripts/start-dev.sh`
  - `backend/scripts/run-tests.sh`
- Windows developer fallback scripts added:
  - `backend/scripts/start-dev.ps1`
  - `backend/scripts/run-tests.ps1`
- Backend operation docs added in `backend/README.md`.

## Documentation Findings
- Root docs now reflect actual repository structure with both `frontend/` and `backend/`.
- Outdated statement "backend not included" removed from:
  - `README.md`
  - `docs/FUNCTIONAL_SPEC.md`

## Verification Findings
- `npm test` (frontend) passed: 5/5 scripts passed.
- `.\mvnw.cmd -q test` passed.
- `.\mvnw.cmd -q -DskipTests package` passed.
- `.\scripts\run-tests.ps1` passed with 5 tests, 0 failures.
- `docker compose ... config` could not be executed in this environment because Docker CLI is not installed.

## 2026-02-10 Independent Audit Findings
- Frontend API wrapper endpoints and backend controller routes are fully aligned for current calls used by pages.
- Backend test/build chain passes on current workspace (`mvnw test`, `mvnw -DskipTests package`, script wrapper).
- Frontend test chain passes on current workspace (`npm test`, 5 scripts).
- Backend local startup still requires valid MySQL runtime credentials and reachable DB; startup failed in this environment with `Access denied for user 'root'@'localhost'`.
- Security risk identified: compatibility endpoint `GET /api/checkin/records/{recordId}` returns record detail without session validation or ownership check (`CompatibilityController.recordDetail` + `RecordQueryService.getRecordDetail` path).

## 2026-02-10 Fix Delivery Findings
- TDD regression test added: cross-user access to `GET /api/checkin/records/{recordId}` now covered in `ApiFlowIntegrationTest`.
- Security fix landed:
  - Compatibility controller now extracts `session_token` for record detail.
  - Record detail service now validates session and enforces "only record owner can read".
- Docs aligned with implementation:
  - `backend/README.md` converted to Chinese.
  - `docs/API_SPEC.md`, `docs/FUNCTIONAL_SPEC.md`, `docs/REQUIREMENTS.md` now explicitly require C-03 ownership restriction.

## 2026-02-10 README Visual Upgrade Findings
- Root `README.md` now explicitly highlights full-stack structure (`frontend/` + `backend/`) in top summary.
- Added richer badge/icon set (WeChat, TDesign, Java, Spring Boot, MySQL, Redis, Docs) to improve first-screen visual quality.
- Added `系统架构` and `仓库结构` sections to improve onboarding readability.

## 2026-02-10 Legacy Compatibility Audit Findings
- `backend/src/main/resources/application.yml` currently sets `spring.jpa.hibernate.ddl-auto=validate` (不会自动改表，但会校验表结构)。
- Flyway is enabled by default in base config and migration scripts use `CREATE TABLE IF NOT EXISTS wx_*`, so extension tables are bootstrap-capable.
- Test profile (`backend/src/test/resources/application-test.yml`) explicitly uses `ddl-auto=update` and H2; this is acceptable for CI/testing only.
- Current architecture already follows extension-first approach and sync strategy (legacy pull + outbox relay), matching coexistence with `suda_union.sql`.
- Legacy read/write services (`LegacyUserLookupService`, `LegacySyncService`, `OutboxRelayService`) currently use default `JdbcTemplate`, i.e., same datasource as JPA extension tables. This supports same-DB mode but does not explicitly model dual-database production deployment.

## 2026-02-10 Active `suda_union` Clarification Findings
- User clarified: `suda_union` is the active Web 管理系统主库, not a deprecated legacy DB.
- Backend updated to enforce production dual-schema safety:
  - Primary datasource must not point to `suda_union`.
  - `LEGACY_DB_URL` must point to `suda_union`.
  - Production requires both sync directions enabled (`LEGACY_SYNC_ENABLED`, `OUTBOX_RELAY_ENABLED`).
- Added dedicated guard + tests:
  - `ProductionDatabaseSafetyGuard`
  - `ProductionDatabaseSafetyGuardTest`
  - `ProdProfileSafetyConfigTest` now validates production sync defaults and no-DDL/Flyway behavior.
- Docs now describe `suda_union` as active primary schema and extension DB as sidecar schema with bidirectional sync.
