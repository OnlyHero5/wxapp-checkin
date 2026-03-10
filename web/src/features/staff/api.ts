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

export type UnbindReviewStatus = "pending" | "approved" | "rejected";

export type UnbindReviewItem = {
  reason?: string;
  requested_new_binding_hint?: string;
  review_comment?: string;
  review_id: string;
  reviewer_name?: string;
  status: UnbindReviewStatus;
  student_id?: string;
  submitted_at?: number;
  user_name?: string;
};

export type UnbindReviewListResponse = {
  items: UnbindReviewItem[];
  message?: string;
  status?: string;
};

export type UnbindReviewActionInput = {
  review_comment: string;
};

export type UnbindReviewActionResponse = {
  message?: string;
  review_id: string;
  status?: string;
};

export type CreateUnbindReviewInput = {
  reason: string;
  requested_new_binding_hint?: string;
};

export type CreateUnbindReviewResponse = {
  message?: string;
  review_id: string;
  review_status?: string;
  status?: string;
  submitted_at?: number;
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
 * 普通用户发起解绑申请时只提交最小必要信息：
 * - 为什么要解绑
 * - 如果有的话，新设备提示是什么
 *
 * 审核动作和 staff 列表仍放在同一模块，是因为它们共享同一组后端契约，
 * 当前阶段继续拆出 account 模块反而会把接口定义分散。
 */
export function createUnbindReview(input: CreateUnbindReviewInput) {
  return requestJson<CreateUnbindReviewResponse>("/unbind-reviews", {
    body: input,
    method: "POST"
  });
}

export function getUnbindReviews(input: { status: UnbindReviewStatus }) {
  const search = new URLSearchParams({
    status: input.status
  });
  return requestJson<UnbindReviewListResponse>(`/staff/unbind-reviews?${search.toString()}`);
}

export function approveUnbindReview(reviewId: string, input: UnbindReviewActionInput) {
  return requestJson<UnbindReviewActionResponse>(`/staff/unbind-reviews/${encodePathSegment(reviewId)}/approve`, {
    body: input,
    method: "POST"
  });
}

export function rejectUnbindReview(reviewId: string, input: UnbindReviewActionInput) {
  return requestJson<UnbindReviewActionResponse>(`/staff/unbind-reviews/${encodePathSegment(reviewId)}/reject`, {
    body: input,
    method: "POST"
  });
}
