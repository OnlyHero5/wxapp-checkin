import {
  adjustAttendanceStates as defaultAdjustAttendanceStates,
  getActivityRoster as defaultGetActivityRoster,
  type ActivityRosterResponse
} from "./api";
import { collectAnomalousRosterUserIds } from "./attendance-roster-state";

export type EnsureRosterConsistencyResult = {
  didHeal: boolean;
  roster: ActivityRosterResponse;
};

type EnsureRosterConsistencyInput = {
  activityId: string;
  adjustAttendanceStates?: typeof defaultAdjustAttendanceStates;
  getActivityRoster?: typeof defaultGetActivityRoster;
};

function buildAnomalousRosterMessage(roster: ActivityRosterResponse) {
  const anomalousMembers = roster.items
    .filter((item) => item.checked_out && !item.checked_in)
    .map((item) => `${item.student_id} ${item.name}`);
  if (anomalousMembers.length === 0) {
    return "自动修复异常签退状态失败，请稍后重试。";
  }
  return `自动修复异常签退状态失败：${anomalousMembers.join("、")} 仍处于未签到已签退异常状态，请先修正后再继续。`;
}

/**
 * 管理页和名单页都依赖同一份 roster 自愈口径，
 * 这样异常签退状态只在一个地方判定、修复和回读，避免两个页面各自漂移。
 */
export async function ensureRosterConsistency({
  activityId,
  adjustAttendanceStates = defaultAdjustAttendanceStates,
  getActivityRoster = defaultGetActivityRoster
}: EnsureRosterConsistencyInput): Promise<EnsureRosterConsistencyResult> {
  const roster = await getActivityRoster(activityId);
  const anomalousUserIds = collectAnomalousRosterUserIds(roster.items);

  // 没有异常成员时直接复用首次读取结果，避免多打一轮 roster 请求。
  if (anomalousUserIds.length === 0) {
    return {
      didHeal: false,
      roster
    };
  }

  /**
   * 后端 patch 契约已经收口为单字段命令，
   * 自愈链路固定发送“设为已签退”，让后端补齐合法状态。
   */
  await adjustAttendanceStates(activityId, {
    user_ids: anomalousUserIds,
    patch: { checked_out: true },
    reason: "自动修复异常签退状态"
  });

  // 自愈完成后必须回读名单，把页面后续操作建立在最新服务器状态之上。
  const healedRoster = await getActivityRoster(activityId);
  const remainingAnomalousUserIds = collectAnomalousRosterUserIds(healedRoster.items);
  if (remainingAnomalousUserIds.length > 0) {
    throw new Error(buildAnomalousRosterMessage(healedRoster));
  }

  return {
    didHeal: true,
    roster: healedRoster
  };
}
