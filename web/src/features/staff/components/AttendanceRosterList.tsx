import { Checkbox, List, SwipeCell, Tag } from "tdesign-mobile-react";
import { AppEmptyState } from "../../../shared/ui/AppEmptyState";
import type { ActivityRosterItem } from "../api";
import type { AttendanceActionKey } from "./AttendanceBatchActionBar";

type AttendanceRosterListProps = {
  items: ActivityRosterItem[];
  onSingleAction: (userId: number, action: AttendanceActionKey) => Promise<void> | void;
  onToggleSelection: (userId: number, checked: boolean) => void;
  selectedIds: number[];
};

function resolveCheckinText(item: ActivityRosterItem) {
  return item.checked_in ? "已签到" : "未签到";
}

function resolveCheckoutText(item: ActivityRosterItem) {
  return item.checked_out ? "已签退" : "未签退";
}

function renderStatusTag(type: "checkin" | "checkout", active: boolean, text: string) {
  const tone = type === "checkin" ? "success" : "warning";
  return (
    <Tag
      className={`attendance-roster-card__status attendance-roster-card__status--${type}`}
      shape="round"
      theme={active ? tone : "default"}
      variant={active ? "light" : "light-outline"}
    >
      {text}
    </Tag>
  );
}

function resolveSwipeActions(
  item: ActivityRosterItem,
  onSingleAction: AttendanceRosterListProps["onSingleAction"]
) {
  return [
    !item.checked_in
      ? {
          className: "attendance-roster-list__action attendance-roster-list__action--checkin",
          onClick: () => void onSingleAction(item.user_id, "set_checked_in"),
          text: "设为已签到"
        }
      : {
          className: "attendance-roster-list__action attendance-roster-list__action--reset",
          onClick: () => void onSingleAction(item.user_id, "clear_checked_in"),
          text: "设为未签到"
        },
    !item.checked_out
      ? {
          className: "attendance-roster-list__action attendance-roster-list__action--checkout",
          onClick: () => void onSingleAction(item.user_id, "set_checked_out"),
          text: "设为已签退"
        }
      : {
          className: "attendance-roster-list__action attendance-roster-list__action--reset",
          onClick: () => void onSingleAction(item.user_id, "clear_checked_out"),
          text: "设为未签退"
        }
  ];
}

/**
 * 名单列表只负责渲染成员行和行内动作，
 * 不直接耦合页面级加载、提示或刷新策略。
 */
export function AttendanceRosterList({
  items,
  onSingleAction,
  onToggleSelection,
  selectedIds
}: AttendanceRosterListProps) {
  if (items.length === 0) {
    return <AppEmptyState message="当前活动暂无已报名成员。" />;
  }

  /**
   * 名单页的视觉层只挂在业务自有 class 上：
   * - `SwipeCell` 继续负责手势和动作展开；
   * - 业务 CSS 只认 `attendance-roster-list__*`；
   * - 后续组件库升级时，不需要再去追内部 DOM 细节。
   */
  return (
    <List className="attendance-roster-list">
      {items.map((item) => {
        const checked = selectedIds.includes(item.user_id);
        return (
          <article className="attendance-roster-list__item" key={item.user_id}>
            <SwipeCell
              right={resolveSwipeActions(item, onSingleAction)}
              content={(
                <section className="attendance-roster-card attendance-roster-list__group">
                  <header className="attendance-roster-card__header">
                    <div className="attendance-roster-card__identity">
                      <p className="attendance-roster-card__student-id">{item.student_id}</p>
                      <h2 className="attendance-roster-card__name">{item.name}</h2>
                    </div>
                    {/* 选择控件继续复用组件库 Checkbox，但把它收进卡片头部，避免名单信息区被拉得过长。 */}
                    <div className="attendance-roster-card__select">
                      <Checkbox
                        block={false}
                        checked={checked}
                        label={`选择 ${item.name}`}
                        onChange={(value) => onToggleSelection(item.user_id, !!value)}
                      />
                    </div>
                  </header>
                  <div className="attendance-roster-card__status-row">
                    {renderStatusTag("checkin", item.checked_in, resolveCheckinText(item))}
                    {renderStatusTag("checkout", item.checked_out, resolveCheckoutText(item))}
                  </div>
                  {item.checkin_time || item.checkout_time ? (
                    <dl className="attendance-roster-card__times">
                      {item.checkin_time ? (
                        <div className="attendance-roster-card__time-item">
                          <dt>签到时间</dt>
                          <dd>{item.checkin_time}</dd>
                        </div>
                      ) : null}
                      {item.checkout_time ? (
                        <div className="attendance-roster-card__time-item">
                          <dt>签退时间</dt>
                          <dd>{item.checkout_time}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </section>
              )}
            />
          </article>
        );
      })}
    </List>
  );
}
