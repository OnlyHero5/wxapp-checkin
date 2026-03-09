/**
 * 动态码输入组件负责“输入体验”而不是“业务动作”：
 * 1. 限制只能保留 6 位数字
 * 2. 显示错误文案
 * 3. 在满足长度时开放提交按钮
 *
 * 签到页和签退页共用这套组件，避免两边校验逻辑漂移。
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
  // 所有非数字字符直接过滤，既兼容粘贴，也兼容输入法带来的噪音字符。
  return `${value}`.replace(/\D/g, "").slice(0, 6);
}

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

  return (
    <section className="stack-form">
      <label className="field" htmlFor={`${label}-input`}>
        <span>{label}</span>
        <input
          className="code-input"
          // 这三个属性共同服务于手机端数字键盘体验。
          enterKeyHint="done"
          id={`${label}-input`}
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => onChange(normalizeCode(event.target.value))}
          pattern="[0-9]*"
          placeholder="请输入 6 位数字"
          value={normalizedValue}
        />
      </label>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button className="primary-button" disabled={!canSubmit} onClick={() => void onSubmit()} type="button">
        {/* 这里不用动作名 + pending 组合太复杂的文案，保持一眼可懂。 */}
        {pending ? "提交中..." : submitText}
      </button>
    </section>
  );
}
