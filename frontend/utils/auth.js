const api = require("./api");
const storage = require("./storage");
const ui = require("./ui");
const config = require("./config");

const wxLogin = () => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
};

const applyLoginProfile = (data) => {
  const profile = (data && data.user_profile) || {};
  const role = (data && data.role) || "normal";
  const permissions = (data && data.permissions) || [];
  const hasExplicitRegisterFlag = data && Object.prototype.hasOwnProperty.call(data, "is_registered");
  const isRegistered = hasExplicitRegisterFlag
    ? !!data.is_registered
    : !!(profile.student_id && profile.name);

  storage.setRole(role);
  storage.setPermissions(permissions);

  if (isRegistered) {
    storage.setStudentId(profile.student_id || "");
    storage.setName(profile.name || "");
    storage.setDepartment(profile.department || "");
    storage.setClub(profile.club || "");
  } else {
    storage.setStudentId("");
    storage.setName("");
    storage.setDepartment("");
    storage.setClub("");
  }
  storage.setAvatarUrl(profile.avatar_url || "");
  storage.setSocialScore(profile.social_score || 0);
  storage.setLectureScore(profile.lecture_score || 0);
  storage.setBound(isRegistered);
};

const clearSession = () => {
  storage.clearAuthState();
};

const isLoopbackBaseUrl = () => {
  if (config.mock) {
    return false;
  }
  const rawBaseUrl = `${config.baseUrl || ""}`.trim();
  if (!rawBaseUrl) {
    return false;
  }

  let normalized = rawBaseUrl;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch (err) {
    return false;
  }
};

const resolveLoginFailTip = (data, err) => {
  if (isLoopbackBaseUrl()) {
    return "真机无法访问 127.0.0.1，请改为局域网IP或HTTPS域名";
  }
  const dataMessage = `${(data && data.message) || ""}`.trim();
  if (dataMessage) {
    return dataMessage;
  }
  const errMessage = `${(err && err.errMsg) || (err && err.message) || ""}`.trim();
  if (errMessage) {
    return `登录失败：${errMessage}`;
  }
  return "登录失败，请重试";
};

const performLogin = async (options = {}) => {
  const { silent = false } = options;
  try {
    const loginRes = await wxLogin();
    const data = await api.login(loginRes.code);
    if (data && data.session_token) {
      storage.setSessionToken(data.session_token);
      storage.setWxIdentity(data.wx_identity || "");
      applyLoginProfile(data);
      return data.session_token;
    }
    if (!silent) {
      ui.showToast(resolveLoginFailTip(data, null));
    }
  } catch (err) {
    if (!silent) {
      ui.showToast(resolveLoginFailTip(null, err));
    }
  }
  return "";
};

const ensureSession = async (options = {}) => {
  const { forceRefresh = false, silent = false } = options;
  const cached = storage.getSessionToken();
  if (cached && !forceRefresh) {
    if (!storage.getRole()) {
      storage.setRole("normal");
    }
    return cached;
  }
  if (forceRefresh) {
    storage.setSessionToken("");
  }
  return performLogin({ silent });
};

module.exports = {
  ensureSession,
  clearSession
};
