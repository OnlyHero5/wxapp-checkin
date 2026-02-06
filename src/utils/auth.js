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

  storage.setRole(role);
  storage.setPermissions(permissions);

  if (profile.student_id) {
    storage.setStudentId(profile.student_id);
  }
  if (profile.name) {
    storage.setName(profile.name);
  }
  if (profile.department) {
    storage.setDepartment(profile.department);
  }
  if (profile.club) {
    storage.setClub(profile.club);
  }
  if (profile.avatar_url) {
    storage.setAvatarUrl(profile.avatar_url);
  }
  storage.setSocialScore(profile.social_score || 0);
  storage.setLectureScore(profile.lecture_score || 0);

  if (storage.getStudentId() && storage.getName()) {
    storage.setBound(true);
  }
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
