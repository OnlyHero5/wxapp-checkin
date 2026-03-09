const SESSION_STORAGE_KEY = "session_token";

/**
 * 访问本地存储前先做安全封装。
 *
 * 这样可以兼容：
 * - SSR / 测试环境没有 `window`
 * - 隐私模式 / WebView 禁止访问 localStorage
 * - 浏览器策略导致 getter 直接抛错
 */
function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeSessionToken(value: string | null | undefined) {
  // 统一 trim，避免“存进去有空格、取出来匹配不上”的隐蔽问题。
  return `${value ?? ""}`.trim();
}

export function getSession() {
  const storage = getStorage();
  if (!storage) {
    return "";
  }

  try {
    // 读取失败时直接视为“没有会话”，比让页面崩掉更可控。
    return normalizeSessionToken(storage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function setSession(sessionToken: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const normalized = normalizeSessionToken(sessionToken);
  if (!normalized) {
    try {
      // 传空值时统一按“清理会话”处理，避免本地残留空字符串。
      storage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      return;
    }
    return;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, normalized);
  } catch {
    // 存储失败时不抛错，让上层继续依赖内存中的当前渲染流程完成跳转。
    return;
  }
}

export function clearSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 清理失败时同样不抛错，避免“本来是要跳登录页，结果先崩页面”。
    return;
  }
}
