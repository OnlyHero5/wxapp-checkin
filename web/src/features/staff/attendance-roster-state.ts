import type { AttendanceAdjustmentInput, ActivityRosterItem } from "./api";

export type NormalizedRosterState = "not_checked" | "checked_in" | "checked_out";
export type AttendanceAdjustmentAction =
  | "set_checked_in"
  | "clear_checked_in"
  | "set_checked_out"
  | "clear_checked_out";

export type NormalizedRosterItem = ActivityRosterItem & {
  is_data_anomalous: boolean;
  normalized_state: NormalizedRosterState;
};

/**
 * UI 侧统一使用规范态，避免后端偶发脏数据把页面推入“已签退但未签到”的非法组合。
 * 这里故意只做只读归一化，不直接改原始 item，便于后续自愈流程单独复用异常标记。
 */
export function normalizeRosterItem(item: ActivityRosterItem): NormalizedRosterItem {
  const isDataAnomalous = item.checked_out && !item.checked_in;

  /**
   * 业务不允许“已签退但未签到”，
   * 所以只要 checked_out 为真，前端展示态就必须把 checked_in 视为真。
   */
  const checkedIn = item.checked_in || item.checked_out;
  const checkedOut = item.checked_out;

  return {
    ...item,
    checked_in: checkedIn,
    checked_out: checkedOut,
    is_data_anomalous: isDataAnomalous,
    normalized_state: checkedOut ? "checked_out" : checkedIn ? "checked_in" : "not_checked"
  };
}

/**
 * 自愈逻辑只需要异常成员 id 列表，
 * 这里保持纯函数，避免把请求、副作用或 reason 文案耦合进状态层。
 */
export function collectAnomalousRosterUserIds(items: ActivityRosterItem[]) {
  return items.filter((item) => item.checked_out && !item.checked_in).map((item) => item.user_id);
}

/**
 * 后端名单修正接口现在按“单字段命令”理解 patch，
 * 因此前端不能再传双字段组合，避免误触接口校验或覆盖额外状态。
 */
export function buildAttendanceAdjustmentPatch(
  action: AttendanceAdjustmentAction
): AttendanceAdjustmentInput["patch"] {
  switch (action) {
    case "set_checked_in":
      return { checked_in: true };
    case "clear_checked_in":
      return { checked_in: false };
    case "set_checked_out":
      return { checked_out: true };
    case "clear_checked_out":
      return { checked_out: false };
  }
}
