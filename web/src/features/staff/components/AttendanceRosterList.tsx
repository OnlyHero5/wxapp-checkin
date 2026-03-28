import { Cell, CellGroup, Checkbox, List, SwipeCell } from "tdesign-mobile-react";
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
                <CellGroup className="attendance-roster-list__group" theme="card" title={item.name}>
                  <Cell title="学号" note={item.student_id} />
                  <Cell
                    title="选择成员"
                    note={(
                      <Checkbox
                        block={false}
                        checked={checked}
                        label={`选择 ${item.name}`}
                        onChange={(value) => onToggleSelection(item.user_id, !!value)}
                      />
                    )}
                  />
                  <Cell title="签到状态" note={resolveCheckinText(item)} />
                  <Cell title="签退状态" note={resolveCheckoutText(item)} />
                  {item.checkin_time ? <Cell title="签到时间" note={item.checkin_time} /> : null}
                  {item.checkout_time ? <Cell title="签退时间" note={item.checkout_time} /> : null}
                </CellGroup>
              )}
            />
          </article>
        );
      })}
    </List>
  );
}
