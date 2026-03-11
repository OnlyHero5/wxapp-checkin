/**
 * 统一错误对象的目的不是“搞一套复杂异常体系”，
 * 而是让页面层可以稳定地区分：
 * - 业务失败
 * - 会话失效
 * - 网络失败
 */
export class ApiError extends Error {
  code: string;
  payload: unknown;
  status: string;

  constructor(message: string, options: { code?: string; payload?: unknown; status?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "api_error";
    this.payload = options.payload;
    this.status = options.status ?? "error";
  }
}

/**
 * 会话失效是 Web 应用里最常见也最需要统一处理的一类错误，
 * 单独拎出子类可以让页面写分支更直观。
 */
export class SessionExpiredError extends ApiError {
  constructor(message = "会话失效，请重新登录", payload?: unknown) {
    super(message, {
      code: "session_expired",
      payload,
      status: "forbidden"
    });
    this.name = "SessionExpiredError";
  }
}

/**
 * 强制改密是 Web 端账号密码登录引入的新门槛：
 * - 登录成功后若 must_change_password=true，则除了改密接口外的业务接口都会被拒绝
 * - 前端收到该错误时应统一引导用户去 /change-password
 */
export class PasswordChangeRequiredError extends ApiError {
  constructor(message = "请先修改密码", payload?: unknown) {
    super(message, {
      code: "password_change_required",
      payload,
      status: "forbidden"
    });
    this.name = "PasswordChangeRequiredError";
  }
}

/**
 * `NetworkError` 代表“前端没拿到可信响应”，
 * 不等同于业务失败。
 */
export class NetworkError extends Error {
  constructor(message = "网络异常，请稍后重试") {
    super(message);
    this.name = "NetworkError";
  }
}
