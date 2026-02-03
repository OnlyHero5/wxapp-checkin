const config = require("./config");
const storage = require("./storage");

const mockStore = {
  activity: {
    activity_title: "极简科技签到日",
    description: "基于滚动二维码的现场签到",
    qr_expire_seconds: 10
  },
  records: []
};

const formatTime = (date) => {
  const pad = (num) => (num < 10 ? `0${num}` : `${num}`);
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${mm}:${s}`;
};

const mockRequest = (url, data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (url === "/api/auth/wx-login") {
        resolve({
          wx_identity: "wx_mock_identity",
          session_token: `mock_${Date.now()}`
        });
        return;
      }
      if (url === "/api/register") {
        resolve({ status: "success", message: "绑定成功" });
        return;
      }
      if (url === "/api/checkin/verify") {
        const qrToken = data.qr_token || "";
        if (!qrToken || qrToken.toUpperCase().includes("EXPIRED")) {
          resolve({ status: "invalid_qr", message: "二维码已失效" });
          return;
        }
        if (qrToken.toUpperCase().includes("DUP")) {
          resolve({ status: "duplicate", message: "已签到" });
          return;
        }
        if (data.student_id === "0000") {
          resolve({ status: "identity_mismatch", message: "身份不匹配" });
          return;
        }
        const recordId = `rec_${Date.now()}`;
        mockStore.records.unshift({
          record_id: recordId,
          time: formatTime(new Date()),
          location: "线上签到",
          activity_title: mockStore.activity.activity_title,
          description: mockStore.activity.description
        });
        resolve({ status: "success", message: "签到成功", checkin_record_id: recordId });
        return;
      }
      if (url === "/api/checkin/records") {
        resolve({ records: mockStore.records });
        return;
      }
      if (url.startsWith("/api/checkin/records/")) {
        const recordId = url.split("/").pop();
        const detail = mockStore.records.find((item) => item.record_id === recordId);
        resolve(detail || {});
        return;
      }
      if (url === "/api/activity/current") {
        resolve(mockStore.activity);
        return;
      }
      resolve({});
    }, 320);
  });
};

const request = (options) => {
  if (config.mock) {
    return mockRequest(options.url, options.data || {});
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.baseUrl}${options.url}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json"
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail: (err) => reject(err)
    });
  });
};

const login = (wxLoginCode) => {
  return request({
    url: "/api/auth/wx-login",
    method: "POST",
    data: {
      wx_login_code: wxLoginCode
    }
  });
};

const register = ({ sessionToken, studentId, name, payloadEncrypted }) => {
  return request({
    url: "/api/register",
    method: "POST",
    data: {
      session_token: sessionToken,
      student_id: studentId,
      name,
      payload_encrypted: payloadEncrypted
    }
  });
};

const verifyCheckin = ({ sessionToken, qrToken, studentId, name }) => {
  return request({
    url: "/api/checkin/verify",
    method: "POST",
    data: {
      session_token: sessionToken,
      qr_token: qrToken,
      student_id: studentId,
      name
    }
  });
};

const getRecords = (sessionToken) => {
  return request({
    url: "/api/checkin/records",
    method: "GET",
    data: {
      session_token: sessionToken
    }
  });
};

const getRecordDetail = (recordId) => {
  return request({
    url: `/api/checkin/records/${recordId}`,
    method: "GET"
  });
};

const getActivityCurrent = () => {
  return request({
    url: "/api/activity/current",
    method: "GET"
  });
};

module.exports = {
  login,
  register,
  verifyCheckin,
  getRecords,
  getRecordDetail,
  getActivityCurrent
};
