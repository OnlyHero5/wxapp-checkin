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
  let compose =
    fs::read_to_string(repo_file("docker-compose.yml")).expect("read docker-compose.yml");
  assert!(
    compose.contains("SUDA_UNION_DB_HOST"),
    "docker compose should read suda-union host from env file instead of hardcoding it"
  );
  assert!(
    compose.contains("SUDA_UNION_DB_PORT:-3499"),
    "docker compose should default suda-union port to 3499"
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
    env.contains("SUDA_UNION_DB_PORT=3499"),
    "docker env example should lock the suda-union port to 3499 by default"
  );
}

#[test]
fn docker_start_script_should_stream_backend_logs_to_terminal() {
  let script = fs::read_to_string(repo_file("docker/start.sh")).expect("read docker/start.sh");
  assert!(
    script.contains("tee -a"),
    "docker start script should mirror backend logs to terminal and file at the same time"
  );
  assert!(
    !script.contains(" >\"${BACKEND_LOG}\" 2>&1 &"),
    "docker start script should not hide backend logs in a file only"
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
fn deployment_doc_should_point_to_suda_union_docker_endpoint() {
  let deployment_doc =
    fs::read_to_string(repo_file("docs/DEPLOYMENT.md")).expect("read docs/DEPLOYMENT.md");
  assert!(
    deployment_doc.contains("suda-union:3499"),
    "deployment doc should describe the docker-network suda-union endpoint on port 3499"
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
