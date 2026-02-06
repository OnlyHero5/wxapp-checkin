const KEYS = {
  sessionToken: "session_token",
  wxIdentity: "wx_identity",
  studentId: "student_id",
  name: "name",
  hasBound: "has_bound",
  role: "user_role",
  permissions: "permissions",
  department: "department",
  club: "club",
  avatarUrl: "avatar_url",
  socialScore: "social_score",
  lectureScore: "lecture_score"
};

const get = (key) => {
  try {
    return wx.getStorageSync(key);
  } catch (err) {
    return "";
  }
};

const set = (key, value) => {
  try {
    wx.setStorageSync(key, value);
  } catch (err) {
    // ignore
  }
};

const getArray = (key) => {
  const value = get(key);
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

const normalizeScore = (value) => {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return 0;
  }
  return num;
};

const storage = {
  getSessionToken() {
    return get(KEYS.sessionToken);
  },
  setSessionToken(token) {
    set(KEYS.sessionToken, token);
  },
  getWxIdentity() {
    return get(KEYS.wxIdentity);
  },
  setWxIdentity(identity) {
    set(KEYS.wxIdentity, identity);
  },
  getStudentId() {
    return get(KEYS.studentId);
  },
  setStudentId(value) {
    set(KEYS.studentId, value);
  },
  getName() {
    return get(KEYS.name);
  },
  setName(value) {
    set(KEYS.name, value);
  },
  getRole() {
    return get(KEYS.role) || "normal";
  },
  setRole(value) {
    set(KEYS.role, value || "normal");
  },
  getPermissions() {
    return getArray(KEYS.permissions);
  },
  setPermissions(value) {
    set(KEYS.permissions, Array.isArray(value) ? value : []);
  },
  hasPermission(permission) {
    return this.getPermissions().includes(permission);
  },
  getDepartment() {
    return get(KEYS.department);
  },
  setDepartment(value) {
    set(KEYS.department, value);
  },
  getClub() {
    return get(KEYS.club);
  },
  setClub(value) {
    set(KEYS.club, value);
  },
  getAvatarUrl() {
    return get(KEYS.avatarUrl);
  },
  setAvatarUrl(value) {
    set(KEYS.avatarUrl, value);
  },
  getSocialScore() {
    return normalizeScore(get(KEYS.socialScore));
  },
  setSocialScore(value) {
    set(KEYS.socialScore, normalizeScore(value));
  },
  getLectureScore() {
    return normalizeScore(get(KEYS.lectureScore));
  },
  setLectureScore(value) {
    set(KEYS.lectureScore, normalizeScore(value));
  },
  isBound() {
    return !!get(KEYS.hasBound);
  },
  setBound(value) {
    set(KEYS.hasBound, value ? "1" : "");
  }
};

module.exports = storage;
