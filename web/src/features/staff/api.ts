import { requestJson } from "../../shared/http/client";
import type { ActivityActionType } from "../activities/api";

/**
 * staff 模块只声明“当前管理员页实际依赖的契约”，
 * 不提前把完整后端设计一次性搬进前端。
 */
export type CodeSessionResponse = {
  action_type: ActivityActionType;
  activity_id: string;
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
