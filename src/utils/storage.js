const KEYS = {
  sessionToken: "session_token",
  wxIdentity: "wx_identity",
  studentId: "student_id",
  name: "name",
  hasBound: "has_bound"
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
  isBound() {
    return !!get(KEYS.hasBound);
  },
  setBound(value) {
    set(KEYS.hasBound, value ? "1" : "");
  }
};

module.exports = storage;
