import { FormEvent, useState } from "react";
import { AppButton } from "../../../shared/ui/AppButton";
import { InlineNotice } from "../../../shared/ui/InlineNotice";

/**
 * Web 端改密表单。
 *
 * 这里把 UI 表单和“后端接口调用 + 路由跳转”分离开，
 * 便于后续在不同页面复用同一套输入与校验逻辑。
 */
type ChangePasswordFormProps = {
  errorMessage?: string;
  onSubmit: (input: { old_password: string; new_password: string }) => Promise<void> | void;
  pending?: boolean;
};

function normalizeText(value: string) {
  return value.trim();
}

export function ChangePasswordForm({ errorMessage, onSubmit, pending = false }: ChangePasswordFormProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const normalizedOldPassword = normalizeText(oldPassword);
  const normalizedNewPassword = normalizeText(newPassword);
  const canSubmit = !!normalizedOldPassword && !!normalizedNewPassword && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      old_password: normalizedOldPassword,
      new_password: normalizedNewPassword
    });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>旧密码</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setOldPassword(event.target.value)}
          placeholder="首次登录默认是 123"
          type="password"
          value={oldPassword}
        />
      </label>
      <label className="field">
        <span>新密码</span>
        <input
          autoComplete="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="请输入新密码"
          type="password"
          value={newPassword}
        />
      </label>
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      <AppButton disabled={!canSubmit} loading={pending} type="submit">
        修改密码
      </AppButton>
    </form>
  );
}

