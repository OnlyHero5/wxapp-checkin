import { useParams } from "react-router-dom";
import { buildActivityDetailPath } from "../../features/activities/api";
import {
  AttendanceBatchActionBar
} from "../../features/staff/components/AttendanceBatchActionBar";
import { AttendanceRosterList } from "../../features/staff/components/AttendanceRosterList";
import type { NormalizedRosterItem } from "../../features/staff/attendance-roster-state";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { AppLoadingState } from "../../shared/ui/AppLoadingState";
import { AppTextLink } from "../../shared/ui/AppTextLink";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { useActivityRosterPageState } from "./use-activity-roster-page-state";

/**
 * 参会名单页承接 staff 的“看成员 + 修签到签退状态”链路。
 *
 * <p>它故意不和动态码管理页混在一起：
 * - 发码是“给普通用户一个入口”
 * - 名单修正是“管理员直接改状态”
 * 两者都是高频操作，但认知负担完全不同。</p>
 */
export function ActivityRosterPage() {
  const { activityId = "" } = useParams();
  const {
    adjusting,
    errorMessage,
    handleToggleSelection,
    loading,
    resultMessage,
    roster,
    runAdjustment,
    selectedIds
  } = useActivityRosterPageState(activityId);

  return (
    <MobilePage
      description="查看当前活动的已报名成员，并在后续执行签到签退修正。"
      eyebrow="工作人员"
      headerActions={(
        <AppTextLink to={buildActivityDetailPath(activityId)}>返回活动详情</AppTextLink>
      )}
      tone="staff"
      title="参会名单"
    >
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      {resultMessage ? <InlineNotice message={resultMessage} theme="success" /> : null}
      {roster ? (
        <div className="activity-roster-workbench">
          <section className="activity-roster-workbench__summary">
            {/* 名单页的摘要仍然复用共享主卡，保证和活动详情、管理页同口径。 */}
            <ActivityMetaPanel
              counts={{
                expected: roster.registered_count,
                checkin: roster.checkin_count,
                checkout: roster.checkout_count
              }}
              description={roster.description}
              locationText={roster.location}
              subtitle={roster.activity_type}
              timeText={roster.start_time}
              tone="staff"
              title={roster.activity_title}
            />
          </section>
          <section className="activity-roster-workbench__batch">
            <AttendanceBatchActionBar
              disabled={adjusting}
              onConfirm={(action) => runAdjustment(selectedIds, action, "批量")}
              selectedCount={selectedIds.length}
            />
          </section>
          <section className="activity-roster-workbench__rail" data-panel-tone="staff">
            <header className="activity-roster-workbench__rail-header">
              <p className="activity-roster-workbench__rail-eyebrow">名单信息带</p>
              <p className="activity-roster-workbench__rail-description">
                左滑可做单人修正；勾选成员后可从上方批量修正条发起统一动作。
              </p>
            </header>
            <AttendanceRosterList
              items={roster.items as NormalizedRosterItem[]}
              onSingleAction={(userId, action) => runAdjustment([userId], action, "单人")}
              onToggleSelection={handleToggleSelection}
              selectedIds={selectedIds}
            />
          </section>
        </div>
      ) : null}
      {!roster && loading ? <AppLoadingState message="参会名单加载中..." /> : null}
    </MobilePage>
  );
}
