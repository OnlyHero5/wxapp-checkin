use std::fs;
use std::path::PathBuf;

fn manifest_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path)
}

fn repo_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("..")
    .join(relative_path)
}

#[test]
fn startup_should_run_database_readiness_checks_before_serving() {
  let source = fs::read_to_string(manifest_file("src/main.rs")).expect("read main.rs");
  assert!(
    source.contains("run_startup_checks"),
    "backend startup should verify database connectivity and required tables before serving traffic"
  );
}

#[test]
fn docker_compose_should_externalize_suda_union_credentials_and_port() {
  // Compose 只负责从 env 文件组装 DSN，
  // 不应该把数据库主机、端口、账号、密码硬编码死在 YAML 里。
  let compose =
    fs::read_to_string(repo_file("docker-compose.yml")).expect("read docker-compose.yml");
  assert!(
    compose.contains("SUDA_UNION_DB_HOST"),
    "docker compose should read suda-union host from env file instead of hardcoding it"
  );
  assert!(
    compose.contains("SUDA_UNION_DB_PORT"),
    "docker compose should read suda-union port from env file"
  );
  assert!(
    compose.contains("SUDA_UNION_DB_USER"),
    "docker compose should read suda-union user from env file"
  );
  assert!(
    compose.contains("SUDA_UNION_DB_PASSWORD"),
    "docker compose should read suda-union password from env file"
  );
}

#[test]
fn docker_env_example_should_document_suda_union_connection_fields() {
  // `.env.docker.example` 现在承担“唯一 Docker 发布配置入口”的职责，
  // 因此除了字段存在，还要锁住当前示例 host / port，避免文档和模板再次漂移。
  let env_example = repo_file(".env.docker.example");
  assert!(
    env_example.exists(),
    "repository should ship a docker env example for cloud deployment"
  );
  let env = fs::read_to_string(env_example).expect("read .env.docker.example");
  assert!(
    env.contains("SUDA_UNION_DB_PASSWORD="),
    "docker env example should document the suda-union password field"
  );
  assert!(
    env.contains("SUDA_UNION_DB_HOST=host.docker.internal"),
    "docker env example should document the current cloud example host"
  );
  assert!(
    env.contains("SUDA_UNION_DB_PORT=3317"),
    "docker env example should document the current cloud example port"
  );
  assert!(
    env.contains("python3"),
    "docker env example should include a concrete QR signing key generation command"
  );
  assert!(
    env.contains("secrets.token_urlsafe"),
    "docker env example should use a cryptographically secure key generation example"
  );
  assert!(
    env.contains("WXAPP_QR_SIGNING_KEY_SAMPLE="),
    "docker env example should include a sample generated signing key for reference"
  );
}

#[test]
fn docker_start_script_should_stream_backend_logs_to_terminal_without_file_log() {
  let script = fs::read_to_string(repo_file("docker/start.sh")).expect("read docker/start.sh");
  assert!(
    !script.contains("/var/log"),
    "docker start script should not keep container-local log files on storage-constrained servers"
  );
  assert!(
    !script.contains("tee -a"),
    "docker start script should avoid duplicating logs into files when docker logs already provides terminal visibility"
  );
  assert!(
    script.contains("/usr/local/bin/wxapp-checkin-backend-rust &"),
    "docker start script should leave backend logs on stdout/stderr"
  );
}

#[test]
fn docker_compose_should_limit_log_retention() {
  let compose =
    fs::read_to_string(repo_file("docker-compose.yml")).expect("read docker-compose.yml");
  assert!(
    compose.contains("max-size"),
    "docker compose should configure log rotation to cap docker log storage"
  );
  assert!(
    compose.contains("max-file"),
    "docker compose should cap the number of rotated docker log files"
  );
}

#[test]
fn repository_should_offer_one_click_docker_deploy_script() {
  assert!(
    repo_file("scripts/docker-prod.sh").exists(),
    "repository should provide a one-click docker deployment script for cloud servers"
  );
}

#[test]
fn deployment_doc_should_describe_env_driven_docker_connection_contract() {
  let deployment_doc =
    fs::read_to_string(repo_file("docs/DEPLOYMENT.md")).expect("read docs/DEPLOYMENT.md");
  assert!(
    deployment_doc.contains(".env.docker"),
    "deployment doc should keep docker connection settings in the env file"
  );
  assert!(
    deployment_doc.contains("host.docker.internal"),
    "deployment doc should describe the current cloud example host"
  );
  assert!(
    deployment_doc.contains("3317"),
    "deployment doc should describe the current cloud example port"
  );
}

#[test]
fn suda_union_write_scope_should_stay_limited_to_attendance_and_audit_logs() {
  let attendance_repo =
    fs::read_to_string(manifest_file("src/db/attendance_repo.rs")).expect("read attendance_repo");
  let log_repo = fs::read_to_string(manifest_file("src/db/log_repo.rs")).expect("read log_repo");
  let db_sources = format!("{attendance_repo}\n{log_repo}");

  assert!(
    db_sources.contains("UPDATE suda_activity_apply"),
    "attendance write path should stay scoped to suda_activity_apply"
  );
  assert!(
    db_sources.contains("INSERT INTO suda_log"),
    "audit write path should stay scoped to suda_log"
  );
  for forbidden in [
    "UPDATE suda_user ",
    "INSERT INTO suda_user(",
    "INSERT INTO suda_user ",
    "DELETE FROM suda_user ",
    "UPDATE suda_activity ",
    "INSERT INTO suda_activity(",
    "INSERT INTO suda_activity ",
    "DELETE FROM suda_activity ",
    "UPDATE suda_department ",
    "INSERT INTO suda_department(",
    "INSERT INTO suda_department ",
    "DELETE FROM suda_department ",
    "ALTER TABLE suda_",
    "DROP TABLE suda_",
    "CREATE TABLE suda_",
  ] {
    assert!(
      !db_sources.contains(forbidden),
      "unexpected suda_union write detected: {forbidden}"
    );
  }
}
