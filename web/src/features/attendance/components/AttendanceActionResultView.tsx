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
      {/* 结果态同样回收到单主卡，避免 `Result + CellGroup` 重新拆成两张视觉卡片。 */}
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
