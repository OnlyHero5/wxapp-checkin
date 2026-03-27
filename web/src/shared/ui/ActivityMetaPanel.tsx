import { ComponentProps, ElementType, ReactNode } from "react";
import { Cell, CellGroup } from "tdesign-mobile-react";
import type { VisualTone } from "./visual-tone";

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

type ActivityMetaCellProps = Pick<ComponentProps<typeof Cell>, "align" | "description" | "note" | "title">;

function resolveDetailRows({
  checkinTimeText,
  checkoutTimeText,
  joinStatusText,
  locationText,
  timeText
}: Pick<ActivityMetaPanelProps, "checkinTimeText" | "checkoutTimeText" | "joinStatusText" | "locationText" | "timeText">) {
  /**
   * 基础字段行继续统一在这里排序，避免列表、详情和 staff 页面各自发明一套顺序。
   *
   * 这里不再维护项目自有的“label/value 协议”，而是直接返回 TDesign `Cell` 原生 props：
   * 1. 组件库负责决定 `note` / `description` 的语义与结构；
   * 2. 业务层只保留字段有无与顺序编排；
   * 3. 避免公共层再次长成第二套面板 DSL。
   */
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

function resolveSummaryRows({
  description,
  progressText,
  statusSlot,
  subtitle
}: Pick<ActivityMetaPanelProps, "description" | "progressText" | "statusSlot" | "subtitle">) {
  /**
   * 标题摘要组继续只做字段编排，但直接投影成 TDesign `Cell` props：
   * - 标题本身交给 `CellGroup.title`
   * - 说明改回组件库原生 `description`
   * - 状态与副标题继续使用 `note`
   *
   * 这样可以避免公共层把组件库的原生表达能力再次压扁成同一种“右侧 note”。
   */
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

function resolveMetricRows(counts?: ActivityMetaPanelProps["counts"]) {
  /**
   * 统计口径同样直接使用 `Cell` 原生结构。
   * 这里保留的只是业务口径换算，不再额外挂一层中转组件。
   */
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
  const metricRows = resolveMetricRows(counts);
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
            {...row}
            key={`${title}:${row.title}`}
          />
        ))}
      </CellGroup>
      {detailRows.length > 0 ? (
        <CellGroup theme="card" title="活动信息">
          {detailRows.map((row) => (
            <Cell
              {...row}
              key={`detail:${title}:${row.title}`}
            />
          ))}
        </CellGroup>
      ) : null}
      {metricRows.length > 0 ? (
        <CellGroup theme="card" title="统计">
          {metricRows.map((row) => (
            <Cell
              {...row}
              key={`metric:${title}:${row.title}`}
            />
          ))}
        </CellGroup>
      ) : null}
      {footer ? <section className="activity-meta-actions">{footer}</section> : null}
    </Container>
  );
}
