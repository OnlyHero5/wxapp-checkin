import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  buildActivityDetailPath,
  getActivityDetail,
  type ActivityActionType,
  type ActivityDetail
} from "../../features/activities/api";
import { DynamicCodePanel } from "../../features/staff/components/DynamicCodePanel";
import { BulkCheckoutButton } from "../../features/staff/components/BulkCheckoutButton";
import { bulkCheckout, getCodeSession, type CodeSessionResponse } from "../../features/staff/api";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";

type WakeLockSentinelLike = {
  release?: () => Promise<void> | void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "活动管理信息加载失败，请稍后重试。";
}

/**
 * staff 管理页负责把“活动元信息 + 当前动态码 + 批量签退动作”收口到一屏内。
 *
 * 这页不重复实现角色判断，默认假设外层路由已经完成 staff 守卫。
 */
export function StaffManagePage() {
  const { activityId = "" } = useParams();
  const navigate = useNavigate();
  const [actionType, setActionType] = useState<ActivityActionType>("checkin");
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [codeSession, setCodeSession] = useState<CodeSessionResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [codeSessionLoading, setCodeSessionLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [wakeLockMessage, setWakeLockMessage] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const detailRequestVersionRef = useRef(0);
  const codeSessionRequestVersionRef = useRef(0);
  const previousActivityIdRef = useRef("");
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

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

  const refreshPage = useCallback(async (options: {
    reloadDetail: boolean;
    resetDetail: boolean;
    resetCodeSession: boolean;
  }) => {
    setErrorMessage("");
    await Promise.all([
      options.reloadDetail ? loadDetail(options.resetDetail) : Promise.resolve(),
      loadCodeSession(actionType, options.resetCodeSession)
    ]);
  }, [actionType, loadCodeSession, loadDetail]);

  const releaseWakeLock = useCallback(async () => {
    const currentWakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!currentWakeLock?.release) {
      return;
    }

    try {
      await currentWakeLock.release();
    } catch {
      return;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const wakeLock = (navigator as WakeLockNavigator | undefined)?.wakeLock;
    if (!wakeLock || typeof wakeLock.request !== "function") {
      setWakeLockMessage("当前浏览器不支持自动保持屏幕常亮，请手动关闭自动锁屏或保持屏幕常亮。");
      return;
    }

    try {
      wakeLockRef.current = await wakeLock.request("screen");
      setWakeLockMessage("");
    } catch {
      setWakeLockMessage("无法自动保持屏幕常亮，请手动关闭自动锁屏或保持屏幕常亮。");
    }
  }, []);

  useEffect(() => {
    void requestWakeLock();

    return () => {
      void releaseWakeLock();
    };
  }, [releaseWakeLock, requestWakeLock]);

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

  async function handleBulkCheckout(reason: string) {
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
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <MobilePage
      eyebrow="工作人员"
      headerActions={(
        <Link className="text-link" to={buildActivityDetailPath(activityId)}>
          返回活动详情
        </Link>
      )}
      tone="staff"
      title="活动管理"
    >
      {wakeLockMessage ? <InlineNotice message={wakeLockMessage} theme="warning" /> : null}
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      {resultMessage ? <InlineNotice message={resultMessage} theme="success" /> : null}
      {detail ? (
        <ActivityMetaPanel
          counts={{
            expected: codeSession?.registered_count ?? detail.registered_count,
            checkin: codeSession?.checkin_count ?? detail.checkin_count,
            checkout: codeSession?.checkout_count ?? detail.checkout_count
          }}
          description={detail.description}
          locationText={detail.location}
          subtitle={detail.activity_type}
          timeText={detail.start_time}
          tone="staff"
          title={detail.activity_title}
        />
      ) : null}
      <DynamicCodePanel
        actionType={actionType}
        codeSession={codeSession}
        loading={codeSessionLoading}
        onActionChange={setActionType}
        onRefresh={() => void refreshPage({
          reloadDetail: true,
          resetCodeSession: true,
          resetDetail: false
        })}
      />
      <BulkCheckoutButton disabled={loading || !detail} loading={bulkPending} onConfirm={handleBulkCheckout} />
    </MobilePage>
  );
}
