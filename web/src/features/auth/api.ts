import { requestJson } from "../../shared/http/client";

/**
 * 绑定/登录链路里需要在多个接口之间复用用户基本信息，
 * 因此把用户画像字段抽成独立类型，避免每个响应各写一份。
 */
export type UserProfile = {
  // 社团字段是可选信息，不是所有实名源都会稳定返回。
  club?: string;
  // 学院/部门用于后续详情展示或管理员判定，阶段性可能为空。
  department?: string;
  name: string;
  student_id: string;
};

/**
 * 首次绑定时，前端提交的实名校验表单。
 */
export type VerifyIdentityInput = {
  name: string;
  student_id: string;
};

/**
 * 实名校验成功后，后端返回一次性 `bind_ticket`，
 * 用来串起“实名通过 -> 请求注册 challenge -> 完成注册”这条链路。
 */
export type VerifyIdentityResponse = {
  bind_ticket: string;
  bind_ticket_expire_at?: number;
  message: string;
  role_hint?: string;
  status: string;
  user_profile?: UserProfile;
};

/**
 * WebAuthn 注册 challenge 响应。
 *
 * `public_key_options` 基本透传给浏览器 API，
 * 但前端仍需要做 base64url / ArrayBuffer 结构转换。
 */
export type PasskeyRegisterOptionsResponse = {
  challenge_expires_at?: number;
  // 这个对象会原样送入浏览器原生 API，但在 webauthn.ts 内做结构标准化。
  public_key_options: Record<string, unknown>;
  request_id: string;
  rp_id?: string;
  rp_name?: string;
  status?: string;
  user_handle?: string;
};

/**
 * WebAuthn 登录 challenge 响应。
 */
export type PasskeyLoginOptionsResponse = {
  challenge_expires_at?: number;
  // 登录阶段 challenge 结构比注册更轻，但同样来自运行时 JSON。
  public_key_options: Record<string, unknown>;
  request_id: string;
  rp_id?: string;
  status?: string;
};

/**
 * 注册完成 / 登录完成都会拿到同一类会话响应，
 * 因此统一抽象成 `AuthSessionResponse`。
 */
export type AuthSessionResponse = {
  message?: string;
  // 权限集会在管理员页阶段继续使用，这里先保留字段。
  permissions?: string[];
  registered?: boolean;
  role?: string;
  session_expires_at?: number;
  session_token: string;
  status?: string;
  user_profile?: UserProfile;
};

/**
 * 注册完成请求体。
 *
 * `attestation_response` 是浏览器 `navigator.credentials.create()` 的序列化结果，
 * 不是后端原始 challenge 的回传，因此需要额外带上 `request_id` 和 `bind_ticket`
 * 让后端把“是谁发起、针对哪个 challenge、是否仍然有效”关联起来。
 */
export type RegisterCompleteInput = {
  attestation_response: Record<string, unknown>;
  bind_ticket: string;
  request_id: string;
};

/**
 * 登录完成请求体。
 */
export type LoginCompleteInput = {
  assertion_response: Record<string, unknown>;
  request_id: string;
};

// 下面几个方法只负责声明接口契约，不在此处掺杂页面导航或错误文案逻辑。
export function verifyIdentity(input: VerifyIdentityInput) {
  return requestJson<VerifyIdentityResponse>("/bind/verify-identity", {
    body: input,
    method: "POST"
  });
}

// 首绑流程第二步：申请 Passkey 注册 challenge。
export function getRegisterOptions(input: { bind_ticket: string }) {
  return requestJson<PasskeyRegisterOptionsResponse>("/passkey/register/options", {
    body: input,
    method: "POST"
  });
}

// 首绑流程第三步：把浏览器生成的 attestation 交给后端验签并换取会话。
export function completePasskeyRegistration(input: RegisterCompleteInput) {
  return requestJson<AuthSessionResponse>("/passkey/register/complete", {
    body: input,
    method: "POST"
  });
}

// 后续登录流程第一步：申请登录 challenge。
export function getLoginOptions() {
  return requestJson<PasskeyLoginOptionsResponse>("/passkey/login/options", {
    body: {},
    method: "POST"
  });
}

// 后续登录流程第二步：提交 assertion，后端成功后签发会话。
export function completePasskeyLogin(input: LoginCompleteInput) {
  return requestJson<AuthSessionResponse>("/passkey/login/complete", {
    body: input,
    method: "POST"
  });
}
