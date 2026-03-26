import { useState } from "react";
import { Form, FormItem, Input } from "tdesign-mobile-react";
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

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      student_id: normalizedStudentId,
      password: normalizedPassword
    });
  }

  return (
    <div className="stack-form">
      <Form labelAlign="top">
        <FormItem label="学号" name="student_id">
          <Input
            autocomplete="username"
            clearable
            maxlength={20}
            onChange={(value) => setStudentId(`${value ?? ""}`)}
            placeholder="请输入学号"
            type="tel"
            value={studentId}
          />
        </FormItem>
        <FormItem label="密码" name="password">
          <Input
            autocomplete="current-password"
            onChange={(value) => setPassword(`${value ?? ""}`)}
            placeholder="请输入密码"
            type="password"
            value={password}
          />
        </FormItem>
        <AppButton accentTone="brand" disabled={!canSubmit} loading={pending} onClick={() => void handleSubmit()}>
          登录
        </AppButton>
      </Form>
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
    </div>
  );
}
