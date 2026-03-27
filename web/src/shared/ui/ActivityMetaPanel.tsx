import { ElementType, ReactNode } from "react";
import type { VisualTone } from "./visual-tone";
import { ActivityMetaContentGroups, type ActivityMetaDetailRow } from "./ActivityMetaContentGroups";

/**
 * 活动信息块仍然保留公共组合层，但现在只负责“信息编排”，不再自带项目级卡面外壳。
 *
 * 这样做的目的有两点：
 * 1. 标题、状态位和 footer 的组合仍然集中维护；
 * 2. 具体卡片形态完全交给 TDesign `CellGroup`，避免这里继续长成第二套面板组件。
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
  rows: ActivityMetaDetailRow[];
} {
  /**
   * 字段顺序仍然固定在这里，避免列表、详情和动作页各自漂移。
   *
   * 这层只输出“要展示哪些行”：
   * - 具体单元格布局交给 `ActivityMetaContentGroups`
   * - 标题区只保留少量页面真正缺失的结构胶水
   */
  const rows: ActivityMetaDetailRow[] = [];

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
   * `titleAs` 继续只承接语义层级，不承接视觉层级。
   *
   * 这样详情页可以安全降级标题标签，同时不用重新发明一套 heading 组件。
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
      <div className="activity-meta-panel__heading">
        <div className="activity-meta-panel__title-block">
          <TitleTag className="activity-meta-panel__title">{title}</TitleTag>
          {subtitle ? <p className="activity-meta-panel__subtitle">{subtitle}</p> : null}
          {descriptionText ? <p className="activity-meta-panel__description">{descriptionText}</p> : null}
        </div>
        {statusSlot ? <div className="activity-meta-panel__status">{statusSlot}</div> : null}
      </div>
      <ActivityMetaContentGroups counts={counts} rows={rows} />
      {footer ? <div className="activity-meta-panel__footer">{footer}</div> : null}
    </Container>
  );
}
