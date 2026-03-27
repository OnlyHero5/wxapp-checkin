import { ElementType, ReactNode } from "react";
import { Cell, CellGroup } from "tdesign-mobile-react";
import type { VisualTone } from "./visual-tone";
import { ActivityMetaContentGroups, type ActivityMetaDetailRow } from "./ActivityMetaContentGroups";

/**
 * 活动信息块仍然保留公共组合层，但现在只负责“信息编排”，不再自带项目级卡面外壳。
 *
 * 这样做的目的有两点：
 * 1. 字段编排仍然集中维护；
 * 2. 标题、正文和统计尽量直接落到 TDesign `CellGroup/Cell`，避免这里继续长成第二套面板组件。
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
};

type ActivityMetaSummaryRow = {
  align?: "top";
  label: string;
  value: ReactNode;
};

function resolveDetailRows({
  checkinTimeText,
  checkoutTimeText,
  joinStatusText,
  locationText,
  timeText
}: Pick<ActivityMetaPanelProps, "checkinTimeText" | "checkoutTimeText" | "joinStatusText" | "locationText" | "timeText">) {
  /**
   * “活动信息”里的基础行继续统一在这里排序，
   * 避免列表、详情和 staff 页面各自发明一套字段顺序。
   *
   * 这里刻意只保留组件库已经很好承载的“标签 -> 值”行，
   * 不再额外拼项目自有标题区结构。
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

  return rows;
}

function resolveSummaryRows({
  description,
  progressText,
  statusSlot,
  subtitle
}: Pick<ActivityMetaPanelProps, "description" | "progressText" | "statusSlot" | "subtitle">) {
  /**
   * 标题组现在同样直接投影成 TDesign `Cell`：
   * - 标题本身交给 `CellGroup.title`
   * - 副标题、说明、状态位继续用组件库行结构表达
   * - 这样页面不再维护额外的 heading / footer / badge 自定义壳层。
   */
  const rows: ActivityMetaSummaryRow[] = [];

  if (subtitle) {
    rows.push({
      label: "类型",
      value: subtitle
    });
  }
  if (description) {
    rows.push({
      align: "top",
      label: "说明",
      value: description
    });
  }
  if (statusSlot) {
    rows.push({
      label: "状态",
      value: statusSlot
    });
  } else if (progressText) {
    rows.push({
      label: "状态",
      value: progressText
    });
  }

  return rows;
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
  title
}: ActivityMetaPanelProps) {
  /**
   * 组件现在只保留“数据整理 + 组件库组装”职责。
   *
   * 页面仍可通过 `as` 决定容器语义，但不再在这里维护独立的标题壳与文本样式系统。
   */
  const summaryRows = resolveSummaryRows({
    description,
    progressText,
    statusSlot,
    subtitle
  });
  const detailRows = resolveDetailRows({
    checkinTimeText,
    checkoutTimeText,
    joinStatusText,
    locationText,
    timeText
  });

  return (
    <Container data-panel-tone={tone}>
      <CellGroup theme="card" title={title}>
        {summaryRows.map((row) => (
          <Cell
            key={`${title}:${row.label}`}
            align={row.align}
            note={row.value}
            title={row.label}
          />
        ))}
      </CellGroup>
      <ActivityMetaContentGroups counts={counts} rows={detailRows} />
      {footer ? <section className="activity-meta-actions">{footer}</section> : null}
    </Container>
  );
}
