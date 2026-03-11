-- Legacy schema bootstrap for demo / local compose.
-- 注意：该脚本只用于 Docker Compose 演示环境，不代表真实 `suda_union` 线上表结构。

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `suda_union`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `suda_union`;

CREATE TABLE IF NOT EXISTS suda_user (
  id BIGINT NOT NULL PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  role INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suda_activity (
  id INT NOT NULL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  location VARCHAR(128) NULL,
  activity_stime DATETIME NOT NULL,
  activity_etime DATETIME NOT NULL,
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

-- demo 数据：用于让 compose 启动后能直接联调“实名校验/活动同步/报名校验/回写”链路。
INSERT INTO suda_user (id, username, name, role) VALUES
  (70001, '2025000007', '刘洋', 1),
  (70002, '2025000008', '王敏', 1),
  (70101, '2025000101', '张三', 9),
  (70102, '2025000102', '李四', 9),
  (70103, '2025000103', '王五', 9),
  (70104, '2025000104', '赵六', 9),
  (70105, '2025000105', '孙七', 9),
  (70106, '2025000106', '周八', 9),
  (70107, '2025000107', '吴九', 9);

INSERT INTO suda_activity (id, name, description, location, activity_stime, activity_etime, type, state) VALUES
  (101, 'AI 工具实战工作坊', '面向学生组织的 AI 工具落地训练营。', '图书馆创客空间', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 2 HOUR), 1, 1),
  (102, '校园 HackDay', '48 小时跨专业协作开发挑战。', '创新中心 1F', DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 4 HOUR), 2, 2),
  (103, '产品设计论坛', '产品、运营、设计联合主题论坛。', '南校区报告厅', DATE_ADD(NOW(), INTERVAL 4 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 4 DAY), INTERVAL 2 HOUR), 1, 3),
  (104, '学生组织开放日', '社团成果展示与新生交流活动。', '大学生活动中心', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 2 HOUR), 2, 4),
  (105, '年度运营复盘会', '运营数据复盘与改进计划评审。', '主楼 5F 多功能厅', DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), 1, 5),
  (106, '活动安全培训', '线下活动安全风险识别培训。', '行政楼 2F 会议室', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 2 HOUR), 2, 6),
  (107, '科研成果路演', '科研项目公开路演与答辩。', '学术报告厅', DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 7 DAY), INTERVAL 2 HOUR), 2, 1);

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

-- Compose 默认用户通常是 wxcheckin；为了让后端能连接 legacy DB，这里补一条 grant（可按需改用户名）。
GRANT ALL PRIVILEGES ON `suda_union`.* TO 'wxcheckin'@'%';
FLUSH PRIVILEGES;
