import { ComponentProps, ReactNode } from "react";
import { Cell } from "tdesign-mobile-react";

/**
 * `ActivityMetaPanel` 继续直接吃 TDesign `Cell` 原生 props。
 *
 * 这里把可复用的“字段到行”的投影逻辑独立出来，目的不是再造 DSL，
 * 而是把“业务字段排序”与“面板渲染”拆开，避免主组件继续膨胀。
 */
export type ActivityMetaCellProps = Pick<ComponentProps<typeof Cell>, "align" | "description" | "note" | "title">;

/**
 * 统计口径仍然只保留页面真正会用到的三项。
 *
 * 后续如果产品再补“缺勤 / 已取消”等衍生指标，也应先在这里统一口径，
 * 不要让页面层各自拼一份累计逻辑。
 */
export type ActivityMetaCounts = {
  expected?: number;
  checkin?: number;
  checkout?: number;
};

type DetailRowInput = {
  checkinTimeText?: string;
  checkoutTimeText?: string;
  joinStatusText?: string;
  locationText?: string;
  timeText?: string;
};

type SummaryRowInput = {
  description?: string;
  progressText?: string;
  statusSlot?: ReactNode;
  subtitle?: string;
};

/**
 * 详情区的排序必须稳定，因为列表页、详情页和 staff 页都共享这套阅读顺序。
 *
 * 顺序约束如下：
 * 1. 先给活动的公共元信息；
 * 2. 再给“我与活动”的关系信息；
 * 3. 最后给动作结果产生的签到/签退时间。
 */
export function buildActivityMetaDetailRows({
  checkinTimeText,
  checkoutTimeText,
  joinStatusText,
  locationText,
  timeText
}: DetailRowInput) {
  const rows: ActivityMetaCellProps[] = [];

  if (timeText) {
    rows.push({
      note: timeText,
      title: "时间"
    });
  }
  if (locationText) {
    rows.push({
      note: locationText,
      title: "地点"
    });
  }
  if (joinStatusText) {
    rows.push({
      note: joinStatusText,
      title: "我的状态"
    });
  }
  if (checkinTimeText) {
    rows.push({
      note: checkinTimeText,
      title: "签到时间"
    });
  }
  if (checkoutTimeText) {
    rows.push({
      note: checkoutTimeText,
      title: "签退时间"
    });
  }

  return rows;
}

/**
 * 摘要区仍然优先复用组件库原生语义：
 * - 长说明走 `description`
 * - 状态与副标题走 `note`
 *
 * 这样页面不会再把所有字段都粗暴塞成同一种“右侧文本”。
 */
export function buildActivityMetaSummaryRows({
  description,
  progressText,
  statusSlot,
  subtitle
}: SummaryRowInput) {
  const rows: ActivityMetaCellProps[] = [];

  if (subtitle) {
    rows.push({
      note: subtitle,
      title: "类型"
    });
  }
  if (description) {
    rows.push({
      align: "top",
      description,
      title: "说明"
    });
  }
  if (statusSlot) {
    rows.push({
      note: statusSlot,
      title: "状态"
    });
  } else if (progressText) {
    rows.push({
      note: progressText,
      title: "状态"
    });
  }

  return rows;
}

/**
 * 统计区只保留当前产品已经稳定下来的口径换算。
 *
 * 这里明确把“累计签到”定义为 `checkin + checkout`，
 * 避免页面层以后再次把“仍在场人数”误当成累计签到人数。
 */
export function buildActivityMetaMetricRows(counts?: ActivityMetaCounts) {
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
          note: `${expectedCount}`,
          title: "应到"
        }
      : null,
    {
      note: `${totalCheckedIn}`,
      title: "累计签到"
    },
    {
      note: `${checkoutCount}`,
      title: "已签退"
    },
    {
      note: `${checkinCount}`,
      title: "未签退"
    }
  ].filter(Boolean) as ActivityMetaCellProps[];
}
