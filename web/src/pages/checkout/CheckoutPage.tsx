import { AttendanceActionPage } from "../checkin/CheckinPage";

/**
 * `CheckoutPage` 故意保持极薄。
 *
 * 这样签退页与签到页的差异只剩下动作类型本身，
 * 后续若要一起调整结果页或错误处理，不会出现两边逻辑分叉。
 */
export function CheckoutPage() {
  // 签退页复用同一套动作页逻辑，只切换 actionType。
  return <AttendanceActionPage actionType="checkout" />;
}
