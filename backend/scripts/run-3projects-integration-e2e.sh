#!/usr/bin/env bash
set -euo pipefail

# 三项目联动端到端冒烟脚本（偏“可复现证据 + 强断言”，用于保障 wxapp-checkin 与 legacy/suda_union 的兼容性）。
#
# 覆盖的核心风险（以数据同步为中心）：
# 1) legacy schema（真实 MySQL，导入 suda_union(1).sql）能否被 wxapp-checkin 正确 pull 成投影；
# 2) wxapp-checkin 产生的 outbox 事件能否正确写回 legacy 的 suda_activity_apply；
# 3) suda_union 后端读取到的 check_in/check_out 语义是否与 wxapp-checkin 一致（避免“写回了但对方读不懂”）。
#
# 为什么不把这些用例放进默认的 `./mvnw test`：
# - 该脚本依赖本地 MySQL/Redis 与端口绑定（属于“环境型集成测试”），默认单测仍以 H2 为主；
# - 通过 JUnit 包装（ThreeProjectsE2ETest）可按需启用，避免影响日常快速回归。
#
# 运行方式（二选一）：
# - 直接运行脚本（推荐，产物更完整）：`WXAPP_CHECKIN_E2E=1 ./scripts/run-3projects-integration-e2e.sh`
# - 通过 Maven/JUnit 触发：`WXAPP_CHECKIN_E2E=1 ./mvnw test -Dtest=ThreeProjectsE2ETest`

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_ROOT="$(cd "${BACKEND_DIR}/../.." && pwd)"

RUNTIME_DIR="${BACKEND_DIR}/target/three_projects_e2e"
RUN_ID="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${RUNTIME_DIR}/run_${RUN_ID}"
LOG_DIR="${RUN_DIR}/logs"
RESP_DIR="${RUN_DIR}/responses"
mkdir -p "${LOG_DIR}" "${RESP_DIR}"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
MYSQL_USER="${MYSQL_USER:-wxcheckin}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-wxcheckin_test}"
LEGACY_DB="${LEGACY_DB:-suda_union}"
EXT_DB="${EXT_DB:-wxcheckin_ext}"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-16379}"

WXAPP_PORT="${WXAPP_PORT:-9989}"
SUDA_UNION_PORT="${SUDA_UNION_PORT:-8088}"

MAVEN_SETTINGS="${WORKSPACE_ROOT}/local_dev/maven/settings.no_proxy.xml"
MAVEN_REPO="${MAVEN_REPO:-$HOME/.m2/repository}"

# 用于本脚本断言的测试账号口径（来自 seed_suda_union_final.sql）
SUDA_STAFF_ID="${SUDA_STAFF_ID:-20254227087}"
SUDA_STAFF_PWD="${SUDA_STAFF_PWD:-123456}"
WX_STAFF_ID="${WX_STAFF_ID:-20254227087}"

WX_NORMAL_ID="${WX_NORMAL_ID:-2025000101}"
WX_NORMAL2_ID="${WX_NORMAL2_ID:-2025000102}"

SYNC_PULL_INTERVAL_MS="${SYNC_PULL_INTERVAL_MS:-2000}"
SYNC_RELAY_INTERVAL_MS="${SYNC_RELAY_INTERVAL_MS:-2000}"

export MYSQL_PWD="${MYSQL_PASSWORD}"

log() {
  echo "[$(date +'%F %T')] $*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] missing command: $1" >&2
    exit 1
  fi
}

cleanup() {
  # 说明：端到端脚本会启动多个后台进程，退出时必须收口，避免影响下一轮执行与端口占用。
  log "cleanup: stopping background processes"
  for pid_file in "${RUN_DIR}"/*.pid; do
    [[ -f "${pid_file}" ]] || continue
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
  pkill -f "${WORKSPACE_ROOT}/suda_union.*spring-boot:run" 2>/dev/null || true
  pkill -f "${WORKSPACE_ROOT}/wxapp-checkin/backend.*spring-boot:run" 2>/dev/null || true
}
trap cleanup EXIT

wait_http() {
  local url="$1"
  local expect_code="${2:-200}"
  local name="${3:-$url}"
  for _ in $(seq 1 180); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' "${url}" || true)"
    if [[ "${code}" == "${expect_code}" ]]; then
      log "ready: ${name} (${code})"
      return 0
    fi
    sleep 1
  done
  log "[ERROR] timeout waiting for ${name} (last_http=${code:-000})"
  return 1
}

wait_http_any() {
  local url="$1"
  local name="${2:-$url}"
  for _ in $(seq 1 180); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' "${url}" || true)"
    if [[ -n "${code}" && "${code}" != "000" ]]; then
      log "ready: ${name} (${code})"
      return 0
    fi
    sleep 1
  done
  log "[ERROR] timeout waiting for ${name} (last_http=${code:-000})"
  return 1
}

http_json() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local out_file="$4"
  local extra_header="${5:-}"

  if [[ -n "${extra_header}" ]]; then
    curl -sS -X "${method}" "${url}" -H 'Content-Type: application/json' -H "${extra_header}" -d @"${body_file}" >"${out_file}"
  else
    curl -sS -X "${method}" "${url}" -H 'Content-Type: application/json' -d @"${body_file}" >"${out_file}"
  fi
}

json_get() {
  # 从 JSON 文件按“点路径”取值；不支持复杂表达式，只覆盖本脚本用到的路径。
  # 例：status / error_code / session_token / data.token
  local file="$1"
  local path="$2"
  python3 - "${file}" "${path}" <<'PY'
import json,sys

file=sys.argv[1]
path=sys.argv[2]
with open(file, encoding="utf-8") as f:
  data=json.load(f)

cur=data
for part in (path or "").split("."):
  if not part:
    continue
  if isinstance(cur, dict):
    cur=cur.get(part)
  else:
    cur=None
    break

if cur is None:
  print("")
elif isinstance(cur, (dict, list)):
  print(json.dumps(cur, ensure_ascii=False))
else:
  print(cur)
PY
}

json_assert_eq() {
  local file="$1"
  local path="$2"
  local expected="$3"
  local actual
  actual="$(json_get "${file}" "${path}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "[ERROR] assert failed: ${file} ${path} expected='${expected}' actual='${actual}'" >&2
    exit 2
  fi
}

json_assert_nonempty() {
  local file="$1"
  local path="$2"
  local actual
  actual="$(json_get "${file}" "${path}")"
  if [[ -z "${actual}" ]]; then
    echo "[ERROR] assert failed: ${file} ${path} is empty" >&2
    exit 2
  fi
}

json_assert_contains_activity() {
  # 断言 activities 数组里包含指定 activity_id（用于 wxapp-checkin 的活动列表返回）。
  local file="$1"
  local activity_id="$2"
  python3 - "${file}" "${activity_id}" <<'PY'
import json,sys

file=sys.argv[1]
activity_id=sys.argv[2]
with open(file, encoding="utf-8") as f:
  data=json.load(f)

activities=data.get("activities") if isinstance(data, dict) else None
if not isinstance(activities, list):
  print("bad_payload")
  sys.exit(2)

ok=any(isinstance(x, dict) and x.get("activity_id")==activity_id for x in activities)
if not ok:
  print("missing")
  sys.exit(2)
print("ok")
PY
}

sleep_to_next_slot() {
  # 说明：动态码 rotateSeconds=10 时，直接 sleep 11s 会在“贴近 slot 边界”时跨 2 个 slot，导致过期断言不稳定。
  # 策略：按本机 epoch 秒对 rotateSeconds 取模，精确睡到“下一个 slot + 1s”，确保只跨 1 个 slot。
  local rotate_seconds="$1"
  local now_s
  now_s="$(date +%s)"
  local rem=$((rotate_seconds - (now_s % rotate_seconds)))
  sleep $((rem + 1))
}

log "artifacts will be saved to: ${RUN_DIR}"
log "workspace_root=${WORKSPACE_ROOT}"

require_cmd mysql
require_cmd mysqladmin
require_cmd redis-cli
require_cmd curl
require_cmd python3
require_cmd mvn

log "checking mysql/redis connectivity (host=${MYSQL_HOST}:${MYSQL_PORT}, redis=${REDIS_HOST}:${REDIS_PORT})"
mysqladmin -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" ping >/dev/null
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping >/dev/null

log "ensuring extension db exists: ${EXT_DB}"
mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" -e "CREATE DATABASE IF NOT EXISTS \`${EXT_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;" \
  >"${RUN_DIR}/create_ext_db.log" 2>&1

log "rebuilding legacy db (${LEGACY_DB}) using uploaded schema + seed"
"${WORKSPACE_ROOT}/local_dev/scripts/reset_suda_union_from_uploaded_sql.sh" \
  "${WORKSPACE_ROOT}/suda_union (1).sql" \
  "${WORKSPACE_ROOT}/local_dev/mysql/seed_suda_union_final.sql" \
  >"${RUN_DIR}/reset_legacy.log" 2>&1

log "resetting extension db runtime data (keep schema/flyway)"
if mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" "${EXT_DB}" <"${WORKSPACE_ROOT}/local_dev/mysql/reset_wxcheckin_ext_data.sql" \
  >"${RUN_DIR}/reset_ext.log" 2>&1; then
  :
else
  # 兼容：首次环境可能尚未建表，让后端 Flyway 先建表再继续。
  log "[WARN] reset_wxcheckin_ext_data.sql failed (maybe tables not created yet). See: ${RUN_DIR}/reset_ext.log"
fi

log "seeding an extra legacy activity for negative test (id=103, user=${WX_NORMAL2_ID} not registered)"
mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" "${LEGACY_DB}" -e "\
INSERT INTO suda_activity (id, name, description, department, sign_start_time, sign_end_time, full_num, score, location, activity_stime, activity_etime, type, state) \
VALUES (103, '未报名测试活动', '用于联动测试：未报名用户提交动态码应返回 forbidden。', '技术部', \
  DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), 50, 1, '测试地点', \
  DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 50 MINUTE), 0, 3) \
ON DUPLICATE KEY UPDATE \
  name=VALUES(name), description=VALUES(description), department=VALUES(department), location=VALUES(location), \
  activity_stime=VALUES(activity_stime), activity_etime=VALUES(activity_etime), type=VALUES(type), state=VALUES(state);" \
  >"${RUN_DIR}/seed_extra_activity.log" 2>&1

log "stopping any existing dev processes (best effort)"
pkill -f "${WORKSPACE_ROOT}/suda_union.*spring-boot:run" 2>/dev/null || true
pkill -f "${WORKSPACE_ROOT}/wxapp-checkin/backend.*spring-boot:run" 2>/dev/null || true

log "starting suda_union backend (port=${SUDA_UNION_PORT})"
bash -lc "\
  cd '${WORKSPACE_ROOT}/suda_union' && \
  SERVER_PORT='${SUDA_UNION_PORT}' \
  SPRING_DATASOURCE_URL='jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${LEGACY_DB}?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai' \
  SPRING_DATASOURCE_USERNAME='${MYSQL_USER}' \
  SPRING_DATASOURCE_PASSWORD='${MYSQL_PASSWORD}' \
  mvn -s '${MAVEN_SETTINGS}' -Dmaven.repo.local='${MAVEN_REPO}' -Dmaven.test.skip=true spring-boot:run" \
  >"${LOG_DIR}/suda_union.log" 2>&1 &
echo $! >"${RUN_DIR}/suda_union.pid"

log "starting wxapp-checkin backend (port=${WXAPP_PORT})"
bash -lc "\
  cd '${WORKSPACE_ROOT}/wxapp-checkin/backend' && \
  SERVER_PORT='${WXAPP_PORT}' \
  DB_HOST='${MYSQL_HOST}' DB_PORT='${MYSQL_PORT}' DB_NAME='${EXT_DB}' DB_USER='${MYSQL_USER}' DB_PASSWORD='${MYSQL_PASSWORD}' \
  REDIS_HOST='${REDIS_HOST}' REDIS_PORT='${REDIS_PORT}' \
  LEGACY_DB_URL='jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${LEGACY_DB}?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai' \
  LEGACY_DB_USER='${MYSQL_USER}' LEGACY_DB_PASSWORD='${MYSQL_PASSWORD}' \
  LEGACY_SYNC_ENABLED=true OUTBOX_RELAY_ENABLED=true \
  LEGACY_SYNC_INTERVAL_MS='${SYNC_PULL_INTERVAL_MS}' OUTBOX_RELAY_INTERVAL_MS='${SYNC_RELAY_INTERVAL_MS}' \
  REGISTER_PAYLOAD_VERIFY_ENABLED=false \
  ./mvnw -s '${MAVEN_SETTINGS}' -Dmaven.repo.local='${MAVEN_REPO}' spring-boot:run -Dspring-boot.run.profiles=dev" \
  >"${LOG_DIR}/wxapp_checkin_backend.log" 2>&1 &
echo $! >"${RUN_DIR}/wxapp_checkin_backend.pid"

wait_http "http://127.0.0.1:${WXAPP_PORT}/actuator/health" "200" "wxapp-checkin backend health"
wait_http_any "http://127.0.0.1:${SUDA_UNION_PORT}/" "suda_union backend port"

log "===== [1] suda_union auth smoke ====="
cat >"${RESP_DIR}/suda_login.req.json" <<JSON
{"username":"${SUDA_STAFF_ID}","password":"${SUDA_STAFF_PWD}"}
JSON
http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/suda_login" "${RESP_DIR}/suda_login.req.json" "${RESP_DIR}/suda_login.resp.json"
json_assert_eq "${RESP_DIR}/suda_login.resp.json" "code" "200"
SUDA_TOKEN="$(json_get "${RESP_DIR}/suda_login.resp.json" "data.token")"
if [[ -z "${SUDA_TOKEN}" ]]; then
  echo "[ERROR] suda_union login token is empty. resp=${RESP_DIR}/suda_login.resp.json" >&2
  exit 2
fi
log "suda_union login ok (token length=${#SUDA_TOKEN})"

cat >"${RESP_DIR}/suda_empty.req.json" <<'JSON'
{}
JSON
http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/menuList" "${RESP_DIR}/suda_empty.req.json" "${RESP_DIR}/suda_menu_list.resp.json" \
  "Authorization: ${SUDA_TOKEN}"
json_assert_eq "${RESP_DIR}/suda_menu_list.resp.json" "code" "200"

log "===== [2] wxapp-checkin auth + legacy pull ====="
cat >"${RESP_DIR}/wx_staff_login.req.json" <<JSON
{"student_id":"${WX_STAFF_ID}","password":"123"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/login" "${RESP_DIR}/wx_staff_login.req.json" "${RESP_DIR}/wx_staff_login.resp.json"
json_assert_eq "${RESP_DIR}/wx_staff_login.resp.json" "status" "success"
STAFF_SESSION="$(json_get "${RESP_DIR}/wx_staff_login.resp.json" "session_token")"
if [[ -z "${STAFF_SESSION}" ]]; then
  echo "[ERROR] wxapp staff session_token is empty. resp=${RESP_DIR}/wx_staff_login.resp.json" >&2
  exit 2
fi

cat >"${RESP_DIR}/wx_staff_change_pwd.req.json" <<'JSON'
{"old_password":"123","new_password":"staff123456"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/change-password" \
  "${RESP_DIR}/wx_staff_change_pwd.req.json" "${RESP_DIR}/wx_staff_change_pwd.resp.json" \
  "Authorization: Bearer ${STAFF_SESSION}"
json_assert_eq "${RESP_DIR}/wx_staff_change_pwd.resp.json" "status" "success"

# 等 legacy pull 跑完后，staff 活动列表必须能看到 legacy_act_101（否则后续发码会 invalid_activity）。
for _ in $(seq 1 20); do
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities?page=1&page_size=50" \
    -H "Authorization: Bearer ${STAFF_SESSION}" \
    >"${RESP_DIR}/wx_staff_activities.resp.json"
  if json_assert_contains_activity "${RESP_DIR}/wx_staff_activities.resp.json" "legacy_act_101" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
json_assert_eq "${RESP_DIR}/wx_staff_activities.resp.json" "status" "success"
json_assert_contains_activity "${RESP_DIR}/wx_staff_activities.resp.json" "legacy_act_101" >/dev/null
log "legacy_act_101 is visible in staff activities"

log "===== [3] staff issue code + normal login/change-password ====="
curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-session?action_type=checkin" \
  -H "Authorization: Bearer ${STAFF_SESSION}" \
  >"${RESP_DIR}/wx_code_session_101_checkin.resp.json"
json_assert_eq "${RESP_DIR}/wx_code_session_101_checkin.resp.json" "status" "success"
CODE_101_CHECKIN="$(json_get "${RESP_DIR}/wx_code_session_101_checkin.resp.json" "code")"
if [[ -z "${CODE_101_CHECKIN}" ]]; then
  echo "[ERROR] issued code is empty. resp=${RESP_DIR}/wx_code_session_101_checkin.resp.json" >&2
  exit 2
fi

# 102 在 seed 里属于“报名中/未开始”，窗口外应禁止发码（锁定 error_code，避免 contract 漂移）。
curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_102/code-session?action_type=checkin" \
  -H "Authorization: Bearer ${STAFF_SESSION}" \
  >"${RESP_DIR}/wx_code_session_102_checkin.resp.json"
json_assert_eq "${RESP_DIR}/wx_code_session_102_checkin.resp.json" "status" "forbidden"
json_assert_eq "${RESP_DIR}/wx_code_session_102_checkin.resp.json" "error_code" "outside_activity_time_window"

cat >"${RESP_DIR}/wx_normal_login.req.json" <<JSON
{"student_id":"${WX_NORMAL_ID}","password":"123"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/login" "${RESP_DIR}/wx_normal_login.req.json" "${RESP_DIR}/wx_normal_login.resp.json"
json_assert_eq "${RESP_DIR}/wx_normal_login.resp.json" "status" "success"
NORMAL_SESSION="$(json_get "${RESP_DIR}/wx_normal_login.resp.json" "session_token")"
if [[ -z "${NORMAL_SESSION}" ]]; then
  echo "[ERROR] wxapp normal session_token is empty. resp=${RESP_DIR}/wx_normal_login.resp.json" >&2
  exit 2
fi

curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities?page=1&page_size=50" \
  -H "Authorization: Bearer ${NORMAL_SESSION}" \
  >"${RESP_DIR}/wx_normal_activities_before_change.resp.json"
json_assert_eq "${RESP_DIR}/wx_normal_activities_before_change.resp.json" "status" "forbidden"
json_assert_eq "${RESP_DIR}/wx_normal_activities_before_change.resp.json" "error_code" "password_change_required"

cat >"${RESP_DIR}/wx_normal_change_pwd.req.json" <<'JSON'
{"old_password":"123","new_password":"normal123456"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/change-password" \
  "${RESP_DIR}/wx_normal_change_pwd.req.json" "${RESP_DIR}/wx_normal_change_pwd.resp.json" \
  "Authorization: Bearer ${NORMAL_SESSION}"
json_assert_eq "${RESP_DIR}/wx_normal_change_pwd.resp.json" "status" "success"

log "===== [4] normal activities (on-demand legacy sync) ====="
# 说明：普通用户活动列表依赖 wx_user_activity_status；若 scheduled pull 尚未执行，应触发 on-demand sync。
for _ in $(seq 1 20); do
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities?page=1&page_size=50" \
    -H "Authorization: Bearer ${NORMAL_SESSION}" \
    >"${RESP_DIR}/wx_normal_activities_after_change.resp.json"
  if json_assert_contains_activity "${RESP_DIR}/wx_normal_activities_after_change.resp.json" "legacy_act_101" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
json_assert_eq "${RESP_DIR}/wx_normal_activities_after_change.resp.json" "status" "success"
json_assert_contains_activity "${RESP_DIR}/wx_normal_activities_after_change.resp.json" "legacy_act_101" >/dev/null

log "===== [5] dynamic code consume (invalid/expired/success/duplicate) ====="
cat >"${RESP_DIR}/wx_consume_invalid.req.json" <<'JSON'
{"action_type":"checkin","code":"000000"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-consume" \
  "${RESP_DIR}/wx_consume_invalid.req.json" "${RESP_DIR}/wx_consume_invalid.resp.json" \
  "Authorization: Bearer ${NORMAL_SESSION}"
json_assert_eq "${RESP_DIR}/wx_consume_invalid.resp.json" "status" "invalid_code"

log "expired test: issue a fresh code, then sleep to next slot to ensure deterministic 'expired'"
curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-session?action_type=checkin" \
  -H "Authorization: Bearer ${STAFF_SESSION}" \
  >"${RESP_DIR}/wx_code_session_101_checkin_for_expired.resp.json"
json_assert_eq "${RESP_DIR}/wx_code_session_101_checkin_for_expired.resp.json" "status" "success"
CODE_101_EXPIRE="$(json_get "${RESP_DIR}/wx_code_session_101_checkin_for_expired.resp.json" "code")"
if [[ -z "${CODE_101_EXPIRE}" ]]; then
  echo "[ERROR] code for expired test is empty. resp=${RESP_DIR}/wx_code_session_101_checkin_for_expired.resp.json" >&2
  exit 2
fi

sleep_to_next_slot 10
cat >"${RESP_DIR}/wx_consume_expired.req.json" <<JSON
{"action_type":"checkin","code":"${CODE_101_EXPIRE}"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-consume" \
  "${RESP_DIR}/wx_consume_expired.req.json" "${RESP_DIR}/wx_consume_expired.resp.json" \
  "Authorization: Bearer ${NORMAL_SESSION}"
json_assert_eq "${RESP_DIR}/wx_consume_expired.resp.json" "status" "expired"

log "issue fresh code and consume checkin"
curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-session?action_type=checkin" \
  -H "Authorization: Bearer ${STAFF_SESSION}" \
  >"${RESP_DIR}/wx_code_session_101_checkin_fresh.resp.json"
json_assert_eq "${RESP_DIR}/wx_code_session_101_checkin_fresh.resp.json" "status" "success"
CODE_101_CHECKIN_FRESH="$(json_get "${RESP_DIR}/wx_code_session_101_checkin_fresh.resp.json" "code")"
if [[ -z "${CODE_101_CHECKIN_FRESH}" ]]; then
  echo "[ERROR] fresh code is empty. resp=${RESP_DIR}/wx_code_session_101_checkin_fresh.resp.json" >&2
  exit 2
fi

cat >"${RESP_DIR}/wx_consume_checkin.req.json" <<JSON
{"action_type":"checkin","code":"${CODE_101_CHECKIN_FRESH}"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-consume" \
  "${RESP_DIR}/wx_consume_checkin.req.json" "${RESP_DIR}/wx_consume_checkin.resp.json" \
  "Authorization: Bearer ${NORMAL_SESSION}"
json_assert_eq "${RESP_DIR}/wx_consume_checkin.resp.json" "status" "success"

http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-consume" \
  "${RESP_DIR}/wx_consume_checkin.req.json" "${RESP_DIR}/wx_consume_checkin_dup.resp.json" \
  "Authorization: Bearer ${NORMAL_SESSION}"
json_assert_eq "${RESP_DIR}/wx_consume_checkin_dup.resp.json" "status" "duplicate"

log "===== [6] wait outbox relay -> legacy apply should be check_in=1 check_out=0 ====="
legacy_row=""
legacy_checkin=""
legacy_checkout=""
for _ in $(seq 1 20); do
  legacy_row="$(mysql -N -B -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" "${LEGACY_DB}" -e "\
SELECT (check_in+0) AS check_in, (check_out+0) AS check_out FROM suda_activity_apply \
WHERE activity_id=101 AND username='${WX_NORMAL_ID}' LIMIT 1;" || true)"
  legacy_checkin=""
  legacy_checkout=""
  IFS=$'\t' read -r legacy_checkin legacy_checkout <<<"${legacy_row}"
  if [[ "${legacy_checkin}" == "1" && "${legacy_checkout}" == "0" ]]; then
    break
  fi
  sleep 1
done
echo "${legacy_row}" >"${RESP_DIR}/legacy_apply_101_after_checkin.tsv"
if [[ "${legacy_checkin}" != "1" || "${legacy_checkout}" != "0" ]]; then
  echo "[ERROR] legacy apply not updated after checkin. got='${legacy_row}' expect='1<TAB>0' file=${RESP_DIR}/legacy_apply_101_after_checkin.tsv" >&2
  exit 2
fi

log "suda_union should read the same state (checkIn=true, checkOut=false) for user=${WX_NORMAL_ID} activity=101"
cat >"${RESP_DIR}/suda_username_applications.req.json" <<JSON
{"username":"${WX_NORMAL_ID}"}
JSON
http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/activity/usernameApplications" \
  "${RESP_DIR}/suda_username_applications.req.json" "${RESP_DIR}/suda_username_applications_after_checkin.resp.json" \
  "Authorization: ${SUDA_TOKEN}"
json_assert_eq "${RESP_DIR}/suda_username_applications_after_checkin.resp.json" "code" "200"
python3 - "${RESP_DIR}/suda_username_applications_after_checkin.resp.json" <<'PY'
import json,sys
data=json.load(open(sys.argv[1], encoding="utf-8"))
rows=data.get("data") or []
row=next((r for r in rows if isinstance(r, dict) and r.get("activityId")==101), None)
if not row:
  print("[ERROR] missing activityId=101 in suda_union usernameApplications", file=sys.stderr)
  sys.exit(2)
if row.get("checkIn") is not True:
  print(f"[ERROR] expected checkIn=true got={row.get('checkIn')}", file=sys.stderr)
  sys.exit(2)
if row.get("checkOut") is not False:
  print(f"[ERROR] expected checkOut=false got={row.get('checkOut')}", file=sys.stderr)
  sys.exit(2)
print("ok")
PY

log "===== [7] staff bulk-checkout -> legacy apply should be check_in=1 check_out=1 ====="
cat >"${RESP_DIR}/wx_bulk_checkout.req.json" <<'JSON'
{"confirm":true,"reason":"联动测试：活动结束统一签退"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/staff/activities/legacy_act_101/bulk-checkout" \
  "${RESP_DIR}/wx_bulk_checkout.req.json" "${RESP_DIR}/wx_bulk_checkout.resp.json" \
  "Authorization: Bearer ${STAFF_SESSION}"
json_assert_eq "${RESP_DIR}/wx_bulk_checkout.resp.json" "status" "success"

cat >"${RESP_DIR}/wx_bulk_checkout_not_confirm.req.json" <<'JSON'
{"confirm":false,"reason":"should fail"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/staff/activities/legacy_act_101/bulk-checkout" \
  "${RESP_DIR}/wx_bulk_checkout_not_confirm.req.json" "${RESP_DIR}/wx_bulk_checkout_not_confirm.resp.json" \
  "Authorization: Bearer ${STAFF_SESSION}"
json_assert_eq "${RESP_DIR}/wx_bulk_checkout_not_confirm.resp.json" "status" "invalid_param"

legacy_row2=""
legacy2_checkin=""
legacy2_checkout=""
for _ in $(seq 1 20); do
  legacy_row2="$(mysql -N -B -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" "${LEGACY_DB}" -e "\
SELECT (check_in+0) AS check_in, (check_out+0) AS check_out FROM suda_activity_apply \
WHERE activity_id=101 AND username='${WX_NORMAL_ID}' LIMIT 1;" || true)"
  legacy2_checkin=""
  legacy2_checkout=""
  IFS=$'\t' read -r legacy2_checkin legacy2_checkout <<<"${legacy_row2}"
  if [[ "${legacy2_checkin}" == "1" && "${legacy2_checkout}" == "1" ]]; then
    break
  fi
  sleep 1
done
echo "${legacy_row2}" >"${RESP_DIR}/legacy_apply_101_after_checkout.tsv"
if [[ "${legacy2_checkin}" != "1" || "${legacy2_checkout}" != "1" ]]; then
  echo "[ERROR] legacy apply not updated after bulk-checkout. got='${legacy_row2}' expect='1<TAB>1' file=${RESP_DIR}/legacy_apply_101_after_checkout.tsv" >&2
  exit 2
fi

http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/activity/usernameApplications" \
  "${RESP_DIR}/suda_username_applications.req.json" "${RESP_DIR}/suda_username_applications_after_checkout.resp.json" \
  "Authorization: ${SUDA_TOKEN}"
json_assert_eq "${RESP_DIR}/suda_username_applications_after_checkout.resp.json" "code" "200"
python3 - "${RESP_DIR}/suda_username_applications_after_checkout.resp.json" <<'PY'
import json,sys
data=json.load(open(sys.argv[1], encoding="utf-8"))
rows=data.get("data") or []
row=next((r for r in rows if isinstance(r, dict) and r.get("activityId")==101), None)
if not row:
  print("[ERROR] missing activityId=101 in suda_union usernameApplications", file=sys.stderr)
  sys.exit(2)
if row.get("checkOut") is not True:
  print(f"[ERROR] expected checkOut=true got={row.get('checkOut')}", file=sys.stderr)
  sys.exit(2)
print("ok")
PY

log "post-bulk-checkout: wait legacy pull reconcile and ensure wxapp detail shows my_checked_out=true"
for _ in $(seq 1 20); do
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101" \
    -H "Authorization: Bearer ${NORMAL_SESSION}" \
    >"${RESP_DIR}/wx_normal_detail_101.resp.json"
  checked_out="$(json_get "${RESP_DIR}/wx_normal_detail_101.resp.json" "my_checked_out")"
  if [[ "${checked_out}" == "true" || "${checked_out}" == "True" ]]; then
    break
  fi
  sleep 1
done
json_assert_eq "${RESP_DIR}/wx_normal_detail_101.resp.json" "status" "success"
checked_out="$(json_get "${RESP_DIR}/wx_normal_detail_101.resp.json" "my_checked_out")"
if [[ "${checked_out}" != "true" && "${checked_out}" != "True" ]]; then
  echo "[ERROR] expected my_checked_out=true. resp=${RESP_DIR}/wx_normal_detail_101.resp.json" >&2
  exit 2
fi

log "===== [8] negatives: normal cannot issue code, staff cannot consume, not-registered cannot consume ====="
curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-session?action_type=checkin" \
  -H "Authorization: Bearer ${NORMAL_SESSION}" \
  >"${RESP_DIR}/wx_normal_issue_code_should_fail.resp.json"
json_assert_eq "${RESP_DIR}/wx_normal_issue_code_should_fail.resp.json" "status" "forbidden"

cat >"${RESP_DIR}/wx_staff_consume_should_fail.req.json" <<JSON
{"action_type":"checkin","code":"${CODE_101_CHECKIN_FRESH}"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_101/code-consume" \
  "${RESP_DIR}/wx_staff_consume_should_fail.req.json" "${RESP_DIR}/wx_staff_consume_should_fail.resp.json" \
  "Authorization: Bearer ${STAFF_SESSION}"
json_assert_eq "${RESP_DIR}/wx_staff_consume_should_fail.resp.json" "status" "forbidden"

cat >"${RESP_DIR}/wx_normal2_login.req.json" <<JSON
{"student_id":"${WX_NORMAL2_ID}","password":"123"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/login" "${RESP_DIR}/wx_normal2_login.req.json" "${RESP_DIR}/wx_normal2_login.resp.json"
json_assert_eq "${RESP_DIR}/wx_normal2_login.resp.json" "status" "success"
NORMAL2_SESSION="$(json_get "${RESP_DIR}/wx_normal2_login.resp.json" "session_token")"
if [[ -z "${NORMAL2_SESSION}" ]]; then
  echo "[ERROR] wxapp normal2 session_token is empty. resp=${RESP_DIR}/wx_normal2_login.resp.json" >&2
  exit 2
fi
cat >"${RESP_DIR}/wx_normal2_change_pwd.req.json" <<'JSON'
{"old_password":"123","new_password":"normal2123456"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/change-password" \
  "${RESP_DIR}/wx_normal2_change_pwd.req.json" "${RESP_DIR}/wx_normal2_change_pwd.resp.json" \
  "Authorization: Bearer ${NORMAL2_SESSION}"
json_assert_eq "${RESP_DIR}/wx_normal2_change_pwd.resp.json" "status" "success"

# 等 legacy pull 把 activity 103 同步到投影表后再发码（否则 staff 会 invalid_activity）。
for _ in $(seq 1 30); do
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_103/code-session?action_type=checkin" \
    -H "Authorization: Bearer ${STAFF_SESSION}" \
    >"${RESP_DIR}/wx_code_session_103_checkin.resp.json"
  status_103="$(json_get "${RESP_DIR}/wx_code_session_103_checkin.resp.json" "status")"
  if [[ "${status_103}" == "success" ]]; then
    break
  fi
  sleep 1
done
json_assert_eq "${RESP_DIR}/wx_code_session_103_checkin.resp.json" "status" "success"
CODE_103="$(json_get "${RESP_DIR}/wx_code_session_103_checkin.resp.json" "code")"
if [[ -z "${CODE_103}" ]]; then
  echo "[ERROR] code_103 is empty. resp=${RESP_DIR}/wx_code_session_103_checkin.resp.json" >&2
  exit 2
fi

cat >"${RESP_DIR}/wx_consume_103_not_registered.req.json" <<JSON
{"action_type":"checkin","code":"${CODE_103}"}
JSON
http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/legacy_act_103/code-consume" \
  "${RESP_DIR}/wx_consume_103_not_registered.req.json" "${RESP_DIR}/wx_consume_103_not_registered.resp.json" \
  "Authorization: Bearer ${NORMAL2_SESSION}"
json_assert_eq "${RESP_DIR}/wx_consume_103_not_registered.resp.json" "status" "forbidden"

log "PASS: three-project integration e2e ok"
log "- run dir: ${RUN_DIR}"
log "- logs: ${LOG_DIR}"
log "- responses: ${RESP_DIR}"
