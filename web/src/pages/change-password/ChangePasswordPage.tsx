import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { changePassword } from "../../features/auth/api";
import { ChangePasswordForm } from "../../features/auth/components/ChangePasswordForm";
import { SessionExpiredError } from "../../shared/http/errors";
import { setMustChangePassword } from "../../shared/session/session-store";
import { MobilePage } from "../../shared/ui/MobilePage";

/**
 * 强制改密页。
 *
 * 这页的存在不是为了“做一个设置页”，而是为了配合后端的统一拦截策略：
 * - 当 must_change_password=true 时，除改密接口外的所有业务接口都会返回 password_change_required
 * - 前端路由守卫会把用户强制导流到这里
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "密码修改失败，请稍后重试。";
}

function isSelfServicePasswordChange(search: string) {
  return new URLSearchParams(search).get("mode") === "self-service";
}

export function ChangePasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const selfServiceMode = isSelfServicePasswordChange(location.search);

  async function handleSubmit(input: { old_password: string; new_password: string }) {
    setPending(true);
    setErrorMessage("");

    try {
      const result = await changePassword(input);
      // 后端改密成功后会解除强制改密标记，这里同步更新到本地存储，避免路由守卫继续拦截。
      setMustChangePassword(!!result.must_change_password);
      // 自助改密返回个人中心，强制改密继续回业务首页。
      navigate(selfServiceMode ? "/profile" : "/activities");
    } catch (error) {
      // 会话失效时不继续停留在改密页，直接回登录入口。
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobilePage
      description={selfServiceMode ? "你可以在这里主动更新密码，修改成功后会返回个人中心。" : "为了保障账号安全，请先修改密码后再进入业务页面。"}
      eyebrow={selfServiceMode ? "账户安全" : "首次登录"}
      tone="brand"
      title="修改密码"
    >
      <ChangePasswordForm errorMessage={errorMessage} onSubmit={handleSubmit} pending={pending} />
    </MobilePage>
  );
}
