import { requestJson } from "../../shared/http/client";
import type { ActivityActionType } from "../activities/api";

/**
 * staff 模块只声明“当前管理员页面实际依赖的契约”，
 * 让动态码页和参会名单页共享同一层 API，而不是在页面里分散拼路径和请求体。
 */
export type CodeSessionResponse = {
  action_type: ActivityActionType;
  activity_id: string;
  registered_count?: number;
  checkin_count?: number;
  checkout_count?: number;
  code: string;
  expires_at: number;
  expires_in_ms: number;
  message?: string;
  server_time_ms?: number;
  status?: string;
};

export type BulkCheckoutInput = {
  confirm: boolean;
  reason: string;
};

export type BulkCheckoutResponse = {
  activity_id: string;
  affected_count: number;
  batch_id?: string;
  message?: string;
  server_time_ms?: number;
  status?: string;
};

/**
 * 名单页返回的成员项。
 *
 * 这里继续沿用后端“展示双状态、落库三态”的设计，
 * 页面层无需知道 `none / checked_in / checked_out` 的内部编码。
 */
export type ActivityRosterItem = {
  user_id: number;
  student_id: string;
  name: string;
  checked_in: boolean;
  checked_out: boolean;
  checkin_time?: string;
  checkout_time?: string;
};

export type ActivityRosterResponse = {
  activity_id: string;
  activity_title: string;
  activity_type?: string;
  start_time?: string;
  location?: string;
  description?: string;
  registered_count?: number;
  checkin_count?: number;
  checkout_count?: number;
  items: ActivityRosterItem[];
  message?: string;
  server_time_ms?: number;
  status?: string;
};

export type AttendanceAdjustmentInput = {
  user_ids: number[];
  patch: {
    checked_in?: boolean;
    checked_out?: boolean;
  };
  reason: string;
};

export type AttendanceAdjustmentResponse = {
  activity_id: string;
  affected_count: number;
  batch_id?: string;
  message?: string;
  server_time_ms?: number;
  status?: string;
};

function encodePathSegment(value: string) {
  return encodeURIComponent(`${value}`.trim());
}

/**
 * 动态码会话接口故意保持“一个动作一个请求”，
 * 这样前后台切换刷新和切 tab 刷新都能共用同一套入口。
 */
export function getCodeSession(activityId: string, actionType: ActivityActionType) {
  return requestJson<CodeSessionResponse>(
    `/activities/${encodePathSegment(activityId)}/code-session?action_type=${encodeURIComponent(actionType)}`
  );
}

export function bulkCheckout(activityId: string, input: BulkCheckoutInput) {
  return requestJson<BulkCheckoutResponse>(`/staff/activities/${encodePathSegment(activityId)}/bulk-checkout`, {
    body: input,
    method: "POST"
  });
}

/**
 * 名单页读取接口把“活动摘要 + 成员列表”一次返回，
 * 这样移动端首屏不会因为串行请求出现明显白屏。
 */
export function getActivityRoster(activityId: string) {
  return requestJson<ActivityRosterResponse>(`/staff/activities/${encodePathSegment(activityId)}/roster`);
}

/**
 * 单个修正和批量修正复用同一套写接口，
 * 页面只负责组织 user_ids 和 patch，不再区分两种不同后端入口。
 */
export function adjustAttendanceStates(activityId: string, input: AttendanceAdjustmentInput) {
  return requestJson<AttendanceAdjustmentResponse>(
    `/staff/activities/${encodePathSegment(activityId)}/attendance-adjustments`,
    {
      body: input,
      method: "POST"
    }
  );
}
