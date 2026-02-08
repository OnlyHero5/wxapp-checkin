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
    },
    {
      record_id: "rec_seed_002",
      time: "2026-01-28 18:45:00",
      location: "大学生活动中心",
      activity_title: "学生组织开放日",
      description: "签到完成 · 展会"
    },
    {
      record_id: "rec_seed_003",
      time: "2026-02-01 15:18:00",
      location: "教学楼 B302",
      activity_title: "前端设计沙龙",
      description: "签到完成 · 研讨会"
    },
    {
      record_id: "rec_seed_004",
      time: "2026-02-03 20:08:00",
      location: "创新空间 A201",
      activity_title: "技术社群 Meetup",
      description: "签退完成 · 社群活动"
    }
  ],
  normalCheckinStatus: {
    act_tech_talk_20260112: true,
    act_meetup_20260114: true,
    act_open_day_20260128: true,
    act_ui_salon_20260201: false,
    act_product_forum_20260208: false,
    act_ai_workshop_20260210: true,
    act_hackathon_20260215: false,
    act_research_roadshow_20260220: false,
    act_safety_training_20260207: true
  },
  normalRegistrationStatus: {
    act_tech_talk_20260112: true,
    act_meetup_20260114: true,
    act_open_day_20260128: true,
    act_ui_salon_20260201: false,
    act_product_forum_20260208: true,
    act_ai_workshop_20260210: true,
    act_hackathon_20260215: true,
    act_research_roadshow_20260220: false,
    act_safety_training_20260207: true,
    act_ops_review_20251230: false
  },
  staffActivities: [
    {
      activity_id: "act_research_roadshow_20260220",
      activity_title: "科研成果路演",
      activity_type: "路演",
      start_time: "2026-02-20 14:00",
      location: "学术报告厅",
      checkin_count: 0,
      support_checkout: false,
      has_detail: false,
      progress_status: "ongoing",
      description: "院系联合路演，含评审打分环节。"
    },
    {
      activity_id: "act_hackathon_20260215",
      activity_title: "校园 HackDay",
      activity_type: "竞赛",
      start_time: "2026-02-15 09:00",
      location: "创新中心 1F",
      checkin_count: 18,
      support_checkout: true,
      has_detail: true,
      progress_status: "ongoing",
      description: "48 小时团队赛，支持签到与签退。"
    },
    {
      activity_id: "act_ai_workshop_20260210",
      activity_title: "AI 工具实战工作坊",
      activity_type: "工作坊",
      start_time: "2026-02-10 19:30",
      location: "图书馆创客空间",
      checkin_count: 32,
      support_checkout: true,
      has_detail: true,
      progress_status: "ongoing",
      description: "现场实操课程，支持全程签退统计。"
    },
    {
      activity_id: "act_product_forum_20260208",
      activity_title: "产品思维论坛",
      activity_type: "论坛",
      start_time: "2026-02-08 16:00",
      location: "北校区报告厅",
      checkin_count: 26,
      support_checkout: false,
      has_detail: true,
      progress_status: "ongoing",
      description: "校友分享与问答交流。"
    },
    {
      activity_id: "act_safety_training_20260207",
      activity_title: "活动安全培训",
      activity_type: "培训",
      start_time: "2026-02-07 14:30",
      location: "行政楼 2F 会议室",
      checkin_count: 14,
      support_checkout: false,
      has_detail: true,
      progress_status: "ongoing",
      description: "工作人员安全规范与应急演练。"
    },
    {
      activity_id: "act_ui_salon_20260201",
      activity_title: "前端设计沙龙",
      activity_type: "研讨会",
      start_time: "2026-02-01 15:00",
      location: "教学楼 B302",
      checkin_count: 21,
      support_checkout: false,
      has_detail: true,
      progress_status: "completed",
      description: "围绕设计规范与组件复用的专题讨论。"
    },
    {
      activity_id: "act_open_day_20260128",
      activity_title: "学生组织开放日",
      activity_type: "展会",
      start_time: "2026-01-28 18:00",
      location: "大学生活动中心",
      checkin_count: 45,
      support_checkout: true,
      has_detail: true,
      progress_status: "completed",
      description: "社团联合展位与招新咨询。"
    },
    {
      activity_id: "act_tech_talk_20260112",
      activity_title: "新生技术讲座",
      activity_type: "讲座",
      start_time: "2026-01-12 19:00",
      location: "南校区报告厅",
      checkin_count: 1,
      support_checkout: false,
      has_detail: true,
      progress_status: "completed",
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
      progress_status: "completed",
      description: "讲座场次：6 次，含签到与签退。"
    },
    {
      activity_id: "act_ops_review_20251230",
      activity_title: "年度运营复盘会",
      activity_type: "复盘",
      start_time: "2025-12-30 19:00",
      location: "主楼 5F 多功能厅",
      checkin_count: 37,
      support_checkout: false,
      has_detail: true,
      progress_status: "completed",
      description: "上一年度活动运营复盘与改进计划。"
    }
  ]
};

const getMockRoleKey = () => {
  return config.mockUserRole === "staff" ? "staff" : "normal";
};

const getCurrentMockUser = () => {
  return mockUsers[getMockRoleKey()];
};

const getNormalActivityRelation = (activityId) => {
  return {
    my_registered: !!mockStore.normalRegistrationStatus[activityId],
    my_checked_in: !!mockStore.normalCheckinStatus[activityId]
  };
};

const normalizeActivityForNormal = (activity) => {
  if (!activity) {
    return {};
  }
  return {
    ...activity,
    ...getNormalActivityRelation(activity.activity_id)
  };
};

const canNormalViewActivity = (activityId) => {
  const relation = getNormalActivityRelation(activityId);
  return relation.my_registered || relation.my_checked_in;
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
        const activities = mockStore.staffActivities
          .map((item) => normalizeActivityForNormal(item))
          .filter((item) => item.my_registered || item.my_checked_in);
        resolve({
          activities: role === "normal" ? activities : mockStore.staffActivities
        });
        return;
      }

      if (url.startsWith("/api/staff/activities/")) {
        const role = getCurrentMockUser().role;
        const activityId = url.split("/").pop();
        const detail = mockStore.staffActivities.find((item) => item.activity_id === activityId);
        if (!detail) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }

        if (role === "normal" && !canNormalViewActivity(activityId)) {
          resolve({ status: "forbidden", message: "你未报名或参加该活动，无法查看详情" });
          return;
        }

        resolve(role === "normal" ? normalizeActivityForNormal(detail) : detail);
        return;
      }

      if (url === "/api/staff/activity-action") {
        const role = getCurrentMockUser().role;
        const activityId = data.activity_id || "";
        const actionType = data.action_type || "checkin";
        const qrToken = data.qr_token || "";
        const activity = mockStore.staffActivities.find((item) => item.activity_id === activityId);

        if (role !== "staff") {
          resolve({ status: "forbidden", message: "仅工作人员可执行签到/签退" });
          return;
        }

        if (!activity) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }

        if (activity.progress_status === "completed") {
          resolve({ status: "forbidden", message: "已完成活动仅支持查看详情" });
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
  const role = storage.getRole();
  return request({
    url: "/api/staff/activities",
    method: "GET",
    data: {
      session_token: sessionToken || storage.getSessionToken(),
      role_hint: role,
      visibility_scope: role === "normal" ? "joined_or_participated" : "all"
    }
  });
};

const getStaffActivityDetail = (activityId, sessionToken) => {
  const role = storage.getRole();
  return request({
    url: `/api/staff/activities/${activityId}`,
    method: "GET",
    data: {
      session_token: sessionToken || storage.getSessionToken(),
      role_hint: role,
      visibility_scope: role === "normal" ? "joined_or_participated" : "all"
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
