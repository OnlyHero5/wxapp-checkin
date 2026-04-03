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
   * 登录页这一轮继续沿用 Task 6 计划里的 `account-login-form__card` 钩子：
   * - 页面测试和样式都依赖这层主卡语义，后续不要再随意改名；
   * - 内层 form 只负责字段采集、trim 和提交，不承担“再造一张卡”的职责；
   * - 错误提示仍留在同一张卡里，这样登录失败后用户视线不会从输入区跳走。
   */

  return (
    <section className="account-login-form account-login-form__card" data-panel-tone="brand">
      <header className="account-login-form__hero">
        <p className="account-login-form__eyebrow">账号登录</p>
        <div className="account-login-form__hero-copy">
          <h2 className="account-login-form__title">使用学号与密码继续</h2>
          <p className="account-login-form__description">登录后即可查看活动并完成签到或签退。</p>
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
        {/* 学号输入仍保留浏览器可识别的 `username` 语义，方便密码管理器自动填充。 */}
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
        {/* 密码字段继续走 `current-password`，确保现有登录链路不因布局重构丢失浏览器能力。 */}
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
