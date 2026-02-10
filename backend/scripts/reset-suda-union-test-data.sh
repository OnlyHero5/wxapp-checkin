#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${WXAPP_TEST_ENV_FILE:-$HOME/.wxapp-checkin-test-env.sh}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
LEGACY_SCHEMA="${LEGACY_SCHEMA:-suda_union}"
EXT_SCHEMA="${DB_NAME:-wxcheckin_ext}"

MYSQL_ARGS=(-h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}")
if [[ -n "${DB_PASSWORD}" ]]; then
  MYSQL_ARGS+=(-p"${DB_PASSWORD}")
fi

echo "[seed] Resetting legacy schema: ${LEGACY_SCHEMA}"
mysql "${MYSQL_ARGS[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${LEGACY_SCHEMA}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE \`${LEGACY_SCHEMA}\`;

CREATE TABLE IF NOT EXISTS suda_user (
  id BIGINT NOT NULL PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  user_type VARCHAR(16) NOT NULL DEFAULT 'normal',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suda_activity (
  id INT NOT NULL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  location VARCHAR(128) NULL,
  activity_stime DATETIME NOT NULL,
  type INT NOT NULL,
  state INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suda_activity_apply (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL,
  username VARCHAR(32) NOT NULL,
  state INT NOT NULL DEFAULT 1,
  check_in BIT(1) NOT NULL DEFAULT b'0',
  check_out BIT(1) NOT NULL DEFAULT b'1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_suda_activity_apply_activity (activity_id),
  KEY idx_suda_activity_apply_user (username),
  CONSTRAINT fk_apply_activity FOREIGN KEY (activity_id) REFERENCES suda_activity(id),
  CONSTRAINT fk_apply_user FOREIGN KEY (username) REFERENCES suda_user(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE suda_activity_apply;
TRUNCATE TABLE suda_activity;
TRUNCATE TABLE suda_user;
SET FOREIGN_KEY_CHECKS=1;

INSERT INTO suda_user (id, username, name, user_type) VALUES
  (70001, '2025000007', '刘洋', 'staff'),
  (70002, '2025000008', '王敏', 'staff'),
  (70101, '2025000101', '张三', 'normal'),
  (70102, '2025000102', '李四', 'normal'),
  (70103, '2025000103', '王五', 'normal'),
  (70104, '2025000104', '赵六', 'normal'),
  (70105, '2025000105', '孙七', 'normal'),
  (70106, '2025000106', '周八', 'normal'),
  (70107, '2025000107', '吴九', 'normal');

INSERT INTO suda_activity (id, name, description, location, activity_stime, type, state) VALUES
  (101, 'AI 工具实战工作坊', '面向学生组织的 AI 工具落地训练营。', '图书馆创客空间', DATE_ADD(NOW(), INTERVAL 1 DAY), 1, 1),
  (102, '校园 HackDay', '48 小时跨专业协作开发挑战。', '创新中心 1F', DATE_ADD(NOW(), INTERVAL 2 DAY), 2, 2),
  (103, '产品设计论坛', '产品、运营、设计联合主题论坛。', '南校区报告厅', DATE_ADD(NOW(), INTERVAL 4 DAY), 1, 3),
  (104, '学生组织开放日', '社团成果展示与新生交流活动。', '大学生活动中心', DATE_SUB(NOW(), INTERVAL 2 DAY), 2, 4),
  (105, '年度运营复盘会', '运营数据复盘与改进计划评审。', '主楼 5F 多功能厅', DATE_SUB(NOW(), INTERVAL 10 DAY), 1, 5),
  (106, '活动安全培训', '线下活动安全风险识别培训。', '行政楼 2F 会议室', DATE_SUB(NOW(), INTERVAL 20 DAY), 2, 6),
  (107, '科研成果路演', '科研项目公开路演与答辩。', '学术报告厅', DATE_ADD(NOW(), INTERVAL 7 DAY), 2, 1);

INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out) VALUES
  (101, '2025000007', 1, b'1', b'0'),
  (103, '2025000007', 1, b'0', b'1'),
  (102, '2025000008', 1, b'1', b'1'),
  (105, '2025000008', 1, b'1', b'0'),

  (101, '2025000101', 1, b'0', b'1'),
  (102, '2025000101', 1, b'1', b'1'),
  (104, '2025000101', 1, b'1', b'0'),
  (105, '2025000101', 1, b'0', b'1'),

  (101, '2025000102', 1, b'1', b'1'),
  (102, '2025000102', 1, b'0', b'1'),
  (104, '2025000102', 1, b'1', b'1'),
  (106, '2025000102', 1, b'1', b'0'),

  (101, '2025000103', 1, b'1', b'0'),
  (103, '2025000103', 1, b'0', b'1'),
  (105, '2025000103', 1, b'1', b'0'),

  (101, '2025000104', 3, b'0', b'1'),
  (103, '2025000104', 1, b'1', b'1'),
  (104, '2025000104', 1, b'1', b'0'),
  (106, '2025000104', 1, b'1', b'1'),

  (102, '2025000105', 1, b'0', b'1'),
  (104, '2025000105', 3, b'0', b'1'),
  (103, '2025000107', 3, b'0', b'1');
SQL

HAS_ADMIN_ROSTER="$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${EXT_SCHEMA}' AND table_name='wx_admin_roster';")"
if [[ "${HAS_ADMIN_ROSTER}" == "1" ]]; then
  echo "[seed] Upserting admin roster in ${EXT_SCHEMA}.wx_admin_roster"
  mysql "${MYSQL_ARGS[@]}" -D "${EXT_SCHEMA}" <<'SQL'
INSERT INTO wx_admin_roster (student_id, name, active)
VALUES
  ('2025000007', '刘洋', 1),
  ('2025000008', '王敏', 1)
ON DUPLICATE KEY UPDATE
  active = VALUES(active);
SQL
else
  echo "[seed] Skip admin roster upsert: ${EXT_SCHEMA}.wx_admin_roster not found."
fi

echo "[seed] Done. Summary:"
mysql "${MYSQL_ARGS[@]}" -N -D "${LEGACY_SCHEMA}" -e \
  "SELECT 'suda_user', COUNT(*) FROM suda_user; \
   SELECT 'suda_activity', COUNT(*) FROM suda_activity; \
   SELECT 'suda_activity_apply', COUNT(*) FROM suda_activity_apply;"

cd "${PROJECT_ROOT}" >/dev/null
