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
  // keyed remount 后，这个 ref 只用来区分“首屏加载”和“同活动内切签到/签退 tab”。
  const previousActivityIdRef = useRef("");
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
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          handleSessionExpired();
          return;
        }

        setErrorMessage(resolvePageErrorMessage(error, "活动管理信息加载失败，请稍后重试。"));
      }
    }

    await Promise.all([
      options.reloadDetail ? loadDetail(options.resetDetail) : Promise.resolve(),
      loadCodeSession(actionType, options.resetCodeSession)
    ]);

    // 如果刚刚修正过异常成员，再补刷一次详情和动态码，确保统计与后续动作都基于新状态。
    if (didHealRoster) {
      await Promise.all([loadDetail(false), loadCodeSession(actionType, true)]);
    }
  }, [actionType, activityId, handleSessionExpired, loadCodeSession, loadDetail]);

  useEffect(() => {
    const activityChanged = previousActivityIdRef.current !== activityId;
    previousActivityIdRef.current = activityId;

    void refreshPage({
      reloadDetail: activityChanged,
      resetCodeSession: true,
      resetDetail: activityChanged
    });

    return subscribePageVisible(() => {
      // staff 页回到前台时，以“当前动作页签”为准重拉最新动态码和统计。
      void requestWakeLock();
      void refreshPage({
        reloadDetail: true,
        resetCodeSession: true,
        resetDetail: false
      });
    });
  }, [actionType, activityId, refreshPage, requestWakeLock]);

  const refreshCurrentPage = useCallback(async () => {
    await refreshPage({
      reloadDetail: true,
      resetCodeSession: true,
      resetDetail: false
    });
  }, [refreshPage]);
  async function handleBulkCheckout(reason: string) {
    setBulkPending(true);
    setResultMessage("");

    try {
      const result = await bulkCheckout(activityId, {
        confirm: true,
        reason
      });
      setResultMessage(result.message ?? "批量签退完成");
      await refreshCurrentPage();
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
    loading,
    refreshCurrentPage,
    resultMessage,
    setActionType,
    wakeLockMessage
  };
}
