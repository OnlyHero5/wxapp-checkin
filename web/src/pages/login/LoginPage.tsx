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
 * - 默认密码：123
 * - 首次登录成功后必须改密（后端会返回 must_change_password=true）
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
      // 登录完成时把 token、角色、权限以及“是否强制改密”一起写入，后续路由守卫直接复用。
      saveAuthSession(result);
      if (result.must_change_password) {
        navigate("/change-password");
        return;
      }
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
      description="账号为学号，初始密码统一为 123。首次登录成功后需要先修改密码。"
      eyebrow="欢迎回来"
      title="登录"
    >
      <AccountLoginForm errorMessage={errorMessage} onSubmit={handleSubmit} pending={pending} />
    </MobilePage>
  );
}
