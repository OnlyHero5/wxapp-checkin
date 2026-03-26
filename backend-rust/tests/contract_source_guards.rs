use std::fs;
use std::path::PathBuf;

fn manifest_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path)
}

#[test]
fn auth_service_should_not_update_last_login_time() {
  let source = fs::read_to_string(manifest_file("src/service/auth_service.rs"))
    .expect("read auth_service.rs");
  assert!(
    !source.contains("update_last_login_time"),
    "login chain should not mutate suda_user.last_login_time anymore"
  );
}

#[test]
fn user_repo_should_not_touch_last_login_time_column() {
  let source = fs::read_to_string(manifest_file("src/db/user_repo.rs"))
    .expect("read user_repo.rs");
  assert!(
    !source.contains("last_login_time"),
    "current auth baseline should not mutate suda_user.last_login_time"
  );
}

#[test]
fn user_repo_should_not_keep_password_write_path_anymore() {
  let source = fs::read_to_string(manifest_file("src/db/user_repo.rs"))
    .expect("read user_repo.rs");
  assert!(
    !source.contains("pub async fn update_password"),
    "current auth baseline no longer exposes password write path"
  );
}

#[test]
fn auth_router_should_not_expose_change_password_route_anymore() {
  let source = fs::read_to_string(manifest_file("src/api/auth.rs"))
    .expect("read auth.rs");
  assert!(
    !source.contains("change-password"),
    "auth router should no longer expose /change-password"
  );
}

#[test]
fn auth_extractor_should_not_keep_password_change_gate() {
  let source = fs::read_to_string(manifest_file("src/api/auth_extractor.rs"))
    .expect("read auth_extractor.rs");
  assert!(
    !source.contains("password_change_required"),
    "auth extractor should not block requests on password-change state anymore"
  );
}
