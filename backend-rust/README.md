# backend-rust

`backend-rust/` 是 `wxapp-checkin` 当前唯一正式后端。

技术基线：

- `Rust stable`
- `axum`
- `tokio`
- `sqlx`（MySQL）
- 单库：`suda_union`

硬约束：

- 运行期写库只允许：
  - `suda_activity_apply`
  - `suda_log`
- 不再依赖：
  - `wxcheckin_ext`
  - `wx_*` 逻辑表
  - 双库同步
  - outbox relay
  - Redis 正式基线
  - `/api/web/auth/change-password`

本地联调：

```bash
cd wxapp-checkin
./scripts/bootstrap.sh
./scripts/dev.sh local
```

最小验证：

```bash
curl http://127.0.0.1:9989/actuator/health
cd backend-rust && cargo test && cargo build --release
```
