import {
  getStorage,
  normalizeSessionToken,
  readSessionContext,
  SESSION_STORAGE_KEY,
  type SessionUserProfile,
  writeSessionContext
} from "./session-storage-utils";

export type SessionProfileSnapshot = {
  permissions: string[];
  role: string;
  user_profile: SessionUserProfile | null;
};

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

export function getSessionProfileSnapshot(): SessionProfileSnapshot {
  const context = readSessionContext(getStorage());
  return {
    permissions: context?.permissions ?? [],
    role: context?.role ?? "normal",
    user_profile: context?.user_profile ?? null
  };
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
