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
fn user_repo_should_not_write_last_login_time_column() {
  let source = fs::read_to_string(manifest_file("src/db/user_repo.rs"))
    .expect("read user_repo.rs");
  assert!(
    !source.contains("last_login_time"),
    "user_repo should only keep password write path for suda_user"
  );
}
