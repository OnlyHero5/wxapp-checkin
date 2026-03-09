import { FormEvent, useState } from "react";

/**
 * 绑定页表单只关心三件事：
 * 1. 收集实名校验所需的最小输入
 * 2. 在前端做最轻量的可提交性判断
 * 3. 把规范化后的数据交给页面层继续处理
 *
 * 具体请求、错误码翻译、跳转都不放在组件里，
 * 这样表单组件才可以保持纯展示 + 事件分发。
 */
type IdentityBindFormProps = {
  errorMessage?: string;
  onSubmit: (input: { name: string; student_id: string }) => Promise<void> | void;
  pending?: boolean;
};

function normalizeText(value: string) {
  // 这里先做最基础的 trim，避免把“看不见的空格差异”带到后端实名校验。
  return value.trim();
}

export function IdentityBindForm({
  errorMessage,
  onSubmit,
  pending = false
}: IdentityBindFormProps) {
  // 学号和姓名拆成两个独立 state，是为了保持输入行为直观且可控。
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");

  // 目前只做“是否为空”的前端门槛，正式格式仍以后端校验结果为准。
  const canSubmit = !!normalizeText(studentId) && !!normalizeText(name) && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 双重守卫：既防止用户快速重复提交，也防止调用方误触发。
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      // 提交前再做一次标准化，保证 state 中残留的空格不会泄漏到接口层。
      name: normalizeText(name),
      student_id: normalizeText(studentId)
    });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>学号</span>
        <input
          autoComplete="username"
          inputMode="numeric"
          // 这里不直接限制只能输入数字，避免不同学校学号规则变化时前端过度假设。
          onChange={(event) => setStudentId(event.target.value)}
          placeholder="请输入学号"
          value={studentId}
        />
      </label>
      <label className="field">
        <span>姓名</span>
        <input
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="请输入姓名"
          value={name}
        />
      </label>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button className="primary-button" disabled={!canSubmit} type="submit">
        {/* pending 文案直接告诉用户现在卡在“注册”链路，而不是静默等待。 */}
        {pending ? "注册中..." : "验证身份并注册 Passkey"}
      </button>
    </form>
  );
}
