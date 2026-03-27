import { Cell, CellGroup } from "tdesign-mobile-react";
import type { ActivityActionType, ActivityDetail } from "../../activities/api";
import { AppEmptyState } from "../../../shared/ui/AppEmptyState";
import {
  isActionAllowed,
  resolveInputLabel,
  resolveSubmitText
} from "../attendance-action-utils";
import { CodeInput } from "./CodeInput";

type AttendanceActionDetailSectionProps = {
  actionType: ActivityActionType;
  code: string;
  detail: ActivityDetail;
  errorMessage: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  pending: boolean;
};

export function AttendanceActionDetailSection({
  actionType,
  code,
  detail,
  errorMessage,
  onCodeChange,
  onSubmit,
  pending
}: AttendanceActionDetailSectionProps) {
  const actionAvailable = isActionAllowed(detail, actionType);

  return (
    <>
      <CellGroup theme="card" title={detail.activity_title}>
        {detail.activity_type ? <Cell note={detail.activity_type} title="类型" /> : null}
        {detail.start_time ? <Cell note={detail.start_time} title="时间" /> : null}
        {detail.location ? <Cell note={detail.location} title="地点" /> : null}
        {detail.description ? <Cell align="top" description={detail.description} title="说明" /> : null}
      </CellGroup>
      {actionAvailable ? (
        <CodeInput
          errorMessage={errorMessage}
          label={resolveInputLabel(actionType)}
          onChange={onCodeChange}
          onSubmit={onSubmit}
          pending={pending}
          submitText={resolveSubmitText(actionType)}
          value={code}
        />
      ) : (
        <AppEmptyState message="当前状态下暂不可执行该动作，请先返回详情页确认活动状态。" />
      )}
    </>
  );
}
