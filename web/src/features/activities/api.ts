import { requestJson } from "../../shared/http/client";

/**
 * 活动模块的 API 封装只表达“前端现在依赖哪些契约字段”，
 * 不强求与后端 DTO 100% 一致。
 *
 * 这样做的好处是：
 * 1. 页面层拿到的类型更加贴近 UI 需要
 * 2. 后端字段若阶段性缺失，可以在 view-model 层做兜底
 * 3. 后续若接口收敛，可以在这一层集中调整
 */
export type ActivityActionType = "checkin" | "checkout";

export type ActivitySummary = {
  activity_id: string;
  activity_title: string;
  activity_type?: string;
  registered_count?: number;
  checkin_count?: number;
  checkout_count?: number;
  description?: string;
  location?: string;
  my_checked_in?: boolean;
  my_checked_out?: boolean;
  my_registered?: boolean;
  progress_status?: string;
  start_time?: string;
  support_checkin?: boolean;
  support_checkout?: boolean;
};

/**
 * 详情页在列表字段之外，额外关心“当前是否允许签到/签退”。
 */
export type ActivityDetail = ActivitySummary & {
  can_checkin?: boolean;
  can_checkout?: boolean;
  my_checkin_time?: string;
  my_checkout_time?: string;
  server_time_ms?: number;
};

/**
 * 列表接口响应。
 */
export type ActivityListResponse = {
  activities: ActivitySummary[];
  has_more?: boolean;
  message?: string;
  page?: number;
  page_size?: number;
  server_time_ms?: number;
  status?: string;
};

/**
 * 详情接口响应。
 */
export type ActivityDetailResponse = ActivityDetail & {
  message?: string;
  status?: string;
};

/**
 * 动态码提交请求体。
 */
export type CodeConsumeInput = {
  action_type: ActivityActionType;
  code: string;
};

/**
 * 动态码提交成功后的结果结构。
 */
export type CodeConsumeResponse = {
  action_type: ActivityActionType;
  activity_id: string;
  activity_title: string;
  message?: string;
  record_id?: string;
  server_time_ms?: number;
  status?: string;
};

function encodePathSegment(value: string) {
  // `activity_id` 最终会进 URL path，必须统一做 encode，避免特殊字符破坏路由。
  return encodeURIComponent(`${value}`.trim());
}

export function buildActivityDetailPath(activityId: string) {
  // UI 路由和 API path 必须共用同一套编码规则，避免“接口能查到、页面却跳错路由”。
  return `/activities/${encodePathSegment(activityId)}`;
}

export function buildActivityActionPath(activityId: string, actionType: ActivityActionType) {
  // 动作页路径统一在这一层拼接，页面不再自己手写字符串模板。
  return `${buildActivityDetailPath(activityId)}/${actionType}`;
}

export function buildActivityManagePath(activityId: string) {
  // 管理员页走单独 staff 路径，避免与普通用户动作页混在一起。
  return `/staff${buildActivityDetailPath(activityId)}/manage`;
}

// 拉取当前用户可见活动列表。
export function getActivities(input?: { page?: number; page_size?: number }) {
  const search = new URLSearchParams();
  if (input?.page) {
    search.set("page", `${input.page}`);
  }
  if (input?.page_size) {
    search.set("page_size", `${input.page_size}`);
  }
  const suffix = search.toString();
  return requestJson<ActivityListResponse>(`/activities${suffix ? `?${suffix}` : ""}`);
}

// 拉取单个活动详情。
export function getActivityDetail(activityId: string) {
  return requestJson<ActivityDetailResponse>(buildActivityDetailPath(activityId));
}

// 提交签到/签退动态码。
export function consumeActivityCode(activityId: string, input: CodeConsumeInput) {
  return requestJson<CodeConsumeResponse>(`${buildActivityDetailPath(activityId)}/code-consume`, {
    body: input,
    method: "POST"
  });
}
