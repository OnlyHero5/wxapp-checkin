# Java Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-grade Java backend (A-01~A-06) for the WeChat check-in miniapp, while renaming the existing frontend directory and keeping deployment Linux-ready.

**Architecture:** Use a modular Spring Boot monolith (`backend/`) with clear layers (`api`, `application`, `domain`, `infrastructure`). Keep legacy DB unchanged by introducing extension tables/migrations for WeChat identity/session/QR/replay/event records, and add synchronization-ready outbox structures. Move existing miniapp code from `src/` to `frontend/` to make frontend/backend boundaries explicit.

**Tech Stack:** Java 21, Spring Boot 3.5.x, Spring Web, Spring Validation, Spring Data JPA, Flyway, MySQL 8, Redis, Maven, JUnit 5, Testcontainers.

### Task 1: Repository Structure and Naming

**Files:**
- Move: `src/` -> `frontend/`
- Modify: `README.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/REQUIREMENTS.md`

**Step 1: Move frontend directory**
- Run: `Move-Item src frontend`

**Step 2: Update doc references from `src/` to `frontend/` where applicable**
- Keep wording accurate for miniapp paths and current API baseline notes.

**Step 3: Verify moved frontend still has expected files**
- Run: `Test-Path frontend\\app.js`
- Run: `Test-Path frontend\\utils\\api.js`

### Task 2: Backend Project Bootstrap

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/wxcheckin/backend/BackendApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/resources/application-dev.yml`
- Create: `backend/src/main/resources/application-prod.yml`
- Create: `backend/src/main/resources/logback-spring.xml`
- Create: `backend/.editorconfig`
- Create: `backend/.gitignore`
- Create: `backend/README.md`

**Step 1: Write failing smoke test for context startup**
- Create test expecting Spring context load.

**Step 2: Run test and confirm fail (missing app)**
- Run: `mvn -q -Dtest=*ApplicationTests test` in `backend/`

**Step 3: Add minimal Spring Boot bootstrap to pass**
- Add app entrypoint + dependency setup.

**Step 4: Run test and confirm pass**
- Run: `mvn -q -Dtest=*ApplicationTests test`

### Task 3: Data Model and Migrations (Extension-First)

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__baseline_extension_schema.sql`
- Create: `backend/src/main/resources/db/migration/V2__add_sync_outbox.sql`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/*.java`

**Step 1: Add failing repository/entity tests for key constraints**
- Unique `wx_identity`
- Replay uniqueness `(user_id, activity_id, action_type, slot)`

**Step 2: Implement Flyway migrations and entities**
- Include tables for:
  - `wx_user_auth_ext` (`wx_token` varchar(255), encrypted token fields)
  - `wx_session`
  - `wx_activity_projection`
  - `wx_user_activity_status`
  - `wx_checkin_event`
  - `wx_qr_issue_log`
  - `wx_replay_guard`
  - `wx_sync_outbox`

**Step 3: Re-run tests to green**

### Task 4: Core Service Modules

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/domain/model/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/domain/port/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/redis/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/security/*.java`

**Step 1: Add failing tests for**
- QR payload signing/parsing/expiry
- Session lifecycle and expiration signaling
- A-06 state machine transitions and idempotency behavior

**Step 2: Implement minimal services**
- `AuthService`, `RegistrationService`, `ActivityQueryService`, `QrSessionService`, `CheckinConsumeService`
- `QrPayloadCodec` with HMAC-SHA256
- Redis replay guard adapter

**Step 3: Make tests pass and refactor**

### Task 5: API Layer (A-01~A-06)

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/*.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/error/*.java`
- Create: `backend/src/test/java/com/wxcheckin/backend/api/*.java`

**Step 1: Add failing controller contract tests**
- Cover status/message payload format and error-code expectations.

**Step 2: Implement controllers and mappers**
- Endpoints:
  - `POST /api/auth/wx-login`
  - `POST /api/register`
  - `GET /api/staff/activities`
  - `GET /api/staff/activities/{activity_id}`
  - `POST /api/staff/activities/{activity_id}/qr-session`
  - `POST /api/checkin/consume`

**Step 3: Validate tests pass**

### Task 6: Linux-Ready Ops and Dev Experience

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/docker-compose.yml`
- Create: `backend/scripts/start-dev.sh`
- Create: `backend/scripts/start-dev.ps1`
- Create: `backend/scripts/run-tests.sh`
- Create: `backend/scripts/run-tests.ps1`

**Step 1: Add runtime env contract**
- Use environment variables for DB/Redis/keys; avoid Windows-specific assumptions.

**Step 2: Add startup/test scripts for Linux first**
- Ensure shell scripts are executable and default for server usage.

### Task 7: Final Verification

**Files:**
- Modify: `README.md` (top-level quick start with frontend/backend split)
- Modify: `backend/README.md`

**Step 1: Run full backend tests**
- Run: `mvn clean test`

**Step 2: Run package build**
- Run: `mvn -DskipTests package`

**Step 3: Report exact results and any residual gaps**
