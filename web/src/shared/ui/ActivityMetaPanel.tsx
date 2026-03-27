import { ElementType, ReactNode } from "react";
import { Cell, CellGroup } from "tdesign-mobile-react";
import {
  type ActivityMetaCounts,
  buildActivityMetaDetailRows,
  buildActivityMetaMetricRows,
  buildActivityMetaSummaryRows
} from "./activity-meta-panel/row-builders";
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
  tone?: VisualTone;
  title: string;
};

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
   * 页面仍可通过 `as` 决定容器语义，
   * 而具体的“字段排序 / 统计换算”已经下沉到独立模块，避免这一层再次长回大文件。
   */
  const summaryRows = buildActivityMetaSummaryRows({
    description,
    progressText,
    statusSlot,
    subtitle
  });
  const metricRows = buildActivityMetaMetricRows(counts);
  const detailRows = buildActivityMetaDetailRows({
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
