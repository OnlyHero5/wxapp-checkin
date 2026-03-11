import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMustChangePassword, getSession, setSession } from "../session/session-store";
import { ApiError, PasswordChangeRequiredError, SessionExpiredError } from "./errors";
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

  it("marks must_change_password when the backend reports password_change_required", async () => {
    setSession("sess_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      createJsonResponse({
        error_code: "password_change_required",
        message: "请先修改密码",
        status: "forbidden"
      }, {
        status: 403
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(PasswordChangeRequiredError);
    expect(getMustChangePassword()).toBe(true);
    // 强制改密不是会话失效，因此不清理 token。
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
});
