import { useCallback, useRef, useState } from "react";
import { getActivityDetail, type ActivityDetail } from "../../features/activities/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { createRequestGuard } from "../../shared/page-state/request-guard";

type UseStaffManageDetailStateInput = {
  activityId: string;
  onErrorMessage: (message: string) => void;
  onSessionExpired: () => void;
};

/**
 * staff 管理页里的活动详情资源状态。
 *
 * 它只回答两件事：
 * 1. 当前活动详情是什么；
 * 2. 详情是否还在加载。
 *
 * 这样顶层状态 hook 就不用同时维护“详情 + 动态码”两套近似代码。
 */
export function useStaffManageDetailState({
  activityId,
  onErrorMessage,
  onSessionExpired
}: UseStaffManageDetailStateInput) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const requestGuardRef = useRef(createRequestGuard());

  const loadDetail = useCallback(async (resetBeforeLoad: boolean) => {
    const requestVersion = requestGuardRef.current.beginRequest();

    if (!activityId) {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setDetail(null);
        setDetailLoading(false);
        onErrorMessage("活动不存在");
      }
      return;
    }

    setDetailLoading(true);
    if (resetBeforeLoad) {
      setDetail(null);
    }

    try {
      const detailResult = await getActivityDetail(activityId);
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setDetail(detailResult);
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
        setDetailLoading(false);
      }
    }
  }, [activityId, onErrorMessage, onSessionExpired]);

  return {
    detail,
    detailLoading,
    loadDetail
  };
}
