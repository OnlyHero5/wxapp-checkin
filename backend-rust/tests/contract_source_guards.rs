use std::fs;
use std::path::Path;
use std::path::PathBuf;

fn manifest_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path)
}

fn read_path_or_tree(relative_path: &str) -> String {
  let path = manifest_file(relative_path);
  let path = if path.exists() {
    path
  } else {
    manifest_file(&format!("{relative_path}.rs"))
  };
  if path.is_file() {
    return fs::read_to_string(path).expect("read source file");
  }

  let mut files = fs::read_dir(&path)
    .expect("read source dir")
    .map(|entry| entry.expect("dir entry").path())
    .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("rs"))
    .collect::<Vec<_>>();
  files.sort();

  let mut merged = String::new();
  for file in files {
    merged.push_str(&fs::read_to_string(file).expect("read nested source file"));
    merged.push('\n');
  }
  merged
}

fn collect_rs_files(root: &Path, output: &mut Vec<PathBuf>) {
  let entries = fs::read_dir(root).expect("read dir");
  for entry in entries {
    let path = entry.expect("dir entry").path();
    if path.is_dir() {
      collect_rs_files(&path, output);
      continue;
    }
    if path.extension().and_then(|value| value.to_str()) == Some("rs") {
      output.push(path);
    }
  }
}

#[test]
fn auth_service_should_not_update_last_login_time() {
  let source =
    fs::read_to_string(manifest_file("src/service/auth_service.rs")).expect("read auth_service.rs");
  assert!(
    !source.contains("update_last_login_time"),
    "login chain should not mutate suda_user.last_login_time anymore"
  );
}

#[test]
fn user_repo_should_not_touch_last_login_time_column() {
  let source = fs::read_to_string(manifest_file("src/db/user_repo.rs")).expect("read user_repo.rs");
  assert!(
    !source.contains("last_login_time"),
    "current auth baseline should not mutate suda_user.last_login_time"
  );
}

#[test]
fn user_repo_should_not_keep_password_write_path_anymore() {
  let source = fs::read_to_string(manifest_file("src/db/user_repo.rs")).expect("read user_repo.rs");
  assert!(
    !source.contains("pub async fn update_password"),
    "current auth baseline no longer exposes password write path"
  );
}

#[test]
fn auth_router_should_not_expose_change_password_route_anymore() {
  let source = fs::read_to_string(manifest_file("src/api/auth.rs")).expect("read auth.rs");
  assert!(
    !source.contains("change-password"),
    "auth router should no longer expose /change-password"
  );
}

#[test]
fn auth_extractor_should_not_keep_password_change_gate() {
  let source =
    fs::read_to_string(manifest_file("src/api/auth_extractor.rs")).expect("read auth_extractor.rs");
  assert!(
    !source.contains("password_change_required"),
    "auth extractor should not block requests on password-change state anymore"
  );
}

#[test]
fn auth_chain_should_use_axum_extractor_instead_of_manual_header_map() {
  let extractor_source =
    fs::read_to_string(manifest_file("src/api/auth_extractor.rs")).expect("read auth_extractor.rs");
  let activity_api =
    fs::read_to_string(manifest_file("src/api/activity.rs")).expect("read activity.rs");
  let staff_api = fs::read_to_string(manifest_file("src/api/staff.rs")).expect("read staff.rs");

  assert!(
    extractor_source.contains("FromRequestParts"),
    "current user auth should be implemented as an axum request-parts extractor"
  );
  assert!(
    !activity_api.contains("HeaderMap"),
    "activity handlers should not manually receive raw HeaderMap for auth anymore"
  );
  assert!(
    !staff_api.contains("HeaderMap"),
    "staff handlers should not manually receive raw HeaderMap for auth anymore"
  );
  assert!(
    !activity_api.contains("require_current_user("),
    "activity handlers should rely on framework extraction instead of manual auth calls"
  );
  assert!(
    !staff_api.contains("require_current_user("),
    "staff handlers should rely on framework extraction instead of manual auth calls"
  );
}

#[test]
fn token_signer_should_delegate_jwt_encoding_and_decoding_to_library() {
  let source = fs::read_to_string(manifest_file("src/token.rs")).expect("read token.rs");
  assert!(
    source.contains("jsonwebtoken"),
    "session token should use jsonwebtoken instead of maintaining a handwritten token format"
  );
  assert!(
    !source.contains("HmacSha256"),
    "session token module should not keep handwritten HMAC token plumbing after the refactor"
  );
  assert!(
    !source.contains("base64::engine"),
    "session token module should not keep manual base64 token framing after switching to JWT"
  );
}

#[test]
fn main_should_enable_graceful_shutdown() {
  let source = fs::read_to_string(manifest_file("src/main.rs")).expect("read main.rs");
  assert!(
    source.contains(".with_graceful_shutdown("),
    "axum server should install graceful shutdown handling for container stop signals"
  );
}

#[test]
fn infra_guards_should_use_libraries_instead_of_manual_hashmaps() {
  let rate_limit_source =
    fs::read_to_string(manifest_file("src/rate_limit.rs")).expect("read rate_limit.rs");
  let replay_guard_source =
    fs::read_to_string(manifest_file("src/replay_guard.rs")).expect("read replay_guard.rs");

  assert!(
    rate_limit_source.contains("governor"),
    "invalid code limiter should be backed by governor instead of handwritten counters"
  );
  assert!(
    !rate_limit_source.contains("Mutex<HashMap"),
    "invalid code limiter should not maintain manual hashmap state anymore"
  );
  assert!(
    replay_guard_source.contains("moka::sync::Cache"),
    "replay guard should use a cache library with TTL support"
  );
  assert!(
    !replay_guard_source.contains("Mutex<HashMap"),
    "replay guard should not maintain manual hashmap state anymore"
  );
}

#[test]
fn dynamic_in_queries_should_use_sqlx_query_builder() {
  let source = fs::read_to_string(manifest_file("src/db/attendance_repo.rs"))
    .expect("read attendance_repo.rs");
  assert!(
    source.contains("QueryBuilder"),
    "attendance repo should use sqlx::QueryBuilder for dynamic IN clauses"
  );
  assert!(
    !source.contains("repeat_n(\"?\""),
    "attendance repo should not manually concatenate SQL placeholders anymore"
  );
}

#[test]
fn mysql_pool_should_pin_session_timezone_to_beijing() {
  let source = fs::read_to_string(manifest_file("src/db/mod.rs")).expect("read db/mod.rs");

  assert!(
    source.contains(".after_connect("),
    "mysql pool should initialize each session with an explicit timezone contract"
  );
  assert!(
    source.contains("SET time_zone = '+08:00'"),
    "mysql session should pin time_zone to +08:00 before reading TIMESTAMP audit data"
  );
}

#[test]
fn service_helper_logic_should_be_centralized_in_shared_module() {
  let activity_list = fs::read_to_string(manifest_file("src/service/activity_service/list.rs"))
    .expect("read activity_service/list.rs");
  let activity_detail = fs::read_to_string(manifest_file("src/service/activity_service/detail.rs"))
    .expect("read activity_service/detail.rs");
  let activity_code = fs::read_to_string(manifest_file("src/service/activity_service/code.rs"))
    .expect("read activity_service/code.rs");
  let attendance_mod = fs::read_to_string(manifest_file("src/service/attendance_service/mod.rs"))
    .expect("read attendance_service/mod.rs");
  let shared_helpers = manifest_file("src/service/shared_helpers.rs");

  assert!(
    shared_helpers.exists(),
    "shared service helpers module should exist for cross-service helper reuse"
  );
  assert!(
    !activity_list.contains("fn now_millis("),
    "activity list service should reuse a shared now_millis helper"
  );
  assert!(
    !activity_detail.contains("fn now_millis("),
    "activity detail service should reuse a shared now_millis helper"
  );
  assert!(
    !activity_code.contains("fn now_millis("),
    "activity code service should reuse a shared now_millis helper"
  );
  assert!(
    !attendance_mod.contains("fn now_millis("),
    "attendance service module should reuse a shared now_millis helper"
  );
  assert!(
    !attendance_mod.contains("fn role_from_user("),
    "attendance service module should reuse a shared role mapping helper"
  );
}

#[test]
fn roster_service_should_not_do_per_user_log_n_plus_one_queries() {
  let source = read_path_or_tree("src/service/staff_service");
  assert!(
    !source.contains("find_latest_action_time("),
    "staff roster flow should batch load log timestamps instead of querying one user at a time"
  );
  assert!(
    source.contains("find_latest_action_times"),
    "staff roster flow should rely on batch timestamp queries from log_repo"
  );
}

#[test]
fn attendance_repo_should_share_one_roster_row_shape() {
  let source = fs::read_to_string(manifest_file("src/db/attendance_repo.rs"))
    .expect("read attendance_repo.rs");

  assert!(
    source.contains("pub struct AttendanceRosterRow"),
    "attendance repo should define one shared roster row model"
  );
  assert!(
    source.contains("pub type RosterRow = AttendanceRosterRow;"),
    "roster read path should reuse the shared roster row alias"
  );
  assert!(
    source.contains("pub type ManagedAttendanceRow = AttendanceRosterRow;"),
    "managed attendance read path should reuse the shared roster row alias"
  );
  assert!(
    !source.contains("pub struct ManagedAttendanceRow"),
    "attendance repo should not keep a second handwritten managed row struct"
  );
}

#[test]
fn attendance_consume_flow_should_delegate_validation_steps_to_helpers() {
  let source = fs::read_to_string(manifest_file("src/service/attendance_service/consume.rs"))
    .expect("read consume.rs");

  assert!(
    source.contains("fn ensure_normal_user_can_consume"),
    "consume flow should extract role validation into a dedicated helper"
  );
  assert!(
    source.contains("fn load_activity_or_throw"),
    "consume flow should extract activity loading into a dedicated helper"
  );
  assert!(
    source.contains("fn validate_code_slot"),
    "consume flow should extract dynamic-code validation into a dedicated helper"
  );
  assert!(
    source.contains("fn build_replay_guard_key"),
    "consume flow should extract replay-key assembly into a dedicated helper"
  );
  assert!(
    source.contains("fn build_record_id"),
    "consume flow should extract record-id assembly into a dedicated helper"
  );
}

#[test]
fn backend_source_files_should_stay_under_220_lines() {
  let mut files = Vec::new();
  collect_rs_files(&manifest_file("src"), &mut files);
  files.sort();

  let offenders = files
    .into_iter()
    .filter_map(|path| {
      let lines = fs::read_to_string(&path)
        .expect("read rust source")
        .lines()
        .count();
      (lines > 220).then(|| {
        format!(
          "{}:{lines}",
          path
            .strip_prefix(env!("CARGO_MANIFEST_DIR"))
            .expect("relative path")
            .display()
        )
      })
    })
    .collect::<Vec<_>>();

  assert!(
    offenders.is_empty(),
    "backend rust source files should stay small enough to maintain: {}",
    offenders.join(", ")
  );
}
