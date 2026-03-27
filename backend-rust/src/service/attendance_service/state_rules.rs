use crate::db::attendance_repo::AttendanceRecord;
use crate::error::AppError;

/// 签到状态机继续只围绕两个 legacy 标志位工作：
/// - `check_in`
/// - `check_out`
/// 这里把状态流转集中起来，避免主流程和批量接口各自散落判断。
pub fn next_flags(
  attendance: &AttendanceRecord,
  action_type: &str,
) -> Result<(i64, i64), AppError> {
  match action_type.trim() {
    "checkin" => {
      if attendance.check_in_flag == 0 {
        return Ok((1, 0));
      }
      if attendance.check_in_flag == 1 && attendance.check_out_flag == 0 {
        return Err(AppError::business(
          "duplicate",
          "你已签到，请勿重复提交",
          None,
        ));
      }
      Err(AppError::business(
        "forbidden",
        "当前状态不允许再次签到",
        None,
      ))
    }
    "checkout" => {
      if attendance.check_in_flag == 0 {
        return Err(AppError::business("forbidden", "请先完成签到再签退", None));
      }
      if attendance.check_in_flag == 1 && attendance.check_out_flag == 0 {
        return Ok((1, 1));
      }
      Err(AppError::business(
        "duplicate",
        "你已签退，请勿重复提交",
        None,
      ))
    }
    _ => Err(AppError::business(
      "invalid_param",
      "action_type 仅支持 checkin/checkout",
      None,
    )),
  }
}

#[cfg(test)]
mod tests {
  use super::next_flags;
  use crate::db::attendance_repo::AttendanceRecord;

  #[test]
  fn checkin_should_move_none_to_checked_in() {
    let record = AttendanceRecord {
      id: 1,
      activity_id: 101,
      username: "2025000011".to_string(),
      state: 0,
      check_in_flag: 0,
      check_out_flag: 0,
    };

    let flags = next_flags(&record, "checkin").expect("flags");
    assert_eq!(flags, (1, 0));
  }

  #[test]
  fn checkout_should_reject_when_not_checked_in() {
    let record = AttendanceRecord {
      id: 1,
      activity_id: 101,
      username: "2025000011".to_string(),
      state: 0,
      check_in_flag: 0,
      check_out_flag: 0,
    };

    let error = next_flags(&record, "checkout").expect_err("should reject");
    assert_eq!(error.status(), "forbidden");
  }
}
