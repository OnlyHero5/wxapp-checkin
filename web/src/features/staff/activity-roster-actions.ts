import type { AttendanceAdjustmentInput } from "./api";
import type { AttendanceActionKey } from "./components/AttendanceBatchActionBar";
import { buildAttendanceAdjustmentPatch } from "./attendance-roster-state";

export type AttendanceActionPayload = {
  patch: AttendanceAdjustmentInput["patch"];
  reason: string;
};

/**
 * 名单修正页只传动作枚举，不在页面里反复拼 patch。
 * patch 的具体字段选择收口到共享 helper，保证单个入口遵守后端“命令式 patch”约束。
 */
export function resolveAttendanceActionPayload(action: AttendanceActionKey): AttendanceActionPayload {
  switch (action) {
    case "set_checked_in":
      return {
        patch: buildAttendanceAdjustmentPatch(action),
        reason: "设为已签到"
      };
    case "clear_checked_in":
      return {
        patch: buildAttendanceAdjustmentPatch(action),
        reason: "设为未签到"
      };
    case "set_checked_out":
      return {
        patch: buildAttendanceAdjustmentPatch(action),
        reason: "设为已签退"
      };
    case "clear_checked_out":
      return {
        patch: buildAttendanceAdjustmentPatch(action),
        reason: "设为未签退"
      };
  }
}

/**
 * 勾选成员属于纯选择状态，不需要耦合页面组件的其它业务上下文。
 */
export function toggleSelectedRosterMember(current: number[], userId: number, checked: boolean) {
  if (checked) {
    return current.includes(userId) ? current : [...current, userId];
  }

  return current.filter((value) => value !== userId);
}
