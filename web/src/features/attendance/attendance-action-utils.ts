import type {
  ActivityActionType,
  ActivityDetail
} from "../activities/api";
import { resolveCanCheckin, resolveCanCheckout } from "../activities/view-model";
import { ApiError } from "../../shared/http/errors";
import type { VisualTone } from "../../shared/ui/visual-tone";

/**
 * 动作页的标题、按钮、结果态文案都只围绕“签到 / 签退”两种语义变化。
 * 把这些映射抽到独立文件，可以避免页面组件继续被文案细节撑大。
 */
export const resolveActionTitle = (actionType: ActivityActionType) =>
  actionType === "checkout" ? "活动签退" : "活动签到";

export const resolveInputLabel = (actionType: ActivityActionType) =>
  actionType === "checkout" ? "签退验证码" : "签到验证码";

export const resolveSubmitText = (actionType: ActivityActionType) =>
  actionType === "checkout" ? "提交签退码" : "提交签到码";

export const resolveResultTitle = (actionType: ActivityActionType) =>
  actionType === "checkout" ? "签退结果" : "签到结果";

export const resolveActionTone = (actionType: ActivityActionType): Extract<VisualTone, "checkin" | "checkout"> =>
  actionType === "checkout" ? "checkout" : "checkin";

/**
 * 动态码错误码需要直接翻译成用户能理解的中文，而不是把后端 code 暴露到界面。
 */
export function resolveConsumeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "invalid_code") {
      return "验证码错误，请重新确认";
    }
    if (error.code === "expired") {
      return "验证码已过期，请重新输入最新验证码";
    }
    if (error.code === "duplicate") {
      return "当前时段已提交，请勿重复操作";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "提交失败，请稍后重试。";
}

/**
 * 页面层只关心“现在能不能做这件事”，具体判断仍交给活动状态 view-model。
 */
export const isActionAllowed = (detail: ActivityDetail, actionType: ActivityActionType) =>
  actionType === "checkout" ? resolveCanCheckout(detail) : resolveCanCheckin(detail);
