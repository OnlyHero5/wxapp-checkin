import { useRef, useState } from "react";
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

const SESSION_PERSIST_ERROR_MESSAGE = "登录状态保存失败，请检查浏览器存储权限后重试。";

export function LoginPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const submitInFlightRef = useRef(false);

  async function handleSubmit(input: { student_id: string; password: string }) {
    // 登录页只协调请求生命周期；字段清洗和表单校验继续留在 `AccountLoginForm`。
    if (submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    setPending(true);
    setErrorMessage("");

    try {
      const result = await login(input);
      // 登录完成时把 token、角色、权限和用户资料一起写入，后续路由守卫直接复用。
      if (!saveAuthSession(result)) {
        setErrorMessage(SESSION_PERSIST_ERROR_MESSAGE);
        return;
      }
      navigate("/activities");
    } catch (error) {
      // 其他错误统一回显到登录面板，由用户自行重试。
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      submitInFlightRef.current = false;
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
      {/* 登录页只保留一个业务主卡，避免页面壳层和表单层各自再造一张卡。 */}
      <AccountLoginForm errorMessage={errorMessage} onSubmit={handleSubmit} pending={pending} />
    </MobilePage>
  );
}
