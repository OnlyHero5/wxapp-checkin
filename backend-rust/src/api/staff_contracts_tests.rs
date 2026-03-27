use crate::domain::AttendanceAdjustmentCommand;

use super::AttendanceAdjustmentPatch;
use super::AttendanceAdjustmentRequest;
use super::BulkCheckoutRequest;

// staff 合同测试集中锁三件事：
// 1. user_ids 要在入口去重并过滤非法值；
// 2. reason 要在入口 trim；
// 3. confirm / patch 非法组合不能再流进 service。
#[test]
fn attendance_adjustment_request_should_normalize_user_ids_and_reason_at_api_boundary() {
  let input = AttendanceAdjustmentRequest {
    user_ids: vec![11, 0, 11, 7],
    patch: AttendanceAdjustmentPatch {
      checked_in: Some(true),
      checked_out: None,
    },
    reason: "  补录签到  ".to_string(),
  }
  .into_input()
  .expect("input");

  assert_eq!(input.user_ids, vec![7, 11]);
  assert_eq!(input.reason, "补录签到");
  assert_eq!(input.patch, AttendanceAdjustmentCommand::SetCheckedIn);
}

// 如果过滤后没有有效用户，就应该直接在 API 边界拒绝，
// 避免 service 收到一个“看似成功、实际无目标”的空修正命令。
#[test]
fn attendance_adjustment_request_should_reject_empty_effective_user_ids() {
  let error = AttendanceAdjustmentRequest {
    user_ids: vec![0, -1],
    patch: AttendanceAdjustmentPatch {
      checked_in: Some(true),
      checked_out: None,
    },
    reason: "补录签到".to_string(),
  }
  .into_input()
  .expect_err("should reject empty ids");

  assert_eq!(error.status(), "invalid_param");
}

// 批量签退的“显式确认”属于请求边界约束，不应继续在 service 里兜底判断。
#[test]
fn bulk_checkout_request_should_require_explicit_confirmation_before_reaching_service() {
  let error = BulkCheckoutRequest {
    confirm: false,
    reason: "  活动结束统一签退  ".to_string(),
  }
  .into_input()
  .expect_err("should reject unconfirmed request");

  assert_eq!(error.status(), "invalid_param");
}
