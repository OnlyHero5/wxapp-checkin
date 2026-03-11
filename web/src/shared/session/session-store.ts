const SESSION_STORAGE_KEY = "session_token";
const SESSION_CONTEXT_STORAGE_KEY = "session_context";

type SessionUserProfile = {
  club?: string;
  department?: string;
  name?: string;
  student_id?: string;
};

type StoredSessionContext = {
  must_change_password?: boolean;
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

function normalizeRole(value: string | null | undefined) {
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized || "normal";
}

function normalizePermissions(value: string[] | null | undefined) {
  return (value ?? []).map((item) => `${item ?? ""}`.trim()).filter(Boolean);
}

function normalizeMustChangePassword(value: unknown) {
  // 强制改密是布尔开关，只接受严格 boolean，其它类型一律视为 false，避免脏数据把用户锁死。
  return value === true;
}

function readSessionContext(storage: Storage | null) {
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
      must_change_password: normalizeMustChangePassword(parsed.must_change_password),
      permissions: normalizePermissions(parsed.permissions),
      role: normalizeRole(parsed.role),
      user_profile: parsed.user_profile
    } satisfies StoredSessionContext;
  } catch {
    return null;
  }
}

function writeSessionContext(storage: Storage | null, context: StoredSessionContext | null) {
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
        must_change_password: normalizeMustChangePassword(context.must_change_password),
        permissions: normalizePermissions(context.permissions),
        role: normalizeRole(context.role),
        user_profile: context.user_profile ?? null
      })
    );
  } catch {
    return;
  }
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
      writeSessionContext(storage, null);
    } catch {
      return;
    }
    return;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, normalized);
    // 只写 token 的调用方视为“没有同步上下文”，避免遗留旧角色污染新会话。
    writeSessionContext(storage, null);
  } catch {
    // 存储失败时不抛错，让上层继续依赖内存中的当前渲染流程完成跳转。
    return;
  }
}

type AuthSessionPayload = {
  must_change_password?: boolean;
  permissions?: string[];
  role?: string;
  session_token: string;
  user_profile?: SessionUserProfile;
};

export function saveAuthSession(payload: AuthSessionPayload) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const normalizedToken = normalizeSessionToken(payload.session_token);
  if (!normalizedToken) {
    clearSession();
    return;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, normalizedToken);
    writeSessionContext(storage, {
      must_change_password: payload.must_change_password,
      permissions: payload.permissions,
      role: payload.role,
      user_profile: payload.user_profile
    });
  } catch {
    return;
  }
}

export function getSessionRole() {
  return readSessionContext(getStorage())?.role ?? "normal";
}

export function getSessionPermissions() {
  return readSessionContext(getStorage())?.permissions ?? [];
}

export function getSessionUserProfile() {
  return readSessionContext(getStorage())?.user_profile ?? null;
}

export function getMustChangePassword() {
  return readSessionContext(getStorage())?.must_change_password ?? false;
}

export function setMustChangePassword(value: boolean) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const existing = readSessionContext(storage) ?? {};
    writeSessionContext(storage, {
      ...existing,
      must_change_password: value
    });
  } catch {
    return;
  }
}

export function hasSessionPermission(permission: string) {
  const normalizedPermission = `${permission ?? ""}`.trim();
  if (!normalizedPermission) {
    return false;
  }
  return getSessionPermissions().includes(normalizedPermission);
}

export function isStaffSession() {
  return getSessionRole() === "staff" || hasSessionPermission("activity:manage");
}

export function clearSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
    writeSessionContext(storage, null);
    // 兼容历史版本：曾经用于浏览器绑定的本地 key 仍可能残留，统一清掉避免误判。
    storage.removeItem("browser_binding_key");
  } catch {
    // 清理失败时同样不抛错，避免“本来是要跳登录页，结果先崩页面”。
    return;
  }
}
