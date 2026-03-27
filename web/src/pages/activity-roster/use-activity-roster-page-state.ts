import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adjustAttendanceStates,
  getActivityRoster,
  type ActivityRosterResponse
} from "../../features/staff/api";
import {
  resolveAttendanceActionPayload,
  toggleSelectedRosterMember
} from "../../features/staff/activity-roster-actions";
import type { AttendanceActionKey } from "../../features/staff/components/AttendanceBatchActionBar";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { createRequestGuard } from "../../shared/page-state/request-guard";

/**
 * 参会名单页的状态较重，但这些状态都属于“名单修正工作流”，
 * 不应该继续堆在页面 JSX 文件里。
 *
 * 这里统一维护：
 * - 名单拉取与刷新
 * - 勾选状态与批量/单人修正
 * - 页面级错误与结果提示
 */
export function useActivityRosterPageState(activityId: string) {
  const navigate = useNavigate();
  const [roster, setRoster] = useState<ActivityRosterResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const requestGuardRef = useRef(createRequestGuard());

  const loadRoster = useCallback(async (resetBeforeLoad: boolean) => {
    const requestVersion = requestGuardRef.current.beginRequest();

    if (!activityId) {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
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
      if (!requestGuardRef.current.isCurrent(requestVersion)) {
        return;
      }

      setRoster(result);
      // 刷新后只保留仍然存在于名单中的勾选项，避免页面留着脏选择。
      setSelectedIds((current) => current.filter((userId) => result.items.some((item) => item.user_id === userId)));
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }

      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setErrorMessage(resolvePageErrorMessage(error, "参会名单加载失败，请稍后重试。"));
      }
    } finally {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
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

  const runAdjustment = useCallback(async (
    userIds: number[],
    action: AttendanceActionKey,
    reasonPrefix: "单人" | "批量"
  ) => {
    if (!activityId || userIds.length === 0) {
      return;
    }

    const payload = resolveAttendanceActionPayload(action);
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

      setErrorMessage(resolvePageErrorMessage(error, "参会名单加载失败，请稍后重试。"));
    } finally {
      setAdjusting(false);
    }
  }, [activityId, loadRoster, navigate]);

  const handleToggleSelection = useCallback((userId: number, checked: boolean) => {
    setSelectedIds((current) => toggleSelectedRosterMember(current, userId, checked));
  }, []);

  return {
    adjusting,
    errorMessage,
    handleToggleSelection,
    loading,
    resultMessage,
    roster,
    runAdjustment,
    selectedIds
  };
}
