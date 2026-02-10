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
