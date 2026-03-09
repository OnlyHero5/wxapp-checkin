export type BrowserCapability = {
  hasCredentialManager: boolean;
  hasPasskeySupport: boolean;
  hasVisibilityLifecycle: boolean;
  hasWakeLock: boolean;
};

/**
 * 统一封装浏览器能力探测。
 *
 * 之所以不让页面直接写 `window.PublicKeyCredential` 等判断，
 * 是因为能力判断的细节会随着产品口径变化而调整：
 * 例如当前我们把“存在平台认证器可用性检查方法”视为 Passkey 基线的一部分。
 */
export function detectBrowserCapability(): BrowserCapability {
  const publicKeyCredential =
    typeof window !== "undefined" ? window.PublicKeyCredential : undefined;
  const hasCredentialManager =
    typeof navigator !== "undefined"
    && !!navigator.credentials
    && typeof navigator.credentials.create === "function"
    && typeof navigator.credentials.get === "function";
  const hasPlatformAuthenticatorCheck =
    typeof publicKeyCredential === "function"
    && typeof publicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";

  return {
    hasCredentialManager,
    // 这里只表示“满足当前前端基线”，不承诺设备上一定已经绑定过 Passkey。
    hasPasskeySupport: hasCredentialManager && hasPlatformAuthenticatorCheck,
    hasVisibilityLifecycle: typeof document !== "undefined" && typeof document.visibilityState === "string",
    hasWakeLock: typeof navigator !== "undefined" && !!navigator.wakeLock
  };
}
