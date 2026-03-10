import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getActivityDetail, type ActivityActionType, type ActivityDetail } from "../../features/activities/api";
import { DynamicCodePanel } from "../../features/staff/components/DynamicCodePanel";
import { BulkCheckoutButton } from "../../features/staff/components/BulkCheckoutButton";
import { bulkCheckout, getCodeSession, type CodeSessionResponse } from "../../features/staff/api";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { SessionExpiredError } from "../../shared/http/errors";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkPending, setBulkPending] = useState(false);

  async function loadDetail() {
    const detailResult = await getActivityDetail(activityId);
    setDetail(detailResult);
  }

  async function loadCodeSession(nextActionType: ActivityActionType) {
    const sessionResult = await getCodeSession(activityId, nextActionType);
    setCodeSession(sessionResult);
  }

  async function loadPage(nextActionType: ActivityActionType) {
    if (!activityId) {
      setErrorMessage("活动不存在");
      setLoading(false);
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      // 详情和动态码都是当前页的首屏信息，直接并行拉取最省等待时间。
      await Promise.all([loadDetail(), loadCodeSession(nextActionType)]);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage(actionType);

    return subscribePageVisible(() => {
      // staff 页回到前台时，以“当前动作页签”为准重拉最新动态码和统计。
      void loadPage(actionType);
    });
  }, [activityId, actionType, navigate]);

  async function handleBulkCheckout(reason: string) {
    setBulkPending(true);
    setResultMessage("");

    try {
      const result = await bulkCheckout(activityId, {
        confirm: true,
        reason
      });
      setResultMessage(result.message ?? "批量签退完成");
      await loadPage(actionType);
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
    <MobilePage eyebrow="工作人员" title="活动管理">
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      {resultMessage ? <InlineNotice message={resultMessage} theme="success" /> : null}
      {detail ? (
        <ActivityMetaPanel
          counts={{
            checkin: codeSession?.checkin_count ?? detail.checkin_count,
            checkout: codeSession?.checkout_count ?? detail.checkout_count
          }}
          description={detail.description}
          locationText={detail.location}
          subtitle={detail.activity_type}
          timeText={detail.start_time}
          title={detail.activity_title}
        />
      ) : null}
      <DynamicCodePanel
        actionType={actionType}
        codeSession={codeSession}
        loading={loading}
        onActionChange={setActionType}
        onRefresh={() => void loadPage(actionType)}
      />
      <BulkCheckoutButton disabled={loading || !detail} loading={bulkPending} onConfirm={handleBulkCheckout} />
    </MobilePage>
  );
}
