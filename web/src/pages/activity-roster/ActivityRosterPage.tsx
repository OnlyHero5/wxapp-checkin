import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { buildActivityDetailPath } from "../../features/activities/api";
import {
  adjustAttendanceStates,
  getActivityRoster,
  type ActivityRosterResponse
} from "../../features/staff/api";
import {
  AttendanceBatchActionBar,
  type AttendanceActionKey
} from "../../features/staff/components/AttendanceBatchActionBar";
import { AttendanceRosterList } from "../../features/staff/components/AttendanceRosterList";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { AppTextLink } from "../../shared/ui/AppTextLink";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";

type AttendanceActionPayload = {
  patch: {
    checked_in: boolean;
    checked_out: boolean;
  };
  reason: string;
};

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "参会名单加载失败，请稍后重试。";
}

function resolveActionPayload(action: AttendanceActionKey): AttendanceActionPayload {
  // 这里把“按钮语义 -> patch + 默认 reason”钉死，
  // 页面和列表组件都只传动作枚举，不再在多个组件里复制布尔组合。
  switch (action) {
    case "set_checked_in":
      return {
        patch: {
          checked_in: true,
          checked_out: false
        },
        reason: "设为已签到"
      };
    case "clear_checked_in":
      return {
        patch: {
          checked_in: false,
          checked_out: false
        },
        reason: "设为未签到"
      };
    case "set_checked_out":
      return {
        patch: {
          checked_in: true,
          checked_out: true
        },
        reason: "设为已签退"
      };
    case "clear_checked_out":
      return {
        patch: {
          checked_in: true,
          checked_out: false
        },
        reason: "设为未签退"
      };
  }
}

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
  const navigate = useNavigate();
  const [roster, setRoster] = useState<ActivityRosterResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const requestVersionRef = useRef(0);

  const loadRoster = useCallback(async (resetBeforeLoad: boolean) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!activityId) {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
        setRoster(null);
        setErrorMessage("活动不存在");
      }
      return;
    }

    setLoading(true);
    setErrorMessage("");
    if (resetBeforeLoad) {
      setRoster(null);
    }

    try {
      const result = await getActivityRoster(activityId);
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setRoster(result);
      // 每次刷新后只保留仍然存在于列表里的勾选项，避免并发修正后保留脏选择。
      setSelectedIds((current) => current.filter((userId) => result.items.some((item) => item.user_id === userId)));
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      if (requestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [activityId, navigate]);

  useEffect(() => {
    void loadRoster(true);

    return subscribePageVisible(() => {
      void loadRoster(false);
    });
  }, [loadRoster]);

  async function runAdjustment(userIds: number[], action: AttendanceActionKey, reasonPrefix: "单人" | "批量") {
    if (!activityId || userIds.length === 0) {
      return;
    }

    const payload = resolveActionPayload(action);
    setAdjusting(true);
    setErrorMessage("");
    setResultMessage("");

    try {
      const response = await adjustAttendanceStates(activityId, {
        patch: payload.patch,
        reason: `${reasonPrefix}${payload.reason}`,
        user_ids: userIds
      });
      setResultMessage(response.message ?? "名单修正完成");
      setSelectedIds([]);
      await loadRoster(false);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setAdjusting(false);
    }
  }

  function handleToggleSelection(userId: number, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((value) => value !== userId);
    });
  }

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
        <>
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
            titleAs="p"
          />
          <div data-panel-tone="staff">
            <AttendanceBatchActionBar
              disabled={adjusting}
              onConfirm={(action) => runAdjustment(selectedIds, action, "批量")}
              selectedCount={selectedIds.length}
            />
          </div>
          <AttendanceRosterList
            items={roster.items}
            onSingleAction={(userId, action) => runAdjustment([userId], action, "单人")}
            onToggleSelection={handleToggleSelection}
            selectedIds={selectedIds}
          />
        </>
      ) : null}
      {!roster && loading ? <p>参会名单加载中...</p> : null}
    </MobilePage>
  );
}
