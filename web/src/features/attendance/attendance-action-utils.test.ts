import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/http/errors";
import {
  isActionAllowed,
  resolveActionTitle,
  resolveConsumeError,
  resolveInputLabel,
  resolveResultTitle,
  resolveSubmitText,
  resolveActionTone
} from "./attendance-action-utils";

describe("attendance-action-utils", () => {
  it("maps action copy and tone consistently for checkin and checkout", () => {
    expect(resolveActionTitle("checkin")).toBe("活动签到");
    expect(resolveActionTitle("checkout")).toBe("活动签退");
    expect(resolveInputLabel("checkin")).toBe("签到验证码");
    expect(resolveInputLabel("checkout")).toBe("签退验证码");
    expect(resolveSubmitText("checkin")).toBe("提交签到码");
    expect(resolveSubmitText("checkout")).toBe("提交签退码");
    expect(resolveResultTitle("checkin")).toBe("签到结果");
    expect(resolveResultTitle("checkout")).toBe("签退结果");
    expect(resolveActionTone("checkin")).toBe("checkin");
    expect(resolveActionTone("checkout")).toBe("checkout");
  });

  it("maps high-frequency consume errors to clear Chinese guidance", () => {
    expect(resolveConsumeError(new ApiError("错码", { code: "invalid_code", status: "forbidden" }))).toBe(
      "验证码错误，请重新确认"
    );
    expect(resolveConsumeError(new ApiError("过期", { code: "expired", status: "forbidden" }))).toBe(
      "验证码已过期，请重新输入最新验证码"
    );
    expect(resolveConsumeError(new ApiError("重复", { code: "duplicate", status: "forbidden" }))).toBe(
      "当前时段已提交，请勿重复操作"
    );
    expect(resolveConsumeError(new Error("网络异常"))).toBe("网络异常");
  });

  it("delegates action availability to the matching activity state flag", () => {
    expect(isActionAllowed({ can_checkin: true, can_checkout: false } as never, "checkin")).toBe(true);
    expect(isActionAllowed({ can_checkin: true, can_checkout: false } as never, "checkout")).toBe(false);
  });
});
