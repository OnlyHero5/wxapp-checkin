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

## 2026-02-10 Backend Test Environment Findings
- Current environment is WSL2 (`Ubuntu 24.04.3 LTS`) with host-level localhost port occupation; default dev ports had conflicts.
- Installed backend runtime prerequisites successfully:
  - Java 17
  - Docker + Compose v2
  - MySQL 8
  - Redis 7
- To keep this as a test/staging-like local setup (non-production), service ports were adjusted:
  - MySQL server: `3307` (instead of `3306`)
  - MySQL X protocol: `33061` (instead of `33060`)
  - Redis: `16379` (instead of `6379`)
- Java network behavior in this environment requires explicit Maven proxy configuration for stable dependency download; shell proxy env alone is insufficient for Maven resolution.
- Backend test suite is green after environment provisioning (`11` tests, `0` failures) and dev runtime health endpoint returns `UP`.
- Docker daemon is available; current shell may require a new login session to directly use docker group without `sudo`.

## 2026-02-10 Liquid Glass Frontend Audit Findings
- Current liquid-glass refactor introduced cross-page style regression risk by removing shared global utility classes from `frontend/app.wxss` while pages still reference them in WXML (`network-banner`, `hint`, `info-row`, `label`, `value`, `btn-center`, `content`).
- Added compatibility-safe global utility styles back into `frontend/app.wxss` while keeping the new glassmorphism token system and visual direction.
- Added missing index wrappers (`section-title-wrap`, `activity-title-wrap`) and meta text overflow handling in `frontend/pages/index/index.wxss`.
- Added `page-profile/profile-card` wrappers in `frontend/pages/profile/profile.wxss` to align with existing WXML class usage and avoid orphan marker classes.
- Verification evidence:
  - page class coverage check script reports no missing class definitions across page WXML/WXSS.
  - `npm test` (frontend) passed with all 6 scripts green.

## 2026-02-10 Bind Failure End-to-End Investigation Findings
- Frontend runtime config is now `baseUrl: "http://192.168.10.201:9989"` with `mock: false` (`frontend/utils/config.js`).
- Binding API path is `POST /api/register` (`frontend/utils/api.js`); register page catches request-level failure as generic `"绑定失败，请重试"` and only shows backend business message when request itself succeeds (`frontend/pages/register/register.js`).
- `start-test-env.sh` explicitly clears `wx_session` and `wx_user_auth_ext` on every start, so previously cached miniapp auth state becomes stale (`backend/scripts/start-test-env.sh`).
- Dev-mode identity resolver currently derives `wx_identity` from `wx_login_code` hash when `WECHAT_API_ENABLED=false`; because `wx.login` code changes frequently, same person can be treated as a new identity after relogin (`backend/src/main/java/com/wxcheckin/backend/application/service/WeChatIdentityResolver.java`).
- Live reproduction evidence:
  - Stale token after session-table reset returns `{"status":"forbidden","error_code":"session_expired"}` on `/api/register`.
  - Two different login codes in dev mode produce two different `wx_identity` values; first bind succeeds, second bind of same student returns `student_already_bound`.
  - Fresh `wx-login + register(2025000008/王敏)` works and returns `role=staff`, proving core register flow itself is functional under clean session + first bind conditions.

## 2026-02-12 Review Report Verification & Remediation Findings
- Report claim validation summary:
  - Accurate: `frontend/utils/api.js` is oversized and mixes mock + real request responsibilities.
  - Accurate: register page lacked frontend-side strict format/length validation and had generic catch-level error messaging.
  - Accurate: request layer previously lacked retry and inflight dedupe for transient network failures.
  - Accurate: no project-level reusable custom component existed for empty/loading error state in index page.
  - Partially accurate: network interaction disablement was not fully missing; register/scan/staff-qr pages already disabled key buttons when offline, but index scan entry still allowed click.
  - Inaccurate/unsupported: "session expiration concurrent relogin storm" has an existing guard (`sessionExpiredRedirecting`) in `frontend/utils/api.js`.
  - Inaccurate/unsupported: "timer cleanup generally missing" is not supported for key polling page (`staff-qr`) where timers are cleared in `onUnload` and guarded in runtime.
- Implemented remediation set:
  - API resilience:
    - Added idempotent-only retry policy (`GET/HEAD/OPTIONS`) with bounded backoff jitter.
    - Added inflight dedupe for same-parameter concurrent `GET` requests.
    - Added request timeout baseline (`10000ms`) in real network requests.
  - Register flow hardening:
    - Added `frontend/utils/validators.js` and aligned frontend validation with backend contract (`student_id` pattern/length, name required, optional field max length).
    - Updated register submit path to use normalized validated values.
    - Updated request-fail catch path to surface backend error message when available.
    - Added explicit input format hints in register UI.
  - UX and maintainability:
    - Added reusable component `frontend/components/empty-state` and integrated into index page.
    - Added index load-error card with retry entry and offline-aware auto reload after network recovery.
    - Disabled index scan-entry button when offline to prevent known-fail operations.
  - Storage error handling:
    - Replaced silent storage catch with runtime logging in mini-program context (suppressed in Node test env).
- TDD evidence:
  - Added failing-then-passing tests:
    - `frontend/tests/api-request-resilience.test.js`
    - `frontend/tests/register-form-validation.test.js`
  - Updated npm test chain and verified all frontend tests pass with new cases.

## 2026-02-12 API Split + Signed Payload Findings
- Frontend API architecture split completed:
  - `frontend/utils/request-core.js` now owns request concerns (session-expired handling, idempotent retry, GET dedupe, timeout).
  - `frontend/utils/mock-api.js` now owns all mock dataset + mock endpoint behavior.
  - `frontend/utils/api.js` now acts as endpoint facade only (business endpoint wrappers).
- Register payload sealing upgraded:
  - `frontend/utils/payload-seal.js` builds signed envelope:
    - fields: `v`, `alg`, `ts`, `nonce`, `body`, `sig`
    - signing text: `v1.<ts>.<nonce>.<bodyBase64>`
    - signature: `HMAC-SHA256(session_token, signing_text)`
  - `frontend/utils/crypto.js` now delegates to payload seal module.
  - Register page now signs with current `sessionToken` before calling `/api/register`.
- Backend verification added:
  - `RegisterPayloadIntegrityService` validates:
    - envelope shape + algorithm + version
    - timestamp skew window
    - signature correctness
    - signed body fields must match request body fields
    - nonce replay prevention via TTL cache (`session_token + nonce`)
  - Error mapping:
    - invalid/missing/tampered signature -> `invalid_payload_signature`
    - nonce replay -> `payload_replay`
- New/updated test coverage:
  - Frontend:
    - `frontend/tests/payload-seal.test.js`
  - Backend:
    - `ApiFlowIntegrationTest#shouldRejectRegisterWithoutSignedPayload`
    - `ApiFlowIntegrationTest#shouldRejectRegisterWithTamperedPayloadSignature`
    - `ApiFlowIntegrationTest#shouldRejectRegisterPayloadReplay`
    - Existing register helper updated to send valid signed payload.

## 2026-02-12 Internet Cross-Verification Notes
- Used primary sources to validate implementation choices:
  - RFC 2104 (HMAC construction) supports current `HMAC-SHA256` signing approach for payload integrity.
  - RFC 5849 Section 3.3 (`nonce` + timestamp) supports anti-replay strategy applied in register payload envelope.
  - RFC 9110 Section 9.2.2 (idempotent methods) supports retry policy restricted to safe/idempotent methods (`GET/HEAD/OPTIONS`).
  - OWASP API Security Top 10 (API2:2023 Broken Authentication, API4:2023 Unrestricted Resource Consumption) supports strict session validation and replay/rate controls.

## 2026-02-12 Skill Maintenance Findings
- `ui-ux-pro-max`:
  - Reinstalled from `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max`.
  - Confirmed previous defect root cause: GitHub symlink entries were materialized as plain files on Windows (`scripts`, `data`).
  - Repaired by materializing real directories and files from upstream `src/ui-ux-pro-max/scripts` and `src/ui-ux-pro-max/data`.
  - Smoke check passed: `python ...\ui-ux-pro-max\scripts\search.py --help` and sample query execution.
- `frontend-design`:
  - Compared against `anthropics/skills` and updated local copy.
  - Post-update SKILL content hash matches upstream.
- `.system/skill-creator` and `.system/skill-installer`:
  - Compared against `openai/skills` and updated local copies.
  - Installer helper scripts run normally (`--help` checks passed).
- `planning-with-files`:
  - Upstream candidate repository (`hanzoskill/planning-with-files`) has `SKILL.md` but misses referenced scripts (`session-catchup.py`, `check-complete.ps1`), making package internally inconsistent on Windows workflow.
  - Restored previous local version from backup to keep skill complete and usable.
- Skill inventory check:
  - Re-ran bootstrap after cleanup; skills list is normal and no backup directories are exposed as skills.

## 2026-02-12 Real-Device Register Page Open Failure Findings
- Current route declaration is valid:
  - `frontend/app.json` includes `pages/register/register`.
  - Multiple entry points navigate to `/pages/register/register` (`index/profile/scan-action` pages).
- Register page has a register-specific runtime dependency chain:
  - `frontend/pages/register/register.js` imports `frontend/utils/crypto.js`.
  - `frontend/utils/crypto.js` imports `frontend/utils/payload-seal.js`.
  - `frontend/utils/payload-seal.js` imports npm package `js-sha256`.
- Packaging evidence shows dependency gap:
  - `frontend/package.json` declares `"js-sha256": "^0.11.1"`.
  - `frontend/node_modules/js-sha256` exists.
  - but `frontend/miniprogram_npm/` only contains `tdesign-miniprogram`; `js-sha256` is absent.
- In mini-program runtime, top-level `require("js-sha256")` failure can prevent register page script load, causing "页面打不开" on real device even when route exists.
- Implemented risk-reduction fix:
  - moved crypto loading in register page from top-level import to submit-time lazy loading with explicit user guidance toast when module is unavailable (`请先执行“构建 npm”`).
- Local regression verification:
  - `npm test` passed (9/9 frontend test scripts).

## 2026-02-12 DevTools `loading.json` Parse Error Findings
- The reported file `frontend/miniprogram_npm/tdesign-miniprogram/loading/loading.json` is valid JSON in current workspace:
  - byte-level check shows no UTF-8 BOM and no non-JSON prefix.
  - Git blob hash equals working tree hash (file content unchanged vs repository baseline).
- Full JSON scan result:
  - `frontend/miniprogram_npm`: 98 JSON files, all parse successfully.
  - `frontend/` (excluding `node_modules`): 112 JSON files, all parse successfully.
- Inference: the reported error is consistent with local WeChat DevTools npm/cache build state mismatch rather than source-controlled JSON syntax corruption.
- Remediation landed:
  - Added `frontend/scripts/repair-miniprogram-npm.js` and npm command `npm run repair:miniprogram-npm` to rebuild `tdesign-miniprogram` artifacts from `node_modules` and validate JSON.
  - Added `frontend/tests/miniprogram-json-integrity.test.js` and integrated into `npm test`.
  - Added README troubleshooting procedure for simulator startup failure with JSON parse errors.

## 2026-02-17 Uncommitted Change Comprehensive Review Findings
- Current uncommitted scope includes backend schema/API field evolution (`support_checkin`) and frontend UX/reliability hardening, plus planning-document updates.
- Critical blocker found during verification:
  - backend compile failed because `ActivitySummaryDto` gained `supportCheckin`, but `CompatibilityController.currentActivity()` still used old constructor parameters.
  - fix applied: add `first.getSupportCheckin()` argument at constructor callsite.
- Fresh verification evidence (after fix):
  - `frontend/npm test` passed (10 scripts, including `miniprogram-json-integrity`).
  - `backend/.\\mvnw.cmd -q test` passed.
  - `backend/.\\mvnw.cmd -q -DskipTests package` passed.
- Release-risk notes:
  - `frontend/utils/config.js` now points to `http://192.168.31.94:9989`; this is environment-specific and should be intentional before merge to shared mainline.
  - `frontend/miniprogram_npm/js-sha256/*` is generated runtime artifact but repository already tracks `miniprogram_npm` content, so including it is consistent with existing versioning strategy.
