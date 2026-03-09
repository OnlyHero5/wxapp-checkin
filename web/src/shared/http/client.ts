import { clearSession, getSession } from "../session/session-store";
import { ApiError, NetworkError, SessionExpiredError } from "./errors";

/**
 * 当前阶段只需要 GET / POST 两种方法，
 * 先收窄类型可以减少误用。
 */
type HttpMethod = "GET" | "POST";

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: HttpMethod;
};

type ApiResponse = {
  error_code?: string;
  message?: string;
  status?: string;
  [key: string]: unknown;
};

function isSessionExpired(payload: ApiResponse) {
  // `session_expired` 是当前 Web 端最关键的统一错误信号。
  return `${payload.error_code ?? ""}`.trim().toLowerCase() === "session_expired";
}

async function parseResponsePayload(response: Response) {
  try {
    // 无论成功还是失败，只要是 JSON 响应都尽量交给统一错误归一化继续处理。
    return (await response.json()) as ApiResponse;
  } catch {
    // 非 2xx 且无法解析 JSON，通常意味着网关错误页或反向代理异常。
    if (!response.ok) {
      throw new ApiError("服务响应异常，请稍后重试", {
        payload: {
          status_code: response.status
        }
      });
    }

    // 2xx 却非 JSON，说明服务端契约已经与前端预期脱节，按网络异常处理更安全。
    throw new NetworkError("服务响应异常，请稍后重试");
  }
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const sessionToken = getSession();
  const method = options.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(`/api/web${path}`, {
      method,
      headers: {
        // 统一在这一层注入会话，页面和 API 封装层不必各自重复拼 Authorization。
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...options.headers
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    // 真正的网络失败（断网、DNS、跨域失败等）统一走 NetworkError。
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  const payload = await parseResponsePayload(response);
  if (isSessionExpired(payload)) {
    // 只要服务端明确说会话失效，就立刻清本地 token，避免继续带着脏会话请求。
    clearSession();
    throw new SessionExpiredError(payload.message, payload);
  }

  if (!response.ok) {
    // 先按 HTTP 失败兜底，再让页面根据 `error.code` 自行翻译业务文案。
    throw new ApiError(payload.message ?? "请求失败", {
      code: payload.error_code,
      payload,
      status: payload.status
    });
  }

  if (payload.status && payload.status !== "success") {
    // 兼容“HTTP 200 + 业务状态失败”的接口风格。
    throw new ApiError(payload.message ?? "请求失败", {
      code: payload.error_code,
      payload,
      status: payload.status
    });
  }

  // 成功时直接返回 payload，由各业务模块按自己的类型消费。
  return payload as T;
}
