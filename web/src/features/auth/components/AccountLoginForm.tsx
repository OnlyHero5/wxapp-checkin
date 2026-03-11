import { FormEvent, useState } from "react";
import { AppButton } from "../../../shared/ui/AppButton";
import { InlineNotice } from "../../../shared/ui/InlineNotice";

/**
 * Web 端账号密码登录表单。
 *
 * 组件职责刻意收敛为：
 * - 收集最小必要输入（学号 + 密码）
 * - 做轻量的“可提交性”判断（是否为空、是否正在提交）
 * - 把规范化后的数据交给页面层处理（请求/跳转/错误码翻译不在这里做）
 */
type AccountLoginFormProps = {
  errorMessage?: string;
  onSubmit: (input: { student_id: string; password: string }) => Promise<void> | void;
  pending?: boolean;
};

function normalizeText(value: string) {
  return value.trim();
}

export function AccountLoginForm({ errorMessage, onSubmit, pending = false }: AccountLoginFormProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");

  const normalizedStudentId = normalizeText(studentId);
  const normalizedPassword = normalizeText(password);
  const canSubmit = !!normalizedStudentId && !!normalizedPassword && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      student_id: normalizedStudentId,
      password: normalizedPassword
    });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>学号</span>
        <input
          autoComplete="username"
          inputMode="numeric"
          onChange={(event) => setStudentId(event.target.value)}
          placeholder="请输入学号"
          value={studentId}
        />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="请输入密码"
          type="password"
          value={password}
        />
      </label>
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      <AppButton disabled={!canSubmit} loading={pending} type="submit">
        登录
      </AppButton>
    </form>
  );
}

