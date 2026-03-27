import { Cell, CellGroup, Result } from "tdesign-mobile-react";
import type { CodeConsumeResponse, ActivityActionType } from "../../activities/api";
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

export function AttendanceActionResultView({
  actionType,
  onBack,
  result
}: AttendanceActionResultViewProps) {
  return (
    <MobilePage
      eyebrow="提交完成"
      tone={resolveActionTone(actionType)}
      title={resolveResultTitle(actionType)}
    >
      <Result
        description={result.server_time_ms ? `服务器时间：${formatServerTime(result.server_time_ms)}` : undefined}
        theme="success"
        title={result.message ?? "提交成功"}
      />
      <CellGroup theme="card" title="活动信息">
        <Cell note={result.activity_title} title="活动" />
      </CellGroup>
      <AppButton onClick={onBack} tone="secondary">
        返回活动详情
      </AppButton>
    </MobilePage>
  );
}
