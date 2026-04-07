import type { ActivityDetail, ActivitySummary } from "./api";
import { parseActivityTime, resolveProgressStatus } from "./activity-progress";

/**
 * `view-model.ts` 的职责是把“接口字段”翻译成“页面更容易消费的状态”。
 *
 * 这层存在的意义：
 * 1. 隔离后端字段在迁移期的不稳定性
 * 2. 把重复的状态判断从页面里抽出来
 * 3. 让列表、详情、签到页共用同一套业务口径
 *
 * 维护原则：
 * - 页面不要自己复制这里的判断逻辑
 * - 后端字段一旦变动，优先先改这里，再决定页面要不要跟着改
 * - 如果将来管理员页也需要活动状态归一化，也优先复用这里
 */
export type ActivitySection = {
  // `items` 是该分组下最终要渲染的活动卡片数组。
  items: ActivitySummary[];
  // `key` 用于 React 渲染和后续样式分组识别。
  key: "ongoing" | "completed";
  // `title` 是展示给用户看的中文分组标题。
  title: string;
};

export { parseActivityTime, resolveProgressStatus } from "./activity-progress";

/**
 * 普通用户在 UI 上真正关心的是“我和这个活动现在是什么关系”，
 * 因此把多个布尔字段压缩成一个中文标签。
 */
export function resolveJoinStatus(activity: Pick<ActivitySummary, "my_registered" | "my_checked_in" | "my_checked_out">) {
  if (activity.my_checked_out) {
    return "已签退";
  }
  if (activity.my_checked_in) {
    return "已签到";
  }
  if (activity.my_registered) {
    return "已报名";
  }
  return "未报名";
}

/**
 * 列表页的可见性再收口一次：
 * 即便后端阶段性返回了“当前用户不该看到的活动”，前端也不会直接渲染。
 */
type GroupVisibleActivitiesOptions = {
  allowAll?: boolean;
};

export function groupVisibleActivities(activities: ActivitySummary[], options: GroupVisibleActivitiesOptions = {}) {
  const visibleActivities = options.allowAll
    ? activities ?? []
    : (activities ?? []).filter((activity) => {
        // 这里的三元关系对应需求文档：已报名、已签到、已签退任一满足即可可见。
        return !!activity.my_registered || !!activity.my_checked_in || !!activity.my_checked_out;
      });

  // 时间倒序更符合“最近活动最值得先看”的移动端浏览习惯。
  const sorted = visibleActivities.slice().sort((left, right) => {
    return parseActivityTime(right.start_time) - parseActivityTime(left.start_time);
  });

  const ongoing = sorted.filter((activity) => resolveProgressStatus(activity) === "ongoing");
  const completed = sorted.filter((activity) => resolveProgressStatus(activity) === "completed");

  // 统一输出给列表页，页面层只负责渲染，不关心怎么分组。
  // 即便某个分组为空，也保留分组对象，这样页面结构和标题不会忽隐忽现。
  return [
    {
      items: ongoing,
      key: "ongoing" as const,
      title: "正在进行"
    },
    {
      items: completed,
      key: "completed" as const,
      title: "已完成"
    }
  ] satisfies ActivitySection[];
}

/**
 * 详情页优先使用后端显式返回的 `can_checkin`。
 * 如果后端还没实现，则前端用当前可见字段做兼容判断。
 */
export function resolveCanCheckin(detail: ActivityDetail) {
  if (typeof detail.can_checkin === "boolean") {
    // 一旦后端已经给出最终答案，前端不再擅自重算。
    return detail.can_checkin;
  }

  // 前端兜底规则要尽量保守，只在“明确可签到”时返回 true。
  return !!detail.support_checkin
    && !detail.my_checked_in
    && !detail.my_checked_out
    && resolveProgressStatus(detail) === "ongoing";
}

/**
 * 签退规则与签到不同：必须已经签到，且尚未签退。
 */
export function resolveCanCheckout(detail: ActivityDetail) {
  if (typeof detail.can_checkout === "boolean") {
    return detail.can_checkout;
  }

  // 签退兜底比签到更严格：必须已经签到且尚未签退。
  return !!detail.support_checkout
    && !!detail.my_checked_in
    && !detail.my_checked_out
    && resolveProgressStatus(detail) === "ongoing";
}

/**
 * 结果页只需要一个简单、可读的服务器时间展示。
 * 这里不追求秒级精度，重点是帮助用户确认“本次提交是在何时被服务端接受”。
 */
export function formatServerTime(serverTimeMs?: number) {
  if (!serverTimeMs) {
    return "";
  }

  // 当前格式优先服务“手机上快速确认”，不追求完整时间戳展示。
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(new Date(serverTimeMs));
}
