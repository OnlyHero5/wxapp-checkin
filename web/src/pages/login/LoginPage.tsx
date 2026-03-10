import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { completePasskeyLogin, getLoginOptions } from "../../features/auth/api";
import { PasskeyLoginPanel } from "../../features/auth/components/PasskeyLoginPanel";
import { getPasskeyAssertion } from "../../features/auth/webauthn";
import { detectBrowserCapability } from "../../shared/device/browser-capability";
import { ApiError } from "../../shared/http/errors";
import { saveAuthSession } from "../../shared/session/session-store";
import { MobilePage } from "../../shared/ui/MobilePage";
import { UnsupportedBrowser } from "../../shared/ui/UnsupportedBrowser";

/**
 * 登录页承担“已绑定用户回到业务态”的入口职责。
 *
 * 它的控制流程是：
 * 1. 先看浏览器是否满足 Passkey 基线
 * 2. 用户点击后请求登录 challenge
 * 3. 浏览器完成 assertion
 * 4. 后端校验 assertion 并签发业务会话
 * 5. 成功后进入活动列表
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "登录失败，请稍后重试。";
}

export function LoginPage() {
  const navigate = useNavigate();
  // 能力探测放在页面最外层，避免不支持环境继续走无意义的登录请求。
  const capability = detectBrowserCapability();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleLogin() {
    // 每次发起新登录前，先重置旧错误，避免用户看到过期提示。
    setPending(true);
    setErrorMessage("");

    try {
      // 第一步：向后端申请本次登录专属 challenge。
      const loginOptions = await getLoginOptions();
      // 第二步：调浏览器原生 Passkey API。
      const assertionResponse = await getPasskeyAssertion(loginOptions.public_key_options);
      // 第三步：把 assertion 交回后端换业务会话。
      const completeResult = await completePasskeyLogin({
        assertion_response: assertionResponse,
        request_id: loginOptions.request_id
      });

      // 登录完成时把 token、角色和权限一起写入，后续路由守卫直接复用。
      saveAuthSession(completeResult);
      navigate("/activities");
    } catch (error) {
      // 当前浏览器没绑定过 Passkey 时，直接引导去绑定页，比停留错误文案更符合主链路。
      if (error instanceof ApiError && error.code === "passkey_not_registered") {
        navigate("/bind");
        return;
      }

      // 其他错误统一回显到登录面板，由用户自行重试。
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  // 浏览器不满足能力要求时，整个登录表单都没有继续展示的意义。
  if (!capability.hasPasskeySupport) {
    return <UnsupportedBrowser />;
  }

  return (
    <MobilePage eyebrow="欢迎回来" title="登录">
      {/* 这里故意强调“本机登录”，让用户知道当前链路与设备/浏览器绑定有关。 */}
      <p>使用你已注册的 Passkey 完成本机登录，成功后会直接进入活动列表。</p>
      <PasskeyLoginPanel errorMessage={errorMessage} onSubmit={handleLogin} pending={pending} />
    </MobilePage>
  );
}
