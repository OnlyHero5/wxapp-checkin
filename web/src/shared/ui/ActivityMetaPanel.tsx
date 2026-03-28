import { ElementType, ReactNode } from "react";
import {
  type ActivityMetaCounts,
  buildActivityMetaSections
} from "./activity-meta-panel/row-builders";
import type { VisualTone } from "./visual-tone";

/**
 * 活动主卡现在回收到项目自有单卡骨架。
 *
 * 这一层负责两件事：
 * 1. 复用共享 section 数据，避免页面散落字段顺序；
 * 2. 把摘要、详情、统计和动作稳定收口到一张外卡内。
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
  title: ReactNode;
  titleAs?: ElementType;
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
  title,
  titleAs: TitleTag = "p"
}: ActivityMetaPanelProps) {
  /**
   * 共享主卡只消费结构化 section 数据，
   * 不再感知“哪几组 `CellGroup` 应该出现”。
   *
   * 这样 Task 4 接业务页时，只需要继续传业务文案，
   * 不需要重复维护分组数量和顺序。
   */
  const { actions, detail, hero, metrics } = buildActivityMetaSections({
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
  });
  const hasDetailSection = detail.rows.length > 0;
  const hasMetricsSection = metrics.rows.length > 0;
  const hasActionSection = actions.content != null;
  const isPlainStatusText = typeof hero.statusContent === "string" || typeof hero.statusContent === "number";

  return (
    <Container className={`activity-meta-panel activity-meta-panel--${tone}`} data-panel-tone={tone}>
      {/* hero 只保留标题摘要，避免把详情字段重新塞回头部造成主次混乱。 */}
      <header className="activity-meta-panel__section activity-meta-panel__section--hero">
        <div className="activity-meta-panel__hero-copy">
          {hero.subtitle ? <p className="activity-meta-panel__subtitle">{hero.subtitle}</p> : null}
          <div className="activity-meta-panel__title-row">
            {/* 默认继续输出纯视觉标题；只有调用方显式选择时才提升为 heading 语义。 */}
            <TitleTag className="activity-meta-panel__title">{hero.title}</TitleTag>
            {hero.statusContent ? (
              <div className="activity-meta-panel__status-slot">
                {isPlainStatusText ? (
                  <span className="activity-meta-panel__status-pill">{hero.statusContent}</span>
                ) : (
                  hero.statusContent
                )}
              </div>
            ) : null}
          </div>
          {hero.description ? <p className="activity-meta-panel__description">{hero.description}</p> : null}
        </div>
      </header>

      {hasDetailSection ? (
        <section className="activity-meta-panel__section activity-meta-panel__section--detail">
          {/* 详情区继续沿用共享字段顺序，让列表、详情和 staff 阅读路径一致。 */}
          <p className="activity-meta-panel__section-label">{detail.title}</p>
          <div className="activity-meta-panel__detail-list">
            {detail.rows.map((row, index) => (
              <div className="activity-meta-panel__detail-row" key={`${detail.title}:${row.label}:${index}`}>
                <span className="activity-meta-panel__detail-label">{row.label}</span>
                <span className="activity-meta-panel__detail-value">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasMetricsSection ? (
        <section className="activity-meta-panel__section activity-meta-panel__section--metrics">
          {/* 统计区只展示共享口径，避免业务页自己拼累计签到等衍生数字。 */}
          <p className="activity-meta-panel__section-label">{metrics.title}</p>
          <div className="activity-meta-panel__metric-grid">
            {metrics.rows.map((row, index) => (
              <section className="activity-meta-panel__metric-card" key={`${metrics.title}:${row.label}:${index}`}>
                <p className="activity-meta-panel__metric-label">{row.label}</p>
                <p className="activity-meta-panel__metric-value">{row.value}</p>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      {/* 动作区改为消费共享 section 数据，这样主卡本身只剩“渲染模型”职责。 */}
      {hasActionSection ? <footer className="activity-meta-panel__section activity-meta-panel__section--actions activity-meta-actions">{actions.content}</footer> : null}
    </Container>
  );
}
