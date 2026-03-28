import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type ActivityActionType } from "../../features/activities/api";
import { bulkCheckout } from "../../features/staff/api";
import { ensureRosterConsistency } from "../../features/staff/attendance-roster-self-heal";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { useScreenWakeLock } from "./use-screen-wake-lock";
import { useStaffCodeSessionState } from "./use-staff-code-session-state";
import { useStaffManageDetailState } from "./use-staff-manage-detail-state";

type RefreshOptions = {
  reloadDetail: boolean;
  resetDetail: boolean;
  resetCodeSession: boolean;
};

/**
 * staff 管理页的状态流转比较重，因此抽成页面级 hook。
 *
 * 这层统一收口：
 * 1. 详情和动态码的并发保护
 * 2. 页面回前台后的重拉策略
 * 3. 批量签退后的结果提示
 */
export function useStaffManageState(activityId: string) {
  const navigate = useNavigate();
  const [actionType, setActionType] = useState<ActivityActionType>("checkin");
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [riskActionsBlocked, setRiskActionsBlocked] = useState(false);
  // keyed remount 后，这个 ref 只用来区分“首屏加载”和“同活动内切签到/签退 tab”。
  const previousActivityIdRef = useRef("");
  const previousActionTypeRef = useRef<ActivityActionType | null>(null);
  const actionTypeRef = useRef<ActivityActionType>("checkin");
  const { requestWakeLock, wakeLockMessage } = useScreenWakeLock();
  const handleSessionExpired = useCallback(() => {
    navigate("/login");
  }, [navigate]);
  const { detail, detailLoading, loadDetail } = useStaffManageDetailState({
    activityId,
    onErrorMessage: setErrorMessage,
    onSessionExpired: handleSessionExpired
  });
  const { codeSession, codeSessionLoading, loadCodeSession } = useStaffCodeSessionState({
    activityId,
    onErrorMessage: setErrorMessage,
    onSessionExpired: handleSessionExpired
  });
  const loading = detailLoading || codeSessionLoading;

  useEffect(() => {
    actionTypeRef.current = actionType;
  }, [actionType]);

  const refreshPage = useCallback(async (options: RefreshOptions) => {
    setErrorMessage("");
    let didHealRoster = false;

    /**
     * staff 管理页虽然不直接展示名单，
     * 但动态码和批量动作都不能继续建立在“已签退但未签到”的脏状态上。
     */
    if (activityId) {
      try {
        const healResult = await ensureRosterConsistency({ activityId });
        didHealRoster = healResult.didHeal;
        setRiskActionsBlocked(false);
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          handleSessionExpired();
          return;
        }

        /**
         * 需要自愈的重型刷新一旦失败，就不能继续刷新详情或动态码，
         * 否则页面会把后续操作建立在“未确认安全”的旧状态上。
         */
        setRiskActionsBlocked(true);
        setErrorMessage(resolvePageErrorMessage(error, "活动管理信息加载失败，请稍后重试。"));
        return;
      }
    }

    await Promise.all([
      options.reloadDetail ? loadDetail(options.resetDetail) : Promise.resolve(),
      loadCodeSession(actionTypeRef.current, options.resetCodeSession)
    ]);

    // 如果刚刚修正过异常成员，再补刷一次详情和动态码，确保统计与后续动作都基于新状态。
    if (didHealRoster) {
      await Promise.all([loadDetail(false), loadCodeSession(actionTypeRef.current, true)]);
    }
  }, [activityId, handleSessionExpired, loadCodeSession, loadDetail]);

  useEffect(() => {
    const activityChanged = previousActivityIdRef.current !== activityId;
    previousActivityIdRef.current = activityId;

    void refreshPage({
      reloadDetail: activityChanged,
      resetCodeSession: true,
      resetDetail: activityChanged
    });
  }, [activityId, refreshPage]);

  useEffect(() => {
    return subscribePageVisible(() => {
      // staff 页回到前台时，以“当前动作页签”为准做一次完整安全刷新。
      void requestWakeLock();
      void refreshPage({
        reloadDetail: true,
        resetCodeSession: true,
        resetDetail: false
      });
    });
  }, [refreshPage, requestWakeLock]);

  const refreshCurrentCodeSession = useCallback(async () => {
    if (riskActionsBlocked) {
      return;
    }

    /**
     * 动态码倒计时刷新、手动刷新、tab 切换都属于轻量刷新，
     * 这里只刷新 code-session，避免把 roster 自愈前置到每一次发码动作。
     */
    await loadCodeSession(actionType, true);
  }, [actionType, loadCodeSession, riskActionsBlocked]);

  useEffect(() => {
    if (previousActionTypeRef.current === null) {
      previousActionTypeRef.current = actionType;
      return;
    }

    if (previousActionTypeRef.current === actionType) {
      return;
    }

    previousActionTypeRef.current = actionType;
    void refreshCurrentCodeSession();
  }, [actionType, refreshCurrentCodeSession]);

  async function handleBulkCheckout(reason: string) {
    if (riskActionsBlocked) {
      return;
    }

    setBulkPending(true);
    setResultMessage("");

    try {
      const result = await bulkCheckout(activityId, {
        confirm: true,
        reason
      });
      setResultMessage(result.message ?? "批量签退完成");
      await refreshPage({
        reloadDetail: true,
        resetCodeSession: true,
        resetDetail: false
      });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolvePageErrorMessage(error, "活动管理信息加载失败，请稍后重试。"));
    } finally {
      setBulkPending(false);
    }
  }

  return {
    actionType,
    bulkPending,
    codeSession,
    codeSessionLoading,
    detail,
    errorMessage,
    handleBulkCheckout,
    riskActionsBlocked,
    loading,
    refreshCurrentCodeSession,
    resultMessage,
    setActionType,
    wakeLockMessage
  };
}
