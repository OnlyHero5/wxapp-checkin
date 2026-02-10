# wxapp-checkin backend

Java backend service for the WeChat check-in miniapp.

## Stack
- Java 17
- Spring Boot 3.5
- Spring Web + Validation + Data JPA
- Flyway migration
- MySQL 8
- Redis 7

## Directory Layout
- `src/main/java`: application code
- `src/main/resources/db/migration`: Flyway SQL migrations
- `src/test/java`: tests
- `scripts/`: local helper scripts (Linux first + PowerShell fallback)

## Run Locally (Linux/macOS)
1. Start dependencies:
```bash
docker compose up -d mysql redis
```
2. Run service:
```bash
chmod +x scripts/*.sh
./scripts/start-dev.sh
```

## Run Locally (Windows PowerShell)
1. Start dependencies:
```powershell
docker compose up -d mysql redis
```
2. Run service:
```powershell
.\scripts\start-dev.ps1
```

## Test
- Linux/macOS:
```bash
chmod +x scripts/*.sh
./scripts/run-tests.sh
```
- Windows PowerShell:
```powershell
.\scripts\run-tests.ps1
```

## Containerized Run
```bash
docker compose up --build
```

Default exposed endpoint: `http://localhost:8080`

## Key Environment Variables
- `SPRING_PROFILES_ACTIVE`: `dev` or `prod`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `QR_SIGNING_KEY`: required for secure QR payload signing
- `WECHAT_API_ENABLED`: whether to call real WeChat API
- `WECHAT_APPID`, `WECHAT_SECRET`
- `LEGACY_SYNC_ENABLED`: pull sync from legacy DB into extension tables
- `OUTBOX_RELAY_ENABLED`: relay new outbox events back to legacy DB

## Database Strategy
- Keep legacy schema unchanged.
- Use extension tables (`wx_*`) managed by Flyway.
- Include `wx_token` as `VARCHAR(255)` in `wx_user_auth_ext`.
- Sync is controlled by scheduler + outbox switches, default disabled.
