import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  completePasskeyRegistration,
  getRegisterOptions,
  verifyIdentity
} from "../../features/auth/api";
import { IdentityBindForm } from "../../features/auth/components/IdentityBindForm";
import { createPasskeyCredential } from "../../features/auth/webauthn";
import { detectBrowserCapability } from "../../shared/device/browser-capability";
import { setSession } from "../../shared/session/session-store";
import { MobilePage } from "../../shared/ui/MobilePage";
import { UnsupportedBrowser } from "../../shared/ui/UnsupportedBrowser";

/**
 * 绑定页承担“首次实名校验 + 当前浏览器注册 Passkey”的完整入口。
 *
 * 这条链路和登录页最大的区别是：
 * - 登录页假设用户已绑定，只做 assertion
 * - 绑定页需要先实名，再注册新凭据
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "身份绑定失败，请稍后重试。";
}

export function BindPage() {
  const navigate = useNavigate();
  // 注册 Passkey 同样依赖浏览器能力，因此绑定页也要做同一套前置守卫。
  const capability = detectBrowserCapability();
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(input: { name: string; student_id: string }) {
    // 进入新一轮绑定流程前清空旧错误，减少用户困惑。
    setPending(true);
    setErrorMessage("");

    try {
      // 第一步：实名校验，拿到一次性 bind_ticket。
      const verifyResult = await verifyIdentity(input);
      // 第二步：请求注册 challenge。
      const registerOptions = await getRegisterOptions({
        bind_ticket: verifyResult.bind_ticket
      });
      // 第三步：让浏览器生成 attestation。
      const attestationResponse = await createPasskeyCredential(registerOptions.public_key_options);
      // 第四步：交后端完成凭据注册并直接签发业务会话。
      const completeResult = await completePasskeyRegistration({
        attestation_response: attestationResponse,
        bind_ticket: verifyResult.bind_ticket,
        request_id: registerOptions.request_id
      });

      setSession(completeResult.session_token);
      navigate("/activities");
    } catch (error) {
      // 当前阶段统一把错误文案展示在表单下方，避免 toast 一闪而过。
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  // 绑定页不提供任何降级认证手段，不支持就是明确告知不可用。
  if (!capability.hasPasskeySupport) {
    return <UnsupportedBrowser />;
  }

  return (
    <MobilePage eyebrow="首次访问" title="身份绑定">
      {/* 这段提示的目标是把“实名校验”和“Passkey 注册”讲成一条连续动作。 */}
      <p>请先完成实名校验，再在当前手机浏览器注册 Passkey。</p>
      <IdentityBindForm errorMessage={errorMessage} onSubmit={handleSubmit} pending={pending} />
    </MobilePage>
  );
}
