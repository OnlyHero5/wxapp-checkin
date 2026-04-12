import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, setSession } from "../session/session-store";
import { ApiError, NetworkError, SessionExpiredError } from "./errors";
import { requestJson } from "./client";

function createJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
}

describe("requestJson", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("throws ApiError for non-2xx JSON responses even when payload omits status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        message: "服务端异常"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 500
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError when the server returns a non-JSON response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>bad gateway</html>", {
        headers: {
          "Content-Type": "text/html"
        },
        status: 502
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(ApiError);
  });

  it("clears the local session when the backend reports session_expired", async () => {
    setSession("sess_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      createJsonResponse({
        error_code: "session_expired",
        message: "会话失效，请重新登录",
        status: "forbidden"
      }, {
        status: 403
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBe("");
  });

  it("also clears the local session when the backend reports account_disabled", async () => {
    setSession("sess_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      createJsonResponse({
        error_code: "account_disabled",
        message: "账号已停用，请联系管理员",
        status: "forbidden"
      }, {
        status: 403
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBe("");
  });

  it("keeps the local session for non-session business errors", async () => {
    setSession("sess_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      createJsonResponse({
        error_code: "invalid_activity",
        message: "活动不存在或已下线",
        status: "forbidden"
      }, {
        status: 404
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(ApiError);
    expect(getSession()).toBe("sess_123");
  });

  it("reuses the same inflight GET request for identical paths", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstRequest = requestJson("/activities");
    const secondRequest = requestJson("/activities");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(createJsonResponse({
      activities: [],
      status: "success"
    }, {
      status: 200
    }));

    await expect(firstRequest).resolves.toEqual({
      activities: [],
      status: "success"
    });
    await expect(secondRequest).resolves.toEqual({
      activities: [],
      status: "success"
    });
  });

  it("does not merge inflight GET requests when headers differ", async () => {
    /**
     * staff 动态码刷新必须每次都直达后端拿最新 slot，
     * 因此只要调用方显式换了刷新标签，就不能再复用旧 Promise。
     */
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse({
        status: "success",
        value: "first"
      }, {
        status: 200
      }))
      .mockResolvedValueOnce(createJsonResponse({
        status: "success",
        value: "second"
      }, {
        status: 200
      }));
    vi.stubGlobal("fetch", fetchMock);

    const firstRequest = requestJson("/activities", {
      headers: {
        "X-Refresh-Nonce": "req-1"
      }
    });
    const secondRequest = requestJson("/activities", {
      headers: {
        "X-Refresh-Nonce": "req-2"
      }
    });

    await expect(firstRequest).resolves.toEqual({
      status: "success",
      value: "first"
    });
    await expect(secondRequest).resolves.toEqual({
      status: "success",
      value: "second"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("injects the Authorization header into requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      status: "success"
    }, {
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);

    setSession("sess_auth_123");

    await requestJson("/activities");

    expect(fetchMock).toHaveBeenCalledWith("/api/web/activities", expect.objectContaining({
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer sess_auth_123"
      }),
      method: "GET"
    }));
  });

  it("clears locally expired sessions before sending another request", async () => {
    window.localStorage.setItem("session_token", "sess_auth_123");
    window.localStorage.setItem("session_context", JSON.stringify({
      role: "staff",
      session_expires_at: Date.now() - 1000
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts slow requests after the configured timeout with a stable NetworkError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, {
          once: true
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const requestPromise = requestJson("/activities", {
      timeoutMs: 10
    });
    const assertion = expect(requestPromise).rejects.toEqual(new NetworkError("请求超时，请稍后重试"));

    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps caller-triggered aborts to a stable NetworkError", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, {
          once: true
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const requestPromise = requestJson("/activities", {
      signal: controller.signal,
      timeoutMs: 1000
    });
    const assertion = expect(requestPromise).rejects.toEqual(new NetworkError("请求已取消，请稍后重试"));

    controller.abort();

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
