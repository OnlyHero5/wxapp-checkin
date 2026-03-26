import { Cell, CellGroup, Checkbox } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";
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

  return (
    <section className="roster-list">
      {items.map((item) => {
        const checked = selectedIds.includes(item.user_id);
        return (
          <article className="roster-item" key={item.user_id}>
            <CellGroup theme="card" title={item.name}>
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
