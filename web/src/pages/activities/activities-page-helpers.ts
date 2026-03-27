import type { ActivitySummary } from "../../features/activities/api";
import { groupVisibleActivities } from "../../features/activities/view-model";
import type { VisualTone } from "../../shared/ui/visual-tone";

export function resolveActivitiesErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "活动列表加载失败，请稍后重试。";
}

export function mergeActivitiesById(previous: ActivitySummary[], incoming: ActivitySummary[]) {
  // 追加分页数据时做一次去重，避免并发刷新或后端数据变化导致重复渲染同一活动卡片。
  const map = new Map<string, ActivitySummary>();
  for (const item of previous) {
    map.set(item.activity_id, item);
  }
  for (const item of incoming) {
    map.set(item.activity_id, item);
  }
  return Array.from(map.values());
}

export function normalizeSearchKeyword(value: string) {
  return `${value}`.trim();
}

export function resolveActivitiesPageCopy(isStaff: boolean): {
  description: string;
  eyebrow: string;
  pageTone: Extract<VisualTone, "brand" | "staff">;
} {
  return {
    description: isStaff
      ? "查看活动并进入管理页展示动态码、处理批量签退。"
      : "查看你当前可见的活动，并进入详情页继续签到或签退。",
    eyebrow: isStaff ? "工作人员" : "普通用户",
    pageTone: isStaff ? "staff" : "brand"
  };
}

export function buildVisibleSections(activities: ActivitySummary[], isStaff: boolean) {
  // 页面只消费分组结果，不在渲染层重复复制分组判断。
  return groupVisibleActivities(activities, {
    allowAll: isStaff
  }).map((section) => {
    if (!isStaff && section.key === "completed") {
      return {
        ...section,
        title: "历史活动"
      };
    }
    return section;
  });
}
