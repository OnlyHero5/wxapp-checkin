import { ReactNode } from "react";

/**
 * 统计口径继续复用共享面板，不允许页面层各自再算一遍。
 *
 * 这里仍然只暴露当前产品真正稳定的三项：
 * 1. 应到人数；
 * 2. 累计签到人数；
 * 3. 已签退 / 未签退拆分。
 */
export type ActivityMetaCounts = {
  expected?: number;
  checkin?: number;
  checkout?: number;
};

/**
 * 新版单卡面板不再直接暴露 `Cell` props，
 * 而是先把字段投影成项目自有 section 数据。
 *
 * 这样后续页面可以稳定依赖：
 * - hero 只放标题摘要；
 * - detail 只放活动与个人信息；
 * - metrics 只放统计数字。
 */
export type ActivityMetaSectionRow = {
  label: string;
  value: ReactNode;
};

export type ActivityMetaPanelHero = {
  title: ReactNode;
  subtitle?: string;
  description?: string;
  statusContent?: ReactNode;
};

export type ActivityMetaPanelSection = {
  title: string;
  rows: ActivityMetaSectionRow[];
};

export type ActivityMetaPanelActionSection = {
  content?: ReactNode;
};

export type BuildActivityMetaSectionsInput = {
  checkinTimeText?: string;
  counts?: ActivityMetaCounts;
  checkoutTimeText?: string;
  description?: string;
  footer?: ReactNode;
  joinStatusText?: string;
  locationText?: string;
  progressText?: string;
  statusSlot?: ReactNode;
  subtitle?: string;
  timeText?: string;
  title: ReactNode;
};

/**
 * ReactNode 允许 `false / true`，但它们在共享 API 里通常代表“条件未命中”，
 * 不是“要渲染一个空 section”。
 *
 * 这里统一收口成可复用判断，避免组件层和 builder 层各自写一套真假分支。
 */
const isRenderableNode = (value: ReactNode | undefined): value is Exclude<ReactNode, boolean | null | undefined> =>
  value !== null && value !== undefined && typeof value !== "boolean";

/**
 * 详情区阅读顺序继续沿用老口径。
 *
 * 这部分是共享业务语义，不是视觉偏好：
 * 1. 先看活动公共信息；
 * 2. 再看“我与活动”的关系；
 * 3. 最后看签到/签退结果时间。
 */
const buildActivityMetaDetailRows = ({
  checkinTimeText,
  checkoutTimeText,
  joinStatusText,
  locationText,
  timeText
}: Omit<BuildActivityMetaSectionsInput, "counts" | "description" | "progressText" | "statusSlot" | "subtitle" | "title">) => {
  const rows: ActivityMetaSectionRow[] = [];

  if (timeText) {
    rows.push({ label: "时间", value: timeText });
  }
  if (locationText) {
    rows.push({ label: "地点", value: locationText });
  }
  if (joinStatusText) {
    rows.push({ label: "我的状态", value: joinStatusText });
  }
  if (checkinTimeText) {
    rows.push({ label: "签到时间", value: checkinTimeText });
  }
  if (checkoutTimeText) {
    rows.push({ label: "签退时间", value: checkoutTimeText });
  }

  return rows;
};

/**
 * 统计区最重要的规则仍是“累计签到 = 已签到且未签退 + 已签退”。
 *
 * 这条规则已经被 Task 1 / Task 2 的名单口径依赖，
 * 因此这里只允许换视觉结构，不允许偷偷改语义。
 */
const buildActivityMetaMetricRows = (counts?: ActivityMetaCounts) => {
  if (!counts) {
    return [];
  }

  const expectedCount = counts.expected;
  const checkinCount = counts.checkin ?? 0;
  const checkoutCount = counts.checkout ?? 0;
  const totalCheckedIn = checkinCount + checkoutCount;

  return [
    expectedCount != null
      ? {
          label: "应到",
          value: `${expectedCount}`
        }
      : null,
    {
      label: "累计签到",
      value: `${totalCheckedIn}`
    },
    {
      label: "已签退",
      value: `${checkoutCount}`
    },
    {
      label: "未签退",
      value: `${checkinCount}`
    }
  ].filter(Boolean) as ActivityMetaSectionRow[];
};

/**
 * 单卡面板的外层结构由这里一次性产出。
 *
 * 组件层只负责把 section 渲染出来，
 * 这样 Task 4 改各个业务页时，不需要再碰统计与字段顺序规则。
 */
export const buildActivityMetaSections = ({
  checkinTimeText,
  counts,
  checkoutTimeText,
  description,
  footer,
  joinStatusText,
  locationText,
  progressText,
  statusSlot,
  subtitle,
  timeText,
  title
}: BuildActivityMetaSectionsInput) => ({
  hero: {
    description,
    statusContent: isRenderableNode(statusSlot) ? statusSlot : progressText,
    subtitle,
    title
  } satisfies ActivityMetaPanelHero,
  detail: {
    rows: buildActivityMetaDetailRows({
      checkinTimeText,
      checkoutTimeText,
      joinStatusText,
      locationText,
      timeText
    }),
    title: "活动信息"
  } satisfies ActivityMetaPanelSection,
  metrics: {
    rows: buildActivityMetaMetricRows(counts),
    title: "统计"
  } satisfies ActivityMetaPanelSection,
  /**
   * 动作区也必须进入共享 section 模型。
   *
   * 这样主卡组件只负责渲染 section，不再额外维护一条“footer 特判”分支；
   * Task 4 接业务页时也能稳定依赖这条分区边界。
   */
  actions: {
    content: isRenderableNode(footer) ? footer : undefined
  } satisfies ActivityMetaPanelActionSection
});
