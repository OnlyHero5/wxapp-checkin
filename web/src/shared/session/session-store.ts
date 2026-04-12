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

type SessionState = {
  context: ReturnType<typeof readSessionContext>;
  expiredLocally: boolean;
  token: string;
};

function isExpiredLocally(sessionExpiresAt?: number) {
  return typeof sessionExpiresAt === "number" && sessionExpiresAt <= Date.now();
}

function clearStoredSessionState(storage: Storage | null) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
    writeSessionContext(storage, null);
    // 兼容历史版本：曾经用于浏览器绑定的本地 key 仍可能残留，统一清掉避免误判。
    storage.removeItem("browser_binding_key");
  } catch {
    return;
  }
}

export function readSessionState(): SessionState {
  const storage = getStorage();
  if (!storage) {
    return {
      context: null,
      expiredLocally: false,
      token: ""
    };
  }

  try {
    const token = normalizeSessionToken(storage.getItem(SESSION_STORAGE_KEY));
    const context = readSessionContext(storage);
    if (!token) {
      return {
        context,
        expiredLocally: false,
        token: ""
      };
    }
    if (isExpiredLocally(context?.session_expires_at)) {
      clearStoredSessionState(storage);
      return {
        context: null,
        expiredLocally: true,
        token: ""
      };
    }
    return {
      context,
      expiredLocally: false,
      token
    };
  } catch {
    return {
      context: null,
      expiredLocally: false,
      token: ""
    };
  }
}

export function getSession() {
  return readSessionState().token;
}

export function setSession(sessionToken: string) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  const normalized = normalizeSessionToken(sessionToken);
  if (!normalized) {
    try {
      // 传空值时统一按“清理会话”处理，避免本地残留空字符串。
      storage.removeItem(SESSION_STORAGE_KEY);
      writeSessionContext(storage, null);
    } catch {
      return false;
    }
    return true;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, normalized);
    // 只写 token 的调用方视为“没有同步上下文”，避免遗留旧角色污染新会话。
    writeSessionContext(storage, null);
  } catch {
    return false;
  }

  return true;
}

type AuthSessionPayload = {
  permissions?: string[];
  role?: string;
  session_expires_at?: number;
  session_token: string;
  user_profile?: SessionUserProfile;
};

export function saveAuthSession(payload: AuthSessionPayload) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  const normalizedToken = normalizeSessionToken(payload.session_token);
  if (!normalizedToken) {
    clearSession();
    return false;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, normalizedToken);
    writeSessionContext(storage, {
      permissions: payload.permissions,
      role: payload.role,
      session_expires_at: payload.session_expires_at,
      user_profile: payload.user_profile
    });
  } catch {
    return false;
  }

  return true;
}

export function getSessionRole() {
  return readSessionState().context?.role ?? "normal";
}

export function getSessionPermissions() {
  return readSessionState().context?.permissions ?? [];
}

export function getSessionUserProfile() {
  return readSessionState().context?.user_profile ?? null;
}

export function getSessionProfileSnapshot(): SessionProfileSnapshot {
  const context = readSessionState().context;
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
  clearStoredSessionState(getStorage());
}
