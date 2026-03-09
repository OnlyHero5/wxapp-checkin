import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, setSession } from "../session/session-store";
import { ApiError, SessionExpiredError } from "./errors";
import { requestJson } from "./client";

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
      new Response(JSON.stringify({
        error_code: "session_expired",
        message: "会话失效，请重新登录",
        status: "forbidden"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 403
      })
    ));

    await expect(requestJson("/activities")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBe("");
  });
});
