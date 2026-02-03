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

const ensureSession = async () => {
  const cached = storage.getSessionToken();
  if (cached) {
    return cached;
  }
  try {
    const loginRes = await wxLogin();
    const data = await api.login(loginRes.code);
    if (data && data.session_token) {
      storage.setSessionToken(data.session_token);
      storage.setWxIdentity(data.wx_identity || "");
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
