import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isActionAllowed,
  resolveConsumeError,
  resolveActionTone
} from "../../features/attendance/attendance-action-utils";
import {
  buildActivityDetailPath,
  consumeActivityCode,
  getActivityDetail,
  type ActivityActionType,
  type ActivityDetail,
  type CodeConsumeResponse
} from "../../features/activities/api";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { createRequestGuard } from "../../shared/page-state/request-guard";

type UseAttendanceActionPageStateInput = {
  actionType: ActivityActionType;
  activityId: string;
};

/**
 * 签到/签退页的状态机集中在这里维护。
 *
 * 这样拆开的目的不是为了“多一个 hook”，而是为了把页面文件重新压回展示层：
 * - 页面只决定渲染哪块组件；
 * - 这里统一管理详情拉取、提交、结果态和前后台刷新；
 * - 后续若要再补扫码、自动聚焦或错误埋点，也只需要改这一层。
 */
export function useAttendanceActionPageState({
  actionType,
  activityId
}: UseAttendanceActionPageStateInput) {
  const navigate = useNavigate();
  const actionTone = resolveActionTone(actionType);
  const [code, setCode] = useState("");
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CodeConsumeResponse | null>(null);
  // 详情可能因为首屏和回前台刷新同时在路上，所以只接受最后一次请求。
  const detailRequestGuardRef = useRef(createRequestGuard());

  const loadDetail = useCallback(async () => {
    const requestVersion = detailRequestGuardRef.current.beginRequest();

    if (!activityId) {
      setPageError("活动不存在");
      setDetail(null);
      return;
    }

    setPageError("");
    setDetail(null);

    try {
      const detailResult = await getActivityDetail(activityId);
      if (detailRequestGuardRef.current.isCurrent(requestVersion)) {
        setDetail(detailResult);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }

      if (detailRequestGuardRef.current.isCurrent(requestVersion)) {
        setPageError(resolvePageErrorMessage(error, "活动信息加载失败"));
      }
    }
  }, [activityId, navigate]);

  useEffect(() => {
    // 首次进入和页面重新回到前台，都以同一套详情刷新口径为准。
    void loadDetail();

    return subscribePageVisible(() => {
      void loadDetail();
    });
  }, [loadDetail]);

  const handleSubmit = useCallback(async () => {
    if (!detail || !isActionAllowed(detail, actionType)) {
      return;
    }

    setPending(true);
    setErrorMessage("");

    try {
      const consumeResult = await consumeActivityCode(activityId, {
        action_type: actionType,
        code
      });
      setResult(consumeResult);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }

      setErrorMessage(resolveConsumeError(error));
    } finally {
      setPending(false);
    }
  }, [actionType, activityId, code, detail, navigate]);

  return {
    actionTone,
    code,
    detail,
    errorMessage,
    handleBack() {
      navigate(buildActivityDetailPath(activityId));
    },
    handleCodeChange: setCode,
    handleSubmit,
    pageError,
    pending,
    result
  };
}
