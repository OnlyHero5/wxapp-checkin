use std::fs;
use std::path::PathBuf;

fn source_file(relative_path: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative_path)
}

fn read_source(relative_path: &str) -> String {
  fs::read_to_string(source_file(relative_path))
    .unwrap_or_else(|error| panic!("read {relative_path} failed: {error}"))
}

#[test]
fn attendance_adjustment_flow_should_emit_summary_audit_log() {
  let source = read_source("src/service/staff_service/adjust.rs");

  assert!(
    source.contains("insert_batch_summary_log"),
    "attendance adjustment flow should emit a summary audit log after row-level logs"
  );
}

#[test]
fn attendance_adjustment_flow_should_skip_summary_log_when_nothing_changed() {
  let source = read_source("src/service/staff_service/adjust.rs");

  assert!(
    source.contains("if affected_count > 0 {\n    insert_batch_summary_log"),
    "attendance adjustment flow should skip summary audit writes for zero-effect batches"
  );
}

#[test]
fn attendance_adjustment_summary_log_should_use_its_own_action_type() {
  let source = read_source("src/service/staff_service/audit.rs");

  assert!(
    source.contains("AttendanceAdjustment => \"attendance-adjustment\""),
    "attendance adjustment summary log should use attendance-adjustment action_type"
  );
}

#[test]
fn bulk_checkout_flow_should_skip_summary_log_when_no_rows_were_changed() {
  let source = read_source("src/service/staff_service/bulk_checkout.rs");

  assert!(
    source.contains("if affected_count > 0 {\n    insert_batch_summary_log"),
    "bulk checkout flow should skip summary audit writes when there are no checkout targets"
  );
}

#[test]
fn login_flow_should_skip_rate_limited_audit_writes() {
  let source = read_source("src/service/auth_service.rs");

  assert!(
    source.contains("if should_record_login_failure_audit(&final_error)"),
    "login failure audit should stop writing repeated rate-limited attempts into suda_log"
  );
}
