use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::{
  ActivityRosterItem, ActivityRosterResponse, AttendanceAdjustmentResponse, BulkCheckoutResponse,
};
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::db::attendance_repo::{self, ManagedAttendanceRow};
use crate::db::log_repo;
use crate::domain::{format_activity_id, parse_activity_id};
use crate::error::AppError;
use crate::service::activity_service;
use serde_json::json;
use sqlx::Executor;
use std::time::{SystemTime, UNIX_EPOCH};

pub async fn get_roster(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
) -> Result<ActivityRosterResponse, AppError> {
  require_staff(current_user)?;
  let legacy_activity_id = parse_activity_id(activity_id)?;
  let activity = require_activity(state, legacy_activity_id).await?;
  let rows = attendance_repo::list_roster(state.pool(), legacy_activity_id).await?;

  let mut items = Vec::with_capacity(rows.len());
  for row in rows {
    let checked_in = row.check_in_flag == 1;
    let checked_out = row.check_out_flag == 1;
    let checkin_time = if checked_in || checked_out {
      log_repo::find_latest_action_time(state.pool(), &row.student_id, "checkin", legacy_activity_id)
        .await?
        .map(activity_service::format_display_time)
        .unwrap_or_default()
    } else {
      String::new()
    };
    let checkout_time = if checked_out {
      log_repo::find_latest_action_time(state.pool(), &row.student_id, "checkout", legacy_activity_id)
        .await?
        .map(activity_service::format_display_time)
        .unwrap_or_default()
    } else {
      String::new()
    };
    items.push(ActivityRosterItem {
      user_id: row.user_id,
      student_id: row.student_id,
      name: row.name,
      checked_in,
      checked_out,
      checkin_time,
      checkout_time,
    });
  }

  Ok(ActivityRosterResponse {
    status: "success".to_string(),
    message: "参会名单获取成功".to_string(),
    activity_id: format_activity_id(legacy_activity_id),
    activity_title: activity.activity_title,
    activity_type: crate::domain::activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: activity_service::format_display_time(activity.activity_stime),
    location: activity.location.unwrap_or_default(),
    description: activity.description.unwrap_or_default(),
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    items,
    server_time_ms: now_millis()?,
  })
}

pub async fn adjust_attendance(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  user_ids: &[i64],
  checked_in: Option<bool>,
  checked_out: Option<bool>,
  reason: &str,
) -> Result<AttendanceAdjustmentResponse, AppError> {
  require_staff(current_user)?;
  validate_patch(checked_in, checked_out)?;
  let legacy_activity_id = parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let normalized_user_ids = normalize_user_ids(user_ids)?;
  let batch_id = format!("adj_{}", now_millis()?);
  let server_time_ms = now_millis()?;

  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启名单修正事务失败：{error}")))?;
  let rows = attendance_repo::list_by_user_ids_for_update(&mut tx, legacy_activity_id, &normalized_user_ids).await?;
  if rows.len() != normalized_user_ids.len() {
    return Err(AppError::business("invalid_param", "目标成员不存在、未报名或不属于当前活动", None));
  }

  let mut affected_count = 0_i64;
  for row in rows {
    let (check_in, check_out) = resolve_patch(&row, checked_in, checked_out)?;
    if check_in == row.check_in_flag && check_out == row.check_out_flag {
      continue;
    }
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, check_in, check_out).await?;
    insert_staff_log(
      tx.as_mut(),
      current_user,
      &row,
      legacy_activity_id,
      "attendance-adjustment",
      &batch_id,
      server_time_ms,
      reason,
      check_in,
      check_out,
    )
    .await?;
    affected_count += 1;
  }

  tx.commit()
    .await
    .map_err(|error| AppError::internal(format!("提交名单修正事务失败：{error}")))?;

  Ok(AttendanceAdjustmentResponse {
    status: "success".to_string(),
    message: if affected_count > 0 {
      "名单状态修正完成".to_string()
    } else {
      "当前无需修正状态".to_string()
    },
    activity_id: format_activity_id(legacy_activity_id),
    affected_count,
    batch_id,
    server_time_ms,
  })
}

pub async fn bulk_checkout(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  confirm: bool,
  reason: &str,
) -> Result<BulkCheckoutResponse, AppError> {
  require_staff(current_user)?;
  if !confirm {
    return Err(AppError::business("invalid_param", "批量签退必须显式确认", None));
  }
  let legacy_activity_id = parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let batch_id = format!("batch_{}", now_millis()?);
  let server_time_ms = now_millis()?;

  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启批量签退事务失败：{error}")))?;
  let rows = attendance_repo::list_checked_in_for_update(&mut tx, legacy_activity_id).await?;
  let mut affected_count = 0_i64;

  for row in rows {
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, 1, 1).await?;
    insert_staff_log(
      tx.as_mut(),
      current_user,
      &row,
      legacy_activity_id,
      "bulk-checkout",
      &batch_id,
      server_time_ms,
      reason,
      1,
      1,
    )
    .await?;
    affected_count += 1;
  }

  insert_batch_summary_log(
    tx.as_mut(),
    current_user,
    legacy_activity_id,
    &batch_id,
    server_time_ms,
    reason,
    affected_count,
  )
  .await?;

  tx.commit()
    .await
    .map_err(|error| AppError::internal(format!("提交批量签退事务失败：{error}")))?;

  Ok(BulkCheckoutResponse {
    status: "success".to_string(),
    message: if affected_count > 0 {
      "批量签退完成".to_string()
    } else {
      "当前无需批量签退".to_string()
    },
    activity_id: format_activity_id(legacy_activity_id),
    affected_count,
    batch_id,
    server_time_ms,
  })
}

fn require_staff(current_user: &CurrentUser) -> Result<(), AppError> {
  if current_user.role == "staff" {
    Ok(())
  } else {
    Err(AppError::business("forbidden", "仅工作人员可查看或修正参会名单", None))
  }
}

async fn require_activity(
  state: &AppState,
  legacy_activity_id: i64,
) -> Result<activity_repo::ActivityRow, AppError> {
  activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(missing_activity_error)
}

fn missing_activity_error() -> AppError {
  AppError::business("invalid_activity", "活动不存在或已下线", Some("invalid_activity"))
}

fn normalize_user_ids(user_ids: &[i64]) -> Result<Vec<i64>, AppError> {
  if user_ids.is_empty() {
    return Err(AppError::business("invalid_param", "user_ids 不能为空", None));
  }
  let mut normalized = user_ids
    .iter()
    .copied()
    .filter(|user_id| *user_id > 0)
    .collect::<Vec<_>>();
  normalized.sort_unstable();
  normalized.dedup();
  Ok(normalized)
}

fn validate_patch(checked_in: Option<bool>, checked_out: Option<bool>) -> Result<(), AppError> {
  if checked_in.is_none() && checked_out.is_none() {
    return Err(AppError::business("invalid_param", "patch 至少要包含一个状态位", None));
  }
  Ok(())
}

fn resolve_patch(
  row: &ManagedAttendanceRow,
  checked_in: Option<bool>,
  checked_out: Option<bool>,
) -> Result<(i64, i64), AppError> {
  if checked_in == Some(false) {
    return Ok((0, 0));
  }
  if checked_out == Some(true) {
    return Ok((1, 1));
  }
  if checked_in == Some(true) {
    return Ok((1, 0));
  }
  if checked_out == Some(false) {
    if row.check_in_flag == 0 && row.check_out_flag == 0 {
      return Ok((0, 0));
    }
    return Ok((1, 0));
  }
  Err(AppError::business("invalid_param", "patch 组合非法", None))
}

async fn insert_staff_log<'e, E>(
  executor: E,
  current_user: &CurrentUser,
  row: &ManagedAttendanceRow,
  legacy_activity_id: i64,
  action_kind: &str,
  batch_id: &str,
  server_time_ms: u64,
  reason: &str,
  check_in: i64,
  check_out: i64,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let action_type = if check_in == 1 && check_out == 1 {
    "checkout"
  } else if check_in == 1 {
    "checkin"
  } else {
    "reset"
  };
  let path = if action_kind == "bulk-checkout" {
    "/api/web/staff/bulk-checkout"
  } else {
    "/api/web/staff/attendance-adjustment"
  };
  let content = json!({
    "activity_id": format_activity_id(legacy_activity_id),
    "legacy_activity_numeric_id": legacy_activity_id,
    "student_id": row.student_id,
    "user_id": row.user_id,
    "action_type": action_type,
    "server_time_ms": server_time_ms,
    "record_id": format!("{}_{}_{}", batch_id, row.user_id, server_time_ms),
    "operator_student_id": current_user.student_id,
    "reason": reason.trim(),
    "check_in": check_in,
    "check_out": check_out,
    "source": "wxapp-checkin-rust"
  });
  sqlx::query(
    r#"
      INSERT INTO suda_log(username, name, path, content, ip, address)
      VALUES (?, ?, ?, ?, ?, ?)
    "#,
  )
  .bind(&row.student_id)
  .bind(&row.name)
  .bind(path)
  .bind(content.to_string())
  .bind("")
  .bind("")
  .execute(executor)
  .await
  .map_err(|error| AppError::internal(format!("写入 staff 审计日志失败：{error}")))?;
  Ok(())
}

async fn insert_batch_summary_log<'e, E>(
  executor: E,
  current_user: &CurrentUser,
  legacy_activity_id: i64,
  batch_id: &str,
  server_time_ms: u64,
  reason: &str,
  affected_count: i64,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let content = json!({
    "activity_id": format_activity_id(legacy_activity_id),
    "legacy_activity_numeric_id": legacy_activity_id,
    "action_type": "bulk-checkout",
    "server_time_ms": server_time_ms,
    "record_id": batch_id,
    "operator_student_id": current_user.student_id,
    "reason": reason.trim(),
    "affected_count": affected_count,
    "source": "wxapp-checkin-rust"
  });
  sqlx::query(
    r#"
      INSERT INTO suda_log(username, name, path, content, ip, address)
      VALUES (?, ?, ?, ?, ?, ?)
    "#,
  )
  .bind(&current_user.student_id)
  .bind(&current_user.name)
  .bind("/api/web/staff/bulk-checkout")
  .bind(content.to_string())
  .bind("")
  .bind("")
  .execute(executor)
  .await
  .map_err(|error| AppError::internal(format!("写入批量签退汇总日志失败：{error}")))?;
  Ok(())
}

fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

#[cfg(test)]
mod tests {
  use super::{resolve_patch, validate_patch, missing_activity_error};
  use crate::db::attendance_repo::ManagedAttendanceRow;

  #[test]
  fn patch_should_clear_both_flags_when_checked_in_false() {
    let row = ManagedAttendanceRow {
      record_id: 1,
      user_id: 11,
      student_id: "2025000011".to_string(),
      name: "测试用户".to_string(),
      state: 0,
      check_in_flag: 1,
      check_out_flag: 1,
    };

    assert_eq!(resolve_patch(&row, Some(false), Some(false)).expect("patch"), (0, 0));
  }

  #[test]
  fn patch_should_require_at_least_one_flag() {
    assert!(validate_patch(None, None).is_err());
  }

  #[test]
  fn missing_activity_should_use_contract_error_code() {
    let error = missing_activity_error();
    assert_eq!(error.status(), "invalid_activity");
    assert_eq!(error.error_code(), Some("invalid_activity"));
  }
}
