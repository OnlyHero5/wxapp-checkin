import { useParams } from "react-router-dom";
import { AttendanceActionDetailSection } from "../../features/attendance/components/AttendanceActionDetailSection";
import { AttendanceActionResultView } from "../../features/attendance/components/AttendanceActionResultView";
import {
  resolveActionTitle
} from "../../features/attendance/attendance-action-utils";
import { type ActivityActionType } from "../../features/activities/api";
import { AppButton } from "../../shared/ui/AppButton";
import { AppLoadingState } from "../../shared/ui/AppLoadingState";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { useAttendanceActionPageState } from "./use-attendance-action-page-state";

/**
 * 这个文件把签到页和签退页的共性逻辑收敛到 `AttendanceActionPage`。
 *
 * 共性包括：
 * - 根据活动详情判断动作是否允许
 * - 输入 6 位动态码
 * - 提交 `/code-consume`
 * - 处理结果页
 * - 处理前后台切换后的刷新
 *
 * 只有动作类型、标题文案和按钮文案不同，因此抽成一个通用页面更稳。
 */
type AttendanceActionPageProps = {
  actionType: ActivityActionType;
};

function AttendanceActionPage({ actionType }: AttendanceActionPageProps) {
  const { activityId = "" } = useParams();
  // 动作页切活动或切 checkin/checkout 时，直接重建内部状态最稳妥。
  return <AttendanceActionPageContent actionType={actionType} activityId={activityId} key={`${actionType}:${activityId}`} />;
}

function AttendanceActionPageContent({ actionType, activityId }: { actionType: ActivityActionType; activityId: string }) {
  const {
    actionTone,
    code,
    detail,
    errorMessage,
    handleBack,
    handleCodeChange,
    handleSubmit,
    pageError,
    pending,
    result
  } = useAttendanceActionPageState({
    actionType,
    activityId
  });

  // 成功结果页与输入页拆成两个视觉状态，用户更容易确认“本次操作已经被服务端接受”。
  if (result) {
    return (
      <AttendanceActionResultView
        actionType={actionType}
        onBack={handleBack}
        result={result}
      />
    );
  }

  return (
    <MobilePage
      eyebrow="动态验证码"
      tone={actionTone}
      title={resolveActionTitle(actionType)}
    >
      {/* 页面级错误一般出现在详情拉取失败阶段。 */}
      {pageError ? <InlineNotice message={pageError} /> : null}
      {detail ? (
        <AttendanceActionDetailSection
          actionType={actionType}
          code={code}
          detail={detail}
          errorMessage={errorMessage}
          onCodeChange={handleCodeChange}
          onSubmit={handleSubmit}
          pending={pending}
        />
      ) : (
        <AppLoadingState message="活动信息加载中..." />
      )}
      <AppButton onClick={handleBack} tone="secondary">
        返回活动详情
      </AppButton>
    </MobilePage>
  );
}

export function CheckinPage() {
  // 签到页只是把动作类型固定为 `checkin`。
  return <AttendanceActionPage actionType="checkin" />;
}

export { AttendanceActionPage };
