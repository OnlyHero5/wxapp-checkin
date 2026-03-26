import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../features/auth/api";
import { AccountLoginForm } from "../../features/auth/components/AccountLoginForm";
import { saveAuthSession } from "../../shared/session/session-store";
import { MobilePage } from "../../shared/ui/MobilePage";

/**
 * Web 端登录页：账号密码入口。
 *
 * 业务约束：
 * - 账号口径：学号 student_id
 * - 密码直接沿用当前可用口径
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "登录失败，请稍后重试。";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(input: { student_id: string; password: string }) {
    setPending(true);
    setErrorMessage("");

    try {
      const result = await login(input);
      // 登录完成时把 token、角色、权限和用户资料一起写入，后续路由守卫直接复用。
      saveAuthSession(result);
      navigate("/activities");
    } catch (error) {
      // 其他错误统一回显到登录面板，由用户自行重试。
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobilePage
      description="账号为学号，请输入当前可用密码。"
      eyebrow="欢迎回来"
      tone="brand"
      title="登录"
    >
      <AccountLoginForm errorMessage={errorMessage} onSubmit={handleSubmit} pending={pending} />
    </MobilePage>
  );
}
