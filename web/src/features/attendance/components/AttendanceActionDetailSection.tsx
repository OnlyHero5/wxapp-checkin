import { Form, FormItem, Input } from "tdesign-mobile-react";
import type { ActivityActionType, ActivityDetail } from "../../activities/api";
import { ActivityMetaPanel } from "../../../shared/ui/ActivityMetaPanel";
import { AppButton } from "../../../shared/ui/AppButton";
import { AppEmptyState } from "../../../shared/ui/AppEmptyState";
import {
  isActionAllowed,
  resolveActionTone,
  resolveInputLabel,
  resolveSubmitText
} from "../attendance-action-utils";

type AttendanceActionDetailSectionProps = {
  actionType: ActivityActionType;
  code: string;
  detail: ActivityDetail;
  errorMessage: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  pending: boolean;
};

const dynamicCodeRules = [
  {
    message: "请输入 6 位动态验证码",
    required: true
  },
  {
    len: 6,
    message: "请输入 6 位动态验证码"
  }
];

function normalizeCode(value: string) {
  // 动态码允许前导 0，因此统一按字符串清洗，而不是交给 number 输入处理。
  return `${value}`.replace(/\D/g, "").slice(0, 6);
}

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
  const normalizedCode = normalizeCode(code);
  const canSubmit = normalizedCode.length === 6 && !pending;
  const inputLabel = resolveInputLabel(actionType);
  const submitText = resolveSubmitText(actionType);

  async function handleFormSubmit(context: { validateResult: unknown }) {
    if (context.validateResult !== true || !canSubmit) {
      return;
    }

    // 页面状态机已经在 hook 里处理 pending 和请求异常，这里只负责把“当前 6 位码”送出去。
    await onSubmit();
  }

  /**
   * 这一层专门承担“轻流程动作页”的主卡拼装：
   * 1. 外层 `attendance-action-detail__card` 是 Task 6 计划锁定的稳定钩子；
   * 2. 详情字段继续交给共享 `ActivityMetaPanel`，避免输入页自己维护字段顺序；
   * 3. footer 根据可执行性切换成输入区或空态，但永远留在同一张卡里，页面结构不抖动。
   */
  const footer = actionAvailable ? (
    <section aria-label={inputLabel} className="attendance-action-detail__footer">
      <div className="attendance-action-detail__input-shell">
        <p className="attendance-action-detail__section-label">{inputLabel}</p>
        <Form
          className="attendance-action-detail__form"
          labelAlign="top"
          onSubmit={(context) => void handleFormSubmit(context)}
          preventSubmitDefault
          scrollToFirstError="auto"
        >
          {/* 动态码输入和提交按钮必须留在同一 form 里，才能继续复用原来的 submit 行为与测试入口。 */}
          <FormItem help="请在当前活动下输入 6 位动态验证码" name="dynamic_code" rules={dynamicCodeRules}>
            <Input
              align="center"
              autocomplete="one-time-code"
              clearable={!pending}
              enterkeyhint="done"
              name="dynamic_code"
              onChange={(nextValue) => onCodeChange(normalizeCode(`${nextValue ?? ""}`))}
              placeholder="输入 6 位码…"
              spellcheck={false}
              status={errorMessage ? "error" : "default"}
              tips={errorMessage || undefined}
              type="tel"
              value={normalizedCode}
            />
          </FormItem>
          <AppButton disabled={!canSubmit} loading={pending} type="submit">
            {submitText}
          </AppButton>
        </Form>
      </div>
    </section>
  ) : (
    <section className="attendance-action-detail__footer">
      {/* 不可执行时只替换 footer 内容，不改变卡片骨架，避免用户误判为页面加载失败。 */}
      <AppEmptyState message="当前状态下暂不可执行该动作，请先返回详情页确认活动状态。" />
    </section>
  );

  return (
    <section className="attendance-action-detail__card" data-panel-tone={resolveActionTone(actionType)}>
      <ActivityMetaPanel
        description={detail.description}
        footer={footer}
        locationText={detail.location}
        subtitle={detail.activity_type}
        timeText={detail.start_time}
        title={detail.activity_title}
        titleAs="h2"
        tone={resolveActionTone(actionType)}
      />
    </section>
  );
}
