import { AppButton } from "../../../shared/ui/AppButton";
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
    return <p>当前活动暂无已报名成员。</p>;
  }

  return (
    <section className="roster-list">
      {items.map((item) => {
        const checked = selectedIds.includes(item.user_id);
        return (
          <article className="roster-item" key={item.user_id}>
            <div className="roster-item__header">
              <label className="roster-item__select">
                {/* 这里保留原生 checkbox，是为了让移动端点击范围和可访问性语义都更稳定。 */}
                <input
                  aria-label={`选择 ${item.name}`}
                  checked={checked}
                  onChange={(event) => onToggleSelection(item.user_id, event.target.checked)}
                  type="checkbox"
                />
                <span>选择</span>
              </label>
              <div className="roster-item__identity">
                <strong>{item.name}</strong>
                <span>{item.student_id}</span>
              </div>
            </div>
            <div className="roster-item__status">
              <span>签到：{resolveCheckinText(item)}</span>
              <span>签退：{resolveCheckoutText(item)}</span>
            </div>
            {item.checkin_time ? <p className="roster-item__time">签到时间：{item.checkin_time}</p> : null}
            {item.checkout_time ? <p className="roster-item__time">签退时间：{item.checkout_time}</p> : null}
            <div className="roster-item__actions">
              {!item.checked_in ? (
                <AppButton onClick={() => void onSingleAction(item.user_id, "set_checked_in")}>设为已签到</AppButton>
              ) : (
                <AppButton onClick={() => void onSingleAction(item.user_id, "clear_checked_in")} tone="secondary">
                  设为未签到
                </AppButton>
              )}
              {!item.checked_out ? (
                <AppButton onClick={() => void onSingleAction(item.user_id, "set_checked_out")} tone="secondary">
                  设为已签退
                </AppButton>
              ) : (
                <AppButton onClick={() => void onSingleAction(item.user_id, "clear_checked_out")} tone="secondary">
                  设为未签退
                </AppButton>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
