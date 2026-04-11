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
fn attendance_adjustment_summary_log_should_use_its_own_action_type() {
  let source = read_source("src/service/staff_service/audit.rs");

  assert!(
    source.contains("AttendanceAdjustment => \"attendance-adjustment\""),
    "attendance adjustment summary log should use attendance-adjustment action_type"
  );
}
