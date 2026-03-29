import { useState } from "react";
import { Form, FormItem, Input } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";
import { InlineNotice } from "../../../shared/ui/InlineNotice";

/**
 * Web 端账号密码登录表单。
 *
 * 组件职责继续收敛在“输入与提交”：
 * 1. 采集最小必要字段；
 * 2. 复用组件库校验能力；
 * 3. 把规范化后的结果交给页面层，不在这里掺请求和跳转。
 */
type AccountLoginFormProps = {
  errorMessage?: string;
  onSubmit: (input: { student_id: string; password: string }) => Promise<void> | void;
  pending?: boolean;
};

function normalizeText(value: string) {
  return value.trim();
}

const loginRules = {
  password: [
    {
      message: "请输入密码",
      required: true
    },
    {
      message: "请输入密码",
      validator: (value: unknown) => normalizeText(`${value ?? ""}`).length > 0
    }
  ],
  student_id: [
    {
      message: "请输入学号",
      required: true
    },
    {
      message: "请输入学号",
      validator: (value: unknown) => normalizeText(`${value ?? ""}`).length > 0
    }
  ]
};

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

  async function handleFormSubmit(context: { validateResult: unknown }) {
    if (context.validateResult !== true || !canSubmit) {
      return;
    }

    await handleSubmit();
  }

  /**
   * 登录页这一轮要收口成“一张主卡”：
   * - 外层 panel 负责便当主卡视觉；
   * - 内层 form 只保留输入与校验，不再自己冒充另一张卡；
   * - 错误提示继续放在主卡内，避免登录失败时视觉焦点跳走。
   */

  return (
    <section className="account-login-form account-login-form__panel" data-panel-tone="brand">
      <header className="account-login-form__hero">
        <p className="account-login-form__eyebrow">账号登录</p>
        <div className="account-login-form__hero-copy">
          <h2 className="account-login-form__title">使用学号与密码继续</h2>
          <p className="account-login-form__description">登录成功后会沿用当前会话写入逻辑，不改动现有鉴权流程。</p>
        </div>
      </header>
      {/* 必须阻止浏览器原生 submit，避免移动端把学号和密码直接拼进 URL。 */}
      <Form
        className="account-login-form__form"
        labelAlign="top"
        onSubmit={(context) => void handleFormSubmit(context)}
        preventSubmitDefault
        scrollToFirstError="auto"
      >
        <FormItem label="学号" name="student_id" rules={loginRules.student_id}>
          <Input
            autocomplete="username"
            clearable
            maxlength={20}
            name="student_id"
            onChange={(value) => setStudentId(`${value ?? ""}`)}
            placeholder="请输入学号…"
            spellcheck={false}
            type="tel"
            value={studentId}
          />
        </FormItem>
        <FormItem label="密码" name="password" rules={loginRules.password}>
          <Input
            autocomplete="current-password"
            name="password"
            onChange={(value) => setPassword(`${value ?? ""}`)}
            placeholder="请输入密码…"
            spellcheck={false}
            type="password"
            value={password}
          />
        </FormItem>
        <AppButton disabled={!canSubmit} loading={pending} type="submit">
          登录
        </AppButton>
      </Form>
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
    </section>
  );
}
