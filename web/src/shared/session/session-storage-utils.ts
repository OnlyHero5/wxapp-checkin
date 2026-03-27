export const SESSION_STORAGE_KEY = "session_token";
export const SESSION_CONTEXT_STORAGE_KEY = "session_context";

export type SessionUserProfile = {
  club?: string;
  department?: string;
  name?: string;
  student_id?: string;
};

export type StoredSessionContext = {
  permissions?: string[];
  role?: string;
  user_profile?: SessionUserProfile;
};

/**
 * 访问本地存储前先做安全封装。
 *
 * 这样可以兼容：
 * - SSR / 测试环境没有 `window`
 * - 隐私模式 / WebView 禁止访问 localStorage
 * - 浏览器策略导致 getter 直接抛错
 */
export function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeSessionToken(value: string | null | undefined) {
  // 统一 trim，避免“存进去有空格、取出来匹配不上”的隐蔽问题。
  return `${value ?? ""}`.trim();
}

function normalizeRole(value: string | null | undefined) {
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized || "normal";
}

function normalizePermissions(value: string[] | null | undefined) {
  return (value ?? []).map((item) => `${item ?? ""}`.trim()).filter(Boolean);
}

export function readSessionContext(storage: Storage | null) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(SESSION_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSessionContext;
    return {
      permissions: normalizePermissions(parsed.permissions),
      role: normalizeRole(parsed.role),
      user_profile: parsed.user_profile
    } satisfies StoredSessionContext;
  } catch {
    return null;
  }
}

export function writeSessionContext(storage: Storage | null, context: StoredSessionContext | null) {
  if (!storage) {
    return;
  }

  try {
    if (!context) {
      storage.removeItem(SESSION_CONTEXT_STORAGE_KEY);
      return;
    }

    storage.setItem(
      SESSION_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        permissions: normalizePermissions(context.permissions),
        role: normalizeRole(context.role),
        user_profile: context.user_profile ?? null
      })
    );
  } catch {
    return;
  }
}
