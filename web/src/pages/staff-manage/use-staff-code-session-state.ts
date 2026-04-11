import { useCallback, useRef, useState } from "react";
import { type ActivityActionType } from "../../features/activities/api";
import { getCodeSession, type CodeSessionResponse } from "../../features/staff/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { createRequestGuard } from "../../shared/page-state/request-guard";

type UseStaffCodeSessionStateInput = {
  activityId: string;
  onErrorMessage: (message: string) => void;
  onSessionExpired: () => void;
};

/**
 * 当前活动动态码资源状态。
 *
 * 把它独立出来后，顶层 hook 只负责决定“什么时候拉哪种码”，
 * 而不是再关心请求版本号、缺失活动参数或错误翻译细节。
 */
export function useStaffCodeSessionState({
  activityId,
  onErrorMessage,
  onSessionExpired
}: UseStaffCodeSessionStateInput) {
  const [codeSession, setCodeSession] = useState<CodeSessionResponse | null>(null);
  const [codeSessionLoading, setCodeSessionLoading] = useState(true);
  const requestGuardRef = useRef(createRequestGuard());

  const loadCodeSession = useCallback(async (
    actionType: ActivityActionType,
    resetBeforeLoad: boolean
  ) => {
    const requestVersion = requestGuardRef.current.beginRequest();
    const refreshNonce = `code-session:${requestVersion}`;

    if (!activityId) {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setCodeSession(null);
        setCodeSessionLoading(false);
        onErrorMessage("活动不存在");
      }
      return;
    }

    setCodeSessionLoading(true);
    if (resetBeforeLoad) {
      setCodeSession(null);
    }

    try {
      const sessionResult = await getCodeSession(activityId, actionType, refreshNonce);
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setCodeSession(sessionResult);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }

      if (requestGuardRef.current.isCurrent(requestVersion)) {
        onErrorMessage(resolvePageErrorMessage(error, "活动管理信息加载失败，请稍后重试。"));
      }
    } finally {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setCodeSessionLoading(false);
      }
    }
  }, [activityId, onErrorMessage, onSessionExpired]);

  return {
    codeSession,
    codeSessionLoading,
    loadCodeSession
  };
}
