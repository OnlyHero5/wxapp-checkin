import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActivityDetail, type ActivityDetail } from "../../features/activities/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { resolvePageErrorMessage } from "../../shared/page-state/page-error";
import { createRequestGuard } from "../../shared/page-state/request-guard";
import { isStaffSession } from "../../shared/session/session-store";
import type { VisualTone } from "../../shared/ui/visual-tone";

function resolveDetailTone(isStaff: boolean): Extract<VisualTone, "brand" | "staff"> {
  // 详情页承担“列表 -> 动作页”的过渡职责：
  // - 普通用户沿用品牌态，承接活动列表
  // - 工作人员沿用 staff 态，承接管理链路
  return isStaff ? "staff" : "brand";
}

/**
 * 活动详情页状态收口层。
 *
 * 这一层的边界很明确：
 * - 只处理当前活动详情的加载与错误；
 * - 不负责按钮跳转，不负责把详情投影成具体 UI；
 * - 页面文件只组合按钮、空态和元信息面板。
 */
export function useActivityDetailPageState(activityId: string) {
  const navigate = useNavigate();
  const isStaff = isStaffSession();
  const detailTone = resolveDetailTone(isStaff);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // 路由快速切换时，只允许最新那次详情请求回写页面。
  const requestGuardRef = useRef(createRequestGuard());

  useEffect(() => {
    let active = true;
    const requestVersion = requestGuardRef.current.beginRequest();

    async function loadDetail() {
      setErrorMessage("");
      setDetail(null);

      try {
        const result = await getActivityDetail(activityId);
        if (active && requestGuardRef.current.isCurrent(requestVersion)) {
          setDetail(result);
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          navigate("/login");
          return;
        }

        if (active && requestGuardRef.current.isCurrent(requestVersion)) {
          setErrorMessage(resolvePageErrorMessage(error, "活动详情加载失败，请稍后重试。"));
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [activityId, navigate]);

  return {
    detail,
    detailTone,
    errorMessage,
    isStaff
  };
}
