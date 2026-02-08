const api = require("./api");
const storage = require("./storage");
const ui = require("./ui");

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

const ensureSession = async () => {
  const cached = storage.getSessionToken();
  if (cached) {
    if (!storage.getRole()) {
      storage.setRole("normal");
    }
    return cached;
  }
  try {
    const loginRes = await wxLogin();
    const data = await api.login(loginRes.code);
    if (data && data.session_token) {
      storage.setSessionToken(data.session_token);
      storage.setWxIdentity(data.wx_identity || "");
      applyLoginProfile(data);
      return data.session_token;
    }
  } catch (err) {
    ui.showToast("登录失败，请重试");
  }
  return "";
};

module.exports = {
  ensureSession
};
