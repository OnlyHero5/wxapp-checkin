import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActivityDetail,
  type ActivityActionType,
  type ActivityDetail
} from "../../features/activities/api";
import { bulkCheckout, getCodeSession, type CodeSessionResponse } from "../../features/staff/api";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { useScreenWakeLock } from "./use-screen-wake-lock";

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "活动管理信息加载失败，请稍后重试。";
}

type RefreshOptions = {
  reloadDetail: boolean; resetDetail: boolean; resetCodeSession: boolean;
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
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [codeSession, setCodeSession] = useState<CodeSessionResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [codeSessionLoading, setCodeSessionLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const detailRequestVersionRef = useRef(0);
  const codeSessionRequestVersionRef = useRef(0);
  // keyed remount 后，这个 ref 只用来区分“首屏加载”和“同活动内切签到/签退 tab”。
  const previousActivityIdRef = useRef("");
  const { requestWakeLock, wakeLockMessage } = useScreenWakeLock();
  const loading = detailLoading || codeSessionLoading;

  const loadDetail = useCallback(async (resetBeforeLoad: boolean) => {
    const requestVersion = detailRequestVersionRef.current + 1;
    detailRequestVersionRef.current = requestVersion;

    if (!activityId) {
      if (detailRequestVersionRef.current === requestVersion) {
        setDetail(null);
        setDetailLoading(false);
        setErrorMessage("活动不存在");
      }
      return;
    }

    setDetailLoading(true);
    if (resetBeforeLoad) {
      setDetail(null);
    }

    try {
      const detailResult = await getActivityDetail(activityId);
      if (detailRequestVersionRef.current === requestVersion) {
        setDetail(detailResult);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      if (detailRequestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (detailRequestVersionRef.current === requestVersion) {
        setDetailLoading(false);
      }
    }
  }, [activityId, navigate]);

  const loadCodeSession = useCallback(async (
    nextActionType: ActivityActionType,
    resetBeforeLoad: boolean
  ) => {
    const requestVersion = codeSessionRequestVersionRef.current + 1;
    codeSessionRequestVersionRef.current = requestVersion;

    if (!activityId) {
      if (codeSessionRequestVersionRef.current === requestVersion) {
        setCodeSession(null);
        setCodeSessionLoading(false);
        setErrorMessage("活动不存在");
      }
      return;
    }

    setCodeSessionLoading(true);
    if (resetBeforeLoad) {
      setCodeSession(null);
    }

    try {
      const sessionResult = await getCodeSession(activityId, nextActionType);
      if (codeSessionRequestVersionRef.current === requestVersion) {
        setCodeSession(sessionResult);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      if (codeSessionRequestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (codeSessionRequestVersionRef.current === requestVersion) {
        setCodeSessionLoading(false);
      }
    }
  }, [activityId, navigate]);

  const refreshPage = useCallback(async (options: RefreshOptions) => {
    setErrorMessage("");
    await Promise.all([
      options.reloadDetail ? loadDetail(options.resetDetail) : Promise.resolve(),
      loadCodeSession(actionType, options.resetCodeSession)
    ]);
  }, [actionType, loadCodeSession, loadDetail]);

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
      setErrorMessage(resolveErrorMessage(error));
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
