import { CellGroup, Form, FormItem, Input } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";

/**
 * 动态码输入组件只负责输入体验，不负责业务动作本身：
 * 1. 统一把输入裁成 6 位数字；
 * 2. 复用表单校验与错误展示；
 * 3. 满足长度后开放提交按钮。
 */
type CodeInputProps = {
  errorMessage?: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  pending?: boolean;
  submitText: string;
  value: string;
};

function normalizeCode(value: string) {
  // 所有非数字字符直接过滤，既兼容粘贴，也兼容输入法噪音字符。
  return `${value}`.replace(/\D/g, "").slice(0, 6);
}

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

export function CodeInput({
  errorMessage,
  label,
  onChange,
  onSubmit,
  pending = false,
  submitText,
  value
}: CodeInputProps) {
  const normalizedValue = normalizeCode(value);
  // 满 6 位才允许提交，减少无意义请求。
  const canSubmit = normalizedValue.length === 6 && !pending;

  async function handleFormSubmit(context: { validateResult: unknown }) {
    if (context.validateResult !== true || !canSubmit) {
      return;
    }

    await onSubmit();
  }

  return (
    <section className="stack-form code-input">
      <CellGroup className="code-input__group" theme="card" title={label}>
        <Form
          className="stack-form code-input__form"
          labelAlign="top"
          onSubmit={(context) => void handleFormSubmit(context)}
          // 动态码页经常由移动端键盘完成提交，这里必须拦截原生 submit，避免污染当前路由。
          preventSubmitDefault
          scrollToFirstError="auto"
        >
          <FormItem help="请在当前活动下输入 6 位动态验证码" name="dynamic_code" rules={dynamicCodeRules}>
            <Input
              align="center"
              autocomplete="one-time-code"
              clearable={!pending}
              enterkeyhint="done"
              name="dynamic_code"
              onChange={(nextValue) => onChange(normalizeCode(`${nextValue ?? ""}`))}
              placeholder="输入 6 位码…"
              spellcheck={false}
              status={errorMessage ? "error" : "default"}
              tips={errorMessage || undefined}
              /**
               * 动态码允许前导 0，不能用 number。
               * 这里改成 tel：
               * 1. 继续调起移动端数字键盘；
               * 2. 不会让浏览器把 001234 当成数字重新格式化；
               * 3. 仍然由上面的 normalize 统一裁成 6 位。
               * 4. 不再叠加原生 maxlength，避免“噪音字符先占位、有效数字进不来”。
               */
              type="tel"
              value={normalizedValue}
            />
          </FormItem>
          <AppButton disabled={!canSubmit} loading={pending} type="submit">
            {submitText}
          </AppButton>
        </Form>
      </CellGroup>
    </section>
  );
}
