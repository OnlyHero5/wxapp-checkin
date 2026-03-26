import { ElementType, ReactNode } from "react";
import { Cell, CellGroup } from "tdesign-mobile-react";
import type { VisualTone } from "./visual-tone";

/**
 * 活动信息块在列表、详情、输入页重复度最高，因此单独抽成公共面板。
 *
 * 这层只负责：
 * 1. 统一标题、副标题和状态位布局
 * 2. 统一时间 / 地点 / 我的状态 / 统计这些字段的渲染顺序
 * 3. 让页面层只关心“传什么信息”，而不是再手写一组 `<p>`
 */
type ActivityMetaPanelProps = {
  as?: ElementType;
  checkinTimeText?: string;
  counts?: {
    expected?: number;
    checkin?: number;
    checkout?: number;
  };
  checkoutTimeText?: string;
  description?: string;
  footer?: ReactNode;
  joinStatusText?: string;
  locationText?: string;
  progressText?: string;
  statusSlot?: ReactNode;
  subtitle?: string;
  timeText?: string;
  tone?: VisualTone;
  title: string;
  titleAs?: "h3" | "p";
};

type ActivityDetailRow = {
  label: string;
  value: string;
};

function resolveRows({
  checkinTimeText,
  checkoutTimeText,
  description,
  joinStatusText,
  locationText,
  progressText,
  timeText
}: Omit<ActivityMetaPanelProps, "as" | "counts" | "footer" | "statusSlot" | "subtitle" | "title">): {
  description?: string;
  rows: ActivityDetailRow[];
} {
  /**
   * 这些字段统一在这里按固定顺序输出，而不是在页面里自由穿插。
   *
   * 原因是：
   * - 同一类信息如果顺序不一致，用户会觉得页面像不同产品拼出来的
   * - 后续补字段时，只需要改这一层，不需要同时扫 3 个页面
   */
  // 字段顺序固定下来以后，列表、详情和输入页就不会各自漂移。
  /**
   * 统计口径说明（非常重要，避免“签到人数为什么会变成 0”的误解）：
   * - 后端 `checkin_count` 当前是“已签到未签退”（即仍在场）人数；
   * - 后端 `checkout_count` 是“已签退”人数；
   * - 因此“累计已签到”= `checkin_count + checkout_count`。
   */
  // `expected` 用于管理端展示“应到人数”，它与签到/签退是不同维度的统计。
  const rows: ActivityDetailRow[] = [];

  if (timeText) {
    rows.push({
      label: "时间",
      value: timeText
    });
  }
  if (locationText) {
    rows.push({
      label: "地点",
      value: locationText
    });
  }
  if (progressText) {
    rows.push({
      label: "当前状态",
      value: progressText
    });
  }
  if (joinStatusText) {
    rows.push({
      label: "我的状态",
      value: joinStatusText
    });
  }
  if (checkinTimeText) {
    rows.push({
      label: "签到时间",
      value: checkinTimeText
    });
  }
  if (checkoutTimeText) {
    rows.push({
      label: "签退时间",
      value: checkoutTimeText
    });
  }

  return {
    description,
    rows
  };
}

function renderMetrics(counts?: ActivityMetaPanelProps["counts"]) {
  if (!counts) {
    return null;
  }

  const expectedCount = counts.expected;
  const checkinCount = counts.checkin ?? 0;
  const checkoutCount = counts.checkout ?? 0;
  const totalCheckedIn = checkinCount + checkoutCount;
  const metrics = [
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
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <CellGroup theme="card" title="统计">
      {metrics.map((metric) => (
        <Cell key={metric.label} title={metric.label} note={metric.value} />
      ))}
    </CellGroup>
  );
}

export function ActivityMetaPanel({
  as: Container = "section",
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
  tone = "default",
  title,
  titleAs = "h3"
}: ActivityMetaPanelProps) {
  /**
   * `titleAs` 用来控制语义层级，而不是视觉层级。
   *
   * 例如详情页已经有页面级 `h1`，这里就降成 `p`，
   * 避免出现“双主标题”的可访问性噪音。
   */
  const TitleTag = titleAs;
  const { description: descriptionText, rows } = resolveRows({
    checkinTimeText,
    checkoutTimeText,
    description,
    joinStatusText,
    locationText,
    progressText,
    timeText
  });

  return (
    <Container className="activity-meta-panel" data-panel-tone={tone}>
      <div className="activity-meta-panel__surface">
        <div className="activity-meta-panel__header">
          <div className="activity-meta-panel__title-block activity-meta-panel__title-stack">
            <TitleTag className="activity-meta-panel__title">{title}</TitleTag>
            {subtitle ? <p className="activity-meta-panel__subtitle">{subtitle}</p> : null}
          </div>
          {/* 状态位独立成 slot，是为了兼容列表卡片、详情页和未来管理员态的不同标签策略。 */}
          {statusSlot ? <div className="activity-meta-panel__status">{statusSlot}</div> : null}
        </div>
        {descriptionText ? <p className="activity-meta-panel__description">{descriptionText}</p> : null}
        {rows.length > 0 ? (
          <CellGroup theme="card" title="活动信息">
            {rows.map((row) => (
              <Cell key={row.label} title={row.label} note={row.value} align="top" />
            ))}
          </CellGroup>
        ) : null}
        {renderMetrics(counts)}
        {/* footer 常用于“查看详情”这类补充动作，避免动作和元信息混在同一组文本里。 */}
        {footer ? (
          <div className="activity-meta-panel__footer">
            <div className="activity-meta-panel__footer-actions">{footer}</div>
          </div>
        ) : null}
      </div>
    </Container>
  );
}
