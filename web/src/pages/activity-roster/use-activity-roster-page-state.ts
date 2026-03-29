import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adjustAttendanceStates,
  type ActivityRosterResponse
} from "../../features/staff/api";
import {
  resolveAttendanceActionPayload,
  toggleSelectedRosterMember
} from "../../features/staff/activity-roster-actions";
import { ensureRosterConsistency } from "../../features/staff/attendance-roster-self-heal";
import {
  normalizeRosterItem,
  type NormalizedRosterItem
} from "../../features/staff/attendance-roster-state";
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
export type NormalizedActivityRoster = Omit<ActivityRosterResponse, "items"> & {
  items: NormalizedRosterItem[];
};

/**
 * 名单页只要经过自愈检查，就必须继续以“规范态名单”往后传。
 *
 * 这样页面、批量条和单人动作拿到的都是同一套类型边界：
 * - 不需要再把 `items` 强转回原始接口类型；
 * - 后续若有新展示逻辑，也不会误读未规范化的布尔组合。
 */
function normalizeActivityRoster(roster: ActivityRosterResponse): NormalizedActivityRoster {
  return {
    ...roster,
    items: roster.items.map(normalizeRosterItem)
  };
}

export function useActivityRosterPageState(activityId: string) {
  const navigate = useNavigate();
  const [roster, setRoster] = useState<NormalizedActivityRoster | null>(null);
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
      const result = await ensureRosterConsistency({ activityId });
      if (!requestGuardRef.current.isCurrent(requestVersion)) {
        return;
      }

      /**
       * 自愈后的回读结果仍然可能暂时带着旧布尔组合，
       * 页面展示态必须继续走规范化，避免名单动作区再次暴露非法状态。
       */
      const normalizedRoster = normalizeActivityRoster(result.roster);

      setRoster(normalizedRoster);
      // 刷新后只保留仍然存在于名单中的勾选项，避免页面留着脏选择。
      setSelectedIds((current) =>
        current.filter((userId) => normalizedRoster.items.some((item) => item.user_id === userId))
      );
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
