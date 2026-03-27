import type { AttendanceActionKey } from "./components/AttendanceBatchActionBar";

export type AttendanceActionPayload = {
  patch: {
    checked_in: boolean;
    checked_out: boolean;
  };
  reason: string;
};

/**
 * 名单修正页只传动作枚举，不在页面里反复拼 checked_in / checked_out 的布尔组合。
 */
export function resolveAttendanceActionPayload(action: AttendanceActionKey): AttendanceActionPayload {
  switch (action) {
    case "set_checked_in":
      return {
        patch: {
          checked_in: true,
          checked_out: false
        },
        reason: "设为已签到"
      };
    case "clear_checked_in":
      return {
        patch: {
          checked_in: false,
          checked_out: false
        },
        reason: "设为未签到"
      };
    case "set_checked_out":
      return {
        patch: {
          checked_in: true,
          checked_out: true
        },
        reason: "设为已签退"
      };
    case "clear_checked_out":
      return {
        patch: {
          checked_in: true,
          checked_out: false
        },
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
