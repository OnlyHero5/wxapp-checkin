const config = require("./config");
const storage = require("./storage");

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

const mockUsers = {
  normal: {
    role: "normal",
    permissions: [],
    profile: {
      student_id: "2025011001",
      name: "李晨",
      department: "信息工程学院",
      club: "开源技术社",
      avatar_url: "",
      social_score: 28,
      lecture_score: 14
    }
  },
  staff: {
    role: "staff",
    permissions: ["activity:checkin", "activity:checkout", "activity:detail"],
    profile: {
      student_id: "2025000007",
      name: "刘洋",
      department: "学生工作部",
      club: "活动执行组",
      avatar_url: "",
      social_score: 0,
      lecture_score: 0
    }
  }
};

const mockStore = {
  records: [
    {
      record_id: "rec_seed_001",
      time: "2026-01-12 19:32:00",
      location: "南校区报告厅",
      activity_title: "新生技术讲座",
      description: "讲座场次：1 次"
    }
  ],
  normalCheckinStatus: {
    act_tech_talk_20260112: true,
    act_meetup_20260114: false
  },
  staffActivities: [
    {
      activity_id: "act_tech_talk_20260112",
      activity_title: "新生技术讲座",
      activity_type: "讲座",
      start_time: "2026-01-12 19:00",
      location: "南校区报告厅",
      checkin_count: 1,
      support_checkout: false,
      has_detail: true,
      description: "讲座场次：1 次，面向 2025 级新生。"
    },
    {
      activity_id: "act_meetup_20260114",
      activity_title: "技术社群 Meetup",
      activity_type: "社群活动",
      start_time: "2026-01-14 20:00",
      location: "创新空间 A201",
      checkin_count: 6,
      support_checkout: true,
      has_detail: true,
      description: "讲座场次：6 次，含签到与签退。"
    }
  ]
};

const getMockRoleKey = () => {
  return config.mockUserRole === "staff" ? "staff" : "normal";
};

const getCurrentMockUser = () => {
  return mockUsers[getMockRoleKey()];
};

const createRecord = (activity, actionType) => {
  const recordId = `rec_${Date.now()}`;
  const label = actionType === "checkout" ? "签退完成" : "签到完成";
  mockStore.records.unshift({
    record_id: recordId,
    time: formatTime(new Date()),
    location: activity.location,
    activity_title: activity.activity_title,
    description: `${label} · ${activity.activity_type}`
  });
  return recordId;
};

const mockRequest = (url, data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (url === "/api/auth/wx-login") {
        const user = getCurrentMockUser();
        resolve({
          wx_identity: `wx_${user.role}_identity`,
          session_token: `mock_${Date.now()}`,
          role: user.role,
          permissions: user.permissions,
          user_profile: user.profile
        });
        return;
      }

      if (url === "/api/register") {
        const user = getCurrentMockUser();
        user.profile.student_id = data.student_id || user.profile.student_id;
        user.profile.name = data.name || user.profile.name;
        user.profile.department = data.department || user.profile.department;
        user.profile.club = data.club || user.profile.club;
        resolve({
          status: "success",
          message: "绑定成功",
          user_profile: user.profile
        });
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
        const recordId = createRecord(
          {
            activity_title: "现场签到活动",
            activity_type: "签到",
            location: "线上签到"
          },
          "checkin"
        );
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

      if (url === "/api/staff/activities") {
        const role = getCurrentMockUser().role;
        const activities = mockStore.staffActivities.map((item) => ({
          ...item,
          my_checked_in: !!mockStore.normalCheckinStatus[item.activity_id]
        }));
        resolve({
          activities: role === "normal" ? activities : mockStore.staffActivities
        });
        return;
      }

      if (url.startsWith("/api/staff/activities/")) {
        const activityId = url.split("/").pop();
        const detail = mockStore.staffActivities.find((item) => item.activity_id === activityId);
        resolve(detail || {});
        return;
      }

      if (url === "/api/staff/activity-action") {
        const activityId = data.activity_id || "";
        const actionType = data.action_type || "checkin";
        const qrToken = data.qr_token || "";
        const activity = mockStore.staffActivities.find((item) => item.activity_id === activityId);

        if (!activity) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }

        if (!qrToken || qrToken.toUpperCase().includes("EXPIRED")) {
          resolve({ status: "invalid_qr", message: "二维码失效，请重新扫码" });
          return;
        }

        if (actionType === "checkout" && !activity.support_checkout) {
          resolve({ status: "forbidden", message: "该活动未开放签退" });
          return;
        }

        if (actionType === "checkout") {
          activity.checkin_count = Math.max(0, activity.checkin_count - 1);
        } else {
          activity.checkin_count += 1;
        }

        const recordId = createRecord(activity, actionType);
        resolve({
          status: "success",
          message: actionType === "checkout" ? "签退成功" : "签到成功",
          checkin_record_id: recordId
        });
        return;
      }

      if (url === "/api/activity/current") {
        const firstActivity = mockStore.staffActivities[0] || {};
        resolve({
          activity_title: firstActivity.activity_title || "",
          description: firstActivity.description || "",
          qr_expire_seconds: 10
        });
        return;
      }

      resolve({});
    }, 260);
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

const register = ({ sessionToken, studentId, name, department, club, payloadEncrypted }) => {
  return request({
    url: "/api/register",
    method: "POST",
    data: {
      session_token: sessionToken,
      student_id: studentId,
      name,
      department: department || "",
      club: club || "",
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
      session_token: sessionToken || storage.getSessionToken()
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

const getStaffActivities = (sessionToken) => {
  return request({
    url: "/api/staff/activities",
    method: "GET",
    data: {
      session_token: sessionToken || storage.getSessionToken()
    }
  });
};

const getStaffActivityDetail = (activityId, sessionToken) => {
  return request({
    url: `/api/staff/activities/${activityId}`,
    method: "GET",
    data: {
      session_token: sessionToken || storage.getSessionToken()
    }
  });
};

const staffActivityAction = ({ sessionToken, activityId, actionType, qrToken }) => {
  return request({
    url: "/api/staff/activity-action",
    method: "POST",
    data: {
      session_token: sessionToken || storage.getSessionToken(),
      activity_id: activityId,
      action_type: actionType,
      qr_token: qrToken
    }
  });
};

module.exports = {
  login,
  register,
  verifyCheckin,
  getRecords,
  getRecordDetail,
  getActivityCurrent,
  getStaffActivities,
  getStaffActivityDetail,
  staffActivityAction
};
