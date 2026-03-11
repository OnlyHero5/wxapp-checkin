#!/usr/bin/env bash
set -euo pipefail

# 三项目联动全流程回归（按用户要求：5 个活动 × 每个活动 >=10 名普通用户，覆盖“发布→报名→发码→签到→签退→人数统计→用户态展示”）。
#
# 覆盖范围（以“数据同步正确性”为第一目标）：
# - suda_union：管理员登录、发布活动；普通用户登录、报名（写入 suda_activity/suda_activity_apply）
# - wxapp-checkin：legacy pull 把活动/报名同步到投影与状态；staff 发动态签到/签退码；普通用户签到/签退落库并写 outbox
# - outbox relay：把 check_in/check_out 写回 legacy（suda_activity_apply），再由 legacy pull 对齐计数与状态
#
# 说明：
# - 本脚本走“后端 API + DB 双证据”，等价于 suda-gs-ams 前端调用的 /activity/* 接口链路（不做 UI 自动化）。
# - 会 DROP/重建 legacy 库 suda_union，并清理 wxcheckin_ext 的业务数据（保留 schema/Flyway）。
# - 仅用于本地联调/回归环境，禁止在生产环境执行。
#
# 运行：
#   WXAPP_CHECKIN_E2E=1 bash scripts/run-3projects-integration-full-flow-e2e.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_ROOT="$(cd "${BACKEND_DIR}/../.." && pwd)"

RUNTIME_DIR="${BACKEND_DIR}/target/three_projects_full_flow_e2e"
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

# ===== 覆盖规模（用户要求：5 个活动 × 每个活动 >=10 名普通用户）=====
ACTIVITY_COUNT="${ACTIVITY_COUNT:-5}"
USER_COUNT="${USER_COUNT:-10}"

# ===== 账号口径 =====
# legacy/suda_union：seed_suda_union_final.sql 内置 staff（role=0 / 密码=123456）
SUDA_STAFF_ID="${SUDA_STAFF_ID:-20254227087}"
SUDA_STAFF_PWD="${SUDA_STAFF_PWD:-123456}"

# wxapp-checkin：Web-only 默认密码为 123（首次登录必须改密）
WX_STAFF_ID="${WX_STAFF_ID:-20254227087}"
WX_DEFAULT_PWD="${WX_DEFAULT_PWD:-123}"

# 普通用户学号段：2025000201 ~ 2025000210（可改 USER_ID_BASE 产生不同范围）
USER_ID_BASE="${USER_ID_BASE:-2025000201}"

SYNC_PULL_INTERVAL_MS="${SYNC_PULL_INTERVAL_MS:-2000}"
SYNC_RELAY_INTERVAL_MS="${SYNC_RELAY_INTERVAL_MS:-2000}"

# 动态码 rotateSeconds=10 时，50~100 次请求很容易跨 slot 造成误报 expired。
# 这里把本次回归涉及的活动 rotate_seconds 提高到 300s，保证“同一张码”能覆盖所有用户提交。
ROTATE_SECONDS="${ROTATE_SECONDS:-300}"
GRACE_SECONDS="${GRACE_SECONDS:-20}"

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
  for _ in $(seq 1 240); do
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
  for _ in $(seq 1 240); do
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

fmt_time() {
  # suda_union / suda-gs-ams 约定的后端时间格式："YYYY-MM-DD HH:mm:ss"
  date -d "$1" '+%F %T'
}

mk_user_id() {
  local idx="$1"
  python3 - "${USER_ID_BASE}" "${idx}" <<'PY'
import sys
base=int(sys.argv[1])
idx=int(sys.argv[2])
print(str(base + idx))
PY
}

mysql_q() {
  # 便捷执行：输出 TSV（无表头），脚本内部再解析
  local db="$1"
  local sql="$2"
  mysql -N -B -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" "${db}" -e "${sql}"
}

legacy_insert_users() {
  log "seeding ${USER_COUNT} normal users into legacy (suda_user)"
  local pwd_hash='$2a$10$SyWCXk7h6xt/P1vBOgSRIezsVitZrcjzkIXS59IpifBd0/wxNHT0K'

  local values=""
  for i in $(seq 0 $((USER_COUNT - 1))); do
    sid="$(mk_user_id "${i}")"
    name="E2E用户$(printf '%02d' $((i + 1)))"
    email="${sid}@test.local"
    if [[ -n "${values}" ]]; then
      values="${values},"
    fi
    values="${values}('${sid}','${pwd_hash}','${name}',b'1',4,'${email}','软件工程','2025',NOW(),NOW())"
  done

  mysql_q "${LEGACY_DB}" "\
INSERT INTO suda_user (username,password,name,invalid,role,email,major,grade,create_time,last_login_time)
VALUES ${values}
ON DUPLICATE KEY UPDATE
  password=VALUES(password),
  name=VALUES(name),
  invalid=VALUES(invalid),
  role=VALUES(role),
  email=VALUES(email),
  major=VALUES(major),
  grade=VALUES(grade),
  last_login_time=VALUES(last_login_time);"
}

wx_login_and_change_pwd() {
  local student_id="$1"
  local new_pwd="$2"
  local out_prefix="$3"

  cat >"${RESP_DIR}/${out_prefix}_login.req.json" <<JSON
{"student_id":"${student_id}","password":"${WX_DEFAULT_PWD}"}
JSON
  http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/login" \
    "${RESP_DIR}/${out_prefix}_login.req.json" "${RESP_DIR}/${out_prefix}_login.resp.json"
  json_assert_eq "${RESP_DIR}/${out_prefix}_login.resp.json" "status" "success"
  session="$(json_get "${RESP_DIR}/${out_prefix}_login.resp.json" "session_token")"
  if [[ -z "${session}" ]]; then
    echo "[ERROR] wx login session_token empty: ${RESP_DIR}/${out_prefix}_login.resp.json" >&2
    exit 2
  fi

  cat >"${RESP_DIR}/${out_prefix}_change_pwd.req.json" <<JSON
{"old_password":"${WX_DEFAULT_PWD}","new_password":"${new_pwd}"}
JSON
  http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/auth/change-password" \
    "${RESP_DIR}/${out_prefix}_change_pwd.req.json" "${RESP_DIR}/${out_prefix}_change_pwd.resp.json" \
    "Authorization: Bearer ${session}"
  json_assert_eq "${RESP_DIR}/${out_prefix}_change_pwd.resp.json" "status" "success"
  echo "${session}"
}

wx_list_and_assert_contains_all() {
  local session="$1"
  local out_file="$2"
  shift 2
  local activity_ids=("$@")

  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities?page=1&page_size=200" \
    -H "Authorization: Bearer ${session}" >"${out_file}"
  json_assert_eq "${out_file}" "status" "success"

  python3 - "${out_file}" "${activity_ids[@]}" <<'PY'
import json,sys
file=sys.argv[1]
want=set(sys.argv[2:])
data=json.load(open(file, encoding="utf-8"))
activities=data.get("activities") or []
have=set()
for a in activities:
  if isinstance(a, dict) and a.get("activity_id"):
    have.add(a["activity_id"])
missing=sorted(want - have)
if missing:
  print("[ERROR] wx activities missing:", ",".join(missing), file=sys.stderr)
  sys.exit(2)
print("ok")
PY
}

wx_activity_detail_assert_counts() {
  local session="$1"
  local activity_id="$2"
  local expect_checkin="$3"
  local expect_checkout="$4"
  local out_file="$5"
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${activity_id}" \
    -H "Authorization: Bearer ${session}" >"${out_file}"
  json_assert_eq "${out_file}" "status" "success"
  actual_ci="$(json_get "${out_file}" "checkin_count")"
  actual_co="$(json_get "${out_file}" "checkout_count")"
  if [[ "${actual_ci}" != "${expect_checkin}" || "${actual_co}" != "${expect_checkout}" ]]; then
    echo "[ERROR] unexpected counts for ${activity_id}: checkin=${actual_ci} checkout=${actual_co} expect=${expect_checkin}/${expect_checkout} file=${out_file}" >&2
    exit 2
  fi
}

wx_activity_detail_assert_user_state() {
  local session="$1"
  local activity_id="$2"
  local expect_checked_in="$3"
  local expect_checked_out="$4"
  local out_file="$5"
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${activity_id}" \
    -H "Authorization: Bearer ${session}" >"${out_file}"
  json_assert_eq "${out_file}" "status" "success"
  # python 打印 bool 默认是 True/False；这里统一转成小写，避免断言因大小写波动而误报。
  actual_in="$(json_get "${out_file}" "my_checked_in" | tr '[:upper:]' '[:lower:]')"
  actual_out="$(json_get "${out_file}" "my_checked_out" | tr '[:upper:]' '[:lower:]')"
  if [[ "${actual_in}" != "${expect_checked_in}" || "${actual_out}" != "${expect_checked_out}" ]]; then
    echo "[ERROR] unexpected user state for ${activity_id}: my_checked_in=${actual_in} my_checked_out=${actual_out} expect=${expect_checked_in}/${expect_checked_out} file=${out_file}" >&2
    exit 2
  fi
}

legacy_wait_apply_count() {
  local legacy_activity_id="$1"
  local expect_checkin="$2"
  local expect_checkout="$3"
  local usernames_csv="$4"
  local label="$5"

  for _ in $(seq 1 60); do
    got="$(mysql_q "${LEGACY_DB}" "\
SELECT
  SUM(CASE WHEN (check_in+0)=1 AND (check_out+0)=0 THEN 1 ELSE 0 END) AS checked_in_not_out,
  SUM(CASE WHEN (check_in+0)=1 AND (check_out+0)=1 THEN 1 ELSE 0 END) AS checked_out
FROM suda_activity_apply
WHERE activity_id=${legacy_activity_id} AND username IN (${usernames_csv});")"
    ci="$(echo "${got}" | awk '{print $1}')"
    co="$(echo "${got}" | awk '{print $2}')"
    if [[ "${ci}" == "${expect_checkin}" && "${co}" == "${expect_checkout}" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "[ERROR] legacy apply not synced (${label}): activity_id=${legacy_activity_id} expect ci/co=${expect_checkin}/${expect_checkout} got='${got}'" >&2
  exit 2
}

log "artifacts will be saved to: ${RUN_DIR}"
log "requirement: activities=${ACTIVITY_COUNT}, users_per_activity=${USER_COUNT}"

require_cmd mysql
require_cmd mysqladmin
require_cmd redis-cli
require_cmd curl
require_cmd python3
require_cmd mvn

log "checking mysql/redis connectivity"
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
  log "[WARN] reset_wxcheckin_ext_data.sql failed (maybe tables not created yet). See: ${RUN_DIR}/reset_ext.log"
fi

legacy_insert_users

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

log "===== [A] suda_union staff login ====="
cat >"${RESP_DIR}/suda_staff_login.req.json" <<JSON
{"username":"${SUDA_STAFF_ID}","password":"${SUDA_STAFF_PWD}"}
JSON
http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/suda_login" \
  "${RESP_DIR}/suda_staff_login.req.json" "${RESP_DIR}/suda_staff_login.resp.json"
json_assert_eq "${RESP_DIR}/suda_staff_login.resp.json" "code" "200"
SUDA_TOKEN="$(json_get "${RESP_DIR}/suda_staff_login.resp.json" "data.token")"
if [[ -z "${SUDA_TOKEN}" ]]; then
  echo "[ERROR] suda_union staff token empty: ${RESP_DIR}/suda_staff_login.resp.json" >&2
  exit 2
fi

log "===== [B] suda_union staff publishes ${ACTIVITY_COUNT} activities ====="
SIGN_START="$(fmt_time '-1 hour')"
SIGN_END="$(fmt_time '+20 minutes')"
ACT_START="$(fmt_time '+25 minutes')"
ACT_END="$(fmt_time '+145 minutes')"

activity_ids=()
activity_wx_ids=()
for i in $(seq 1 "${ACTIVITY_COUNT}"); do
  name="E2E联动活动-${RUN_ID}-$(printf '%02d' "${i}")"
  cat >"${RESP_DIR}/suda_activity_create_${i}.req.json" <<JSON
{
  "name":"${name}",
  "description":"三项目联动回归（${RUN_ID}）：发布→报名→发码→签到→签退→同步校验",
  "signStartTime":"${SIGN_START}",
  "signEndTime":"${SIGN_END}",
  "fullNum":200,
  "score":1,
  "location":"E2E 测试地点",
  "activityStime":"${ACT_START}",
  "activityEtime":"${ACT_END}",
  "type":0
}
JSON
  http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/activity/create" \
    "${RESP_DIR}/suda_activity_create_${i}.req.json" "${RESP_DIR}/suda_activity_create_${i}.resp.json" \
    "Authorization: ${SUDA_TOKEN}"
  json_assert_eq "${RESP_DIR}/suda_activity_create_${i}.resp.json" "code" "200"

  legacy_id="$(mysql_q "${LEGACY_DB}" "SELECT id FROM suda_activity WHERE name='${name}' LIMIT 1;")"
  if [[ -z "${legacy_id}" ]]; then
    echo "[ERROR] cannot find created legacy activity id by name='${name}'" >&2
    exit 2
  fi
  activity_ids+=("${legacy_id}")
  activity_wx_ids+=("legacy_act_${legacy_id}")
done

log "created legacy activity ids: ${activity_ids[*]}"

log "===== [C] normal users login + register (suda_union) ====="
# 预先拼出 username IN (...) 用于 legacy 断言（避免每轮重复拼字符串）
usernames_csv=""
user_ids=()
for i in $(seq 0 $((USER_COUNT - 1))); do
  sid="$(mk_user_id "${i}")"
  user_ids+=("${sid}")
  if [[ -n "${usernames_csv}" ]]; then
    usernames_csv="${usernames_csv},"
  fi
  usernames_csv="${usernames_csv}'${sid}'"
done

for sid in "${user_ids[@]}"; do
  cat >"${RESP_DIR}/suda_login_${sid}.req.json" <<JSON
{"username":"${sid}","password":"${SUDA_STAFF_PWD}"}
JSON
  http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/suda_login" \
    "${RESP_DIR}/suda_login_${sid}.req.json" "${RESP_DIR}/suda_login_${sid}.resp.json"
  json_assert_eq "${RESP_DIR}/suda_login_${sid}.resp.json" "code" "200"
  token="$(json_get "${RESP_DIR}/suda_login_${sid}.resp.json" "data.token")"
  if [[ -z "${token}" ]]; then
    echo "[ERROR] suda_union normal token empty: ${sid}" >&2
    exit 2
  fi

  for legacy_id in "${activity_ids[@]}"; do
    cat >"${RESP_DIR}/suda_register_${sid}_${legacy_id}.req.json" <<JSON
{"id":${legacy_id}}
JSON
    http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/activity/register" \
      "${RESP_DIR}/suda_register_${sid}_${legacy_id}.req.json" "${RESP_DIR}/suda_register_${sid}_${legacy_id}.resp.json" \
      "Authorization: ${token}"
    json_assert_eq "${RESP_DIR}/suda_register_${sid}_${legacy_id}.resp.json" "code" "200"
  done
done

log "===== [D] wxapp-checkin staff login/change-password ====="
STAFF_SESSION="$(wx_login_and_change_pwd "${WX_STAFF_ID}" "staff123456" "wx_staff")"

log "waiting legacy pull creates projections for new activities"
placeholders="$(printf ",%s" "${activity_ids[@]}")"
placeholders="${placeholders#,}"
for _ in $(seq 1 60); do
  cnt="$(mysql_q "${EXT_DB}" "SELECT COUNT(*) FROM wx_activity_projection WHERE legacy_activity_id IN (${placeholders});" || true)"
  if [[ "${cnt}" == "${ACTIVITY_COUNT}" ]]; then
    break
  fi
  sleep 1
done
cnt="$(mysql_q "${EXT_DB}" "SELECT COUNT(*) FROM wx_activity_projection WHERE legacy_activity_id IN (${placeholders});")"
if [[ "${cnt}" != "${ACTIVITY_COUNT}" ]]; then
  echo "[ERROR] wx_activity_projection not ready: expect ${ACTIVITY_COUNT}, got ${cnt}" >&2
  exit 2
fi

log "updating rotate_seconds=${ROTATE_SECONDS} for e2e activities (avoid expired slot flake)"
mysql_q "${EXT_DB}" "\
UPDATE wx_activity_projection
SET rotate_seconds=${ROTATE_SECONDS}, grace_seconds=${GRACE_SECONDS}
WHERE legacy_activity_id IN (${placeholders});" >/dev/null

log "===== [E] wxapp-checkin normal users login/change-password + ensure activities visible ====="
declare -A wx_sessions
for sid in "${user_ids[@]}"; do
  new_pwd="pass_${sid}"
  # 说明：每个用户独立会话，方便后续并行排障（响应落盘也按 sid 分开）。
  session="$(wx_login_and_change_pwd "${sid}" "${new_pwd}" "wx_${sid}")"
  wx_sessions["${sid}"]="${session}"

  wx_list_and_assert_contains_all "${session}" "${RESP_DIR}/wx_${sid}_activities.resp.json" "${activity_wx_ids[@]}" >/dev/null
done

log "===== [F] per-activity: issue checkin code -> all users checkin -> verify counts -> issue checkout -> all users checkout -> verify counts ====="
for idx in $(seq 0 $((ACTIVITY_COUNT - 1))); do
  legacy_id="${activity_ids[${idx}]}"
  wx_activity_id="legacy_act_${legacy_id}"

  log "[activity=${legacy_id}] issue checkin code"
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${wx_activity_id}/code-session?action_type=checkin" \
    -H "Authorization: Bearer ${STAFF_SESSION}" \
    >"${RESP_DIR}/wx_code_${legacy_id}_checkin.resp.json"
  json_assert_eq "${RESP_DIR}/wx_code_${legacy_id}_checkin.resp.json" "status" "success"
  code_checkin="$(json_get "${RESP_DIR}/wx_code_${legacy_id}_checkin.resp.json" "code")"
  if [[ -z "${code_checkin}" ]]; then
    echo "[ERROR] missing checkin code: ${RESP_DIR}/wx_code_${legacy_id}_checkin.resp.json" >&2
    exit 2
  fi

  for sid in "${user_ids[@]}"; do
    session="${wx_sessions[${sid}]}"
    cat >"${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkin.req.json" <<JSON
{"action_type":"checkin","code":"${code_checkin}"}
JSON
    http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${wx_activity_id}/code-consume" \
      "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkin.req.json" "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkin.resp.json" \
      "Authorization: Bearer ${session}"
    json_assert_eq "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkin.resp.json" "status" "success"
  done

  wx_activity_detail_assert_counts "${STAFF_SESSION}" "${wx_activity_id}" "${USER_COUNT}" "0" "${RESP_DIR}/wx_staff_detail_${legacy_id}_after_checkin.resp.json"

  # 用户态断言：必须显示“已报名 + 已签到 + 未签退”
  for sid in "${user_ids[@]}"; do
    session="${wx_sessions[${sid}]}"
    wx_activity_detail_assert_user_state \
      "${session}" "${wx_activity_id}" "true" "false" \
      "${RESP_DIR}/wx_${sid}_detail_${legacy_id}_after_checkin.resp.json"
  done

  log "[activity=${legacy_id}] wait outbox relay -> legacy apply check_in=1 check_out=0 (count=${USER_COUNT})"
  legacy_wait_apply_count "${legacy_id}" "${USER_COUNT}" "0" "${usernames_csv}" "after_checkin"

  log "[activity=${legacy_id}] issue checkout code"
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${wx_activity_id}/code-session?action_type=checkout" \
    -H "Authorization: Bearer ${STAFF_SESSION}" \
    >"${RESP_DIR}/wx_code_${legacy_id}_checkout.resp.json"
  json_assert_eq "${RESP_DIR}/wx_code_${legacy_id}_checkout.resp.json" "status" "success"
  code_checkout="$(json_get "${RESP_DIR}/wx_code_${legacy_id}_checkout.resp.json" "code")"
  if [[ -z "${code_checkout}" ]]; then
    echo "[ERROR] missing checkout code: ${RESP_DIR}/wx_code_${legacy_id}_checkout.resp.json" >&2
    exit 2
  fi

  for sid in "${user_ids[@]}"; do
    session="${wx_sessions[${sid}]}"
    cat >"${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkout.req.json" <<JSON
{"action_type":"checkout","code":"${code_checkout}"}
JSON
    http_json POST "http://127.0.0.1:${WXAPP_PORT}/api/web/activities/${wx_activity_id}/code-consume" \
      "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkout.req.json" "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkout.resp.json" \
      "Authorization: Bearer ${session}"
    json_assert_eq "${RESP_DIR}/wx_consume_${legacy_id}_${sid}_checkout.resp.json" "status" "success"
  done

  wx_activity_detail_assert_counts "${STAFF_SESSION}" "${wx_activity_id}" "0" "${USER_COUNT}" "${RESP_DIR}/wx_staff_detail_${legacy_id}_after_checkout.resp.json"

  # 用户态断言：必须显示“已报名 + 已签退”（checked_out=true 时 checked_in=false）
  for sid in "${user_ids[@]}"; do
    session="${wx_sessions[${sid}]}"
    wx_activity_detail_assert_user_state \
      "${session}" "${wx_activity_id}" "false" "true" \
      "${RESP_DIR}/wx_${sid}_detail_${legacy_id}_after_checkout.resp.json"
  done

  log "[activity=${legacy_id}] wait outbox relay -> legacy apply check_in=1 check_out=1 (count=${USER_COUNT})"
  legacy_wait_apply_count "${legacy_id}" "0" "${USER_COUNT}" "${usernames_csv}" "after_checkout"
done

log "===== [G] suda_union view (usernameApplications) should reflect checked_in/checked_out ====="
# 说明：该接口属于 suda_union 的“管理端查询”能力（传 username 查询其所有报名记录）。
# 这里用 staff token 统一查询所有普通用户，作为“第三项目读到一致”的证据。
for sid in "${user_ids[@]}"; do
  cat >"${RESP_DIR}/suda_username_applications_${sid}.req.json" <<JSON
{"username":"${sid}"}
JSON
  http_json POST "http://127.0.0.1:${SUDA_UNION_PORT}/activity/usernameApplications" \
    "${RESP_DIR}/suda_username_applications_${sid}.req.json" "${RESP_DIR}/suda_username_applications_${sid}.resp.json" \
    "Authorization: ${SUDA_TOKEN}"
  json_assert_eq "${RESP_DIR}/suda_username_applications_${sid}.resp.json" "code" "200"

  python3 - "${RESP_DIR}/suda_username_applications_${sid}.resp.json" "${activity_ids[@]}" <<'PY'
import json,sys

file=sys.argv[1]
want_ids=set(int(x) for x in sys.argv[2:])
data=json.load(open(file, encoding="utf-8"))
rows=data.get("data") or []
by_id={}
for r in rows:
  if isinstance(r, dict) and isinstance(r.get("activityId"), int):
    by_id[r["activityId"]]=r

missing=sorted(want_ids - set(by_id.keys()))
if missing:
  print("[ERROR] suda_union missing activityIds:", ",".join(map(str, missing)), file=sys.stderr)
  sys.exit(2)

bad=[]
for aid in want_ids:
  r=by_id[aid]
  if r.get("checkIn") is not True or r.get("checkOut") is not True:
    bad.append(f"{aid}(checkIn={r.get('checkIn')},checkOut={r.get('checkOut')})")
if bad:
  print("[ERROR] suda_union state mismatch:", ",".join(bad), file=sys.stderr)
  sys.exit(2)
print("ok")
PY
done

log "===== [H] wxapp-checkin user list should show checked_out for all activities ====="
for sid in "${user_ids[@]}"; do
  session="${wx_sessions[${sid}]}"
  curl -sS "http://127.0.0.1:${WXAPP_PORT}/api/web/activities?page=1&page_size=200" \
    -H "Authorization: Bearer ${session}" >"${RESP_DIR}/wx_${sid}_activities_final.resp.json"
  json_assert_eq "${RESP_DIR}/wx_${sid}_activities_final.resp.json" "status" "success"

  python3 - "${RESP_DIR}/wx_${sid}_activities_final.resp.json" "${activity_wx_ids[@]}" <<'PY'
import json,sys
file=sys.argv[1]
want=set(sys.argv[2:])
data=json.load(open(file, encoding="utf-8"))
activities=data.get("activities") or []
by_id={}
for a in activities:
  if isinstance(a, dict) and a.get("activity_id"):
    by_id[a["activity_id"]]=a
missing=sorted(want - set(by_id.keys()))
if missing:
  print("[ERROR] wx list missing:", ",".join(missing), file=sys.stderr)
  sys.exit(2)
bad=[]
for aid in want:
  a=by_id[aid]
  # ActivitySummaryDto 字段名为 myRegistered/myCheckedOut（snake_case 后：my_registered/my_checked_out）
  if a.get("my_registered") is not True or a.get("my_checked_out") is not True:
    bad.append(f"{aid}(my_registered={a.get('my_registered')},my_checked_out={a.get('my_checked_out')})")
if bad:
  print("[ERROR] wx list state mismatch:", ",".join(bad), file=sys.stderr)
  sys.exit(2)
print("ok")
PY
done

log "PASS: full-flow three-project integration e2e ok"
log "- run dir: ${RUN_DIR}"
log "- logs: ${LOG_DIR}"
log "- responses: ${RESP_DIR}"
