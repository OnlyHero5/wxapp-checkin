import type { ActivityActionType, CodeConsumeResponse } from "../../activities/api";
import { formatServerTime } from "../../activities/view-model";
import { AppButton } from "../../../shared/ui/AppButton";
import { MobilePage } from "../../../shared/ui/MobilePage";
import {
  resolveActionTone,
  resolveResultTitle
} from "../attendance-action-utils";

type AttendanceActionResultViewProps = {
  actionType: ActivityActionType;
  onBack: () => void;
  result: CodeConsumeResponse;
};

function resolveResultHint(actionType: ActivityActionType) {
  // 结果页提示只回答“这次动作已经记账成功，接下来去哪”，不重复展示后端 message。
  if (actionType === "checkout") {
    return "签退记录已经提交，可返回详情页继续查看活动状态。";
  }
  return "签到记录已经提交，可返回详情页继续查看活动状态。";
}

export function AttendanceActionResultView({
  actionType,
  onBack,
  result
}: AttendanceActionResultViewProps) {
  const tone = resolveActionTone(actionType);
  const serverTimeText = result.server_time_ms ? formatServerTime(result.server_time_ms) : "";

  return (
    <MobilePage
      eyebrow="提交完成"
      tone={tone}
      title={resolveResultTitle(actionType)}
    >
      {/* 结果态继续保留单主卡：
       * - message、活动名、服务器时间放在同一张卡里确认；
       * - 返回详情按钮也跟结果留在一起，避免结果确认后动作入口漂到卡外。
       */}
      <section className="attendance-action-result__panel" data-panel-tone={tone}>
        <header className="attendance-action-result__hero">
          <p className="attendance-action-result__eyebrow">{actionType === "checkout" ? "签退已提交" : "签到已提交"}</p>
          <div className="attendance-action-result__hero-copy">
            <h2 className="attendance-action-result__title">{result.message ?? "提交成功"}</h2>
            <p className="attendance-action-result__description">{resolveResultHint(actionType)}</p>
          </div>
        </header>
        <dl className="attendance-action-result__meta">
          <div className="attendance-action-result__meta-row">
            <dt className="attendance-action-result__meta-label">活动</dt>
            <dd className="attendance-action-result__meta-value">{result.activity_title}</dd>
          </div>
          {serverTimeText ? (
            <div className="attendance-action-result__meta-row">
              {/* 时间仍使用服务端返回值，避免客户端时区或本机时间污染“何时提交成功”的口径。 */}
              <dt className="attendance-action-result__meta-label">服务器时间</dt>
              <dd className="attendance-action-result__meta-value">{serverTimeText}</dd>
            </div>
          ) : null}
        </dl>
        <AppButton onClick={onBack} tone="secondary">
          返回活动详情
        </AppButton>
      </section>
    </MobilePage>
  );
}
