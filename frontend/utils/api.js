const config = require("./config");
const storage = require("./storage");
const qrPayload = require("./qr-payload");

const DEFAULT_ROTATE_SECONDS = qrPayload.DEFAULT_ROTATE_SECONDS;
const DEFAULT_GRACE_SECONDS = qrPayload.DEFAULT_GRACE_SECONDS;
const STAFF_PERMISSIONS = ["activity:checkin", "activity:checkout", "activity:detail"];

const mockAdminDirectory = [
  {
    student_id: "2025000007",
    name: "刘洋"
  }
];

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
    wx_identity: "wx_normal_identity",
    role: "normal",
    permissions: [],
    profile: {
      student_id: "",
      name: "",
      department: "信息工程学院",
      club: "开源技术社",
      avatar_url: "",
      social_score: 28,
      lecture_score: 14
    }
  },
  staff: {
    wx_identity: "wx_staff_identity",
    role: "staff",
    permissions: STAFF_PERMISSIONS.slice(),
    profile: {
      student_id: "",
      name: "",
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
  normalAttendanceStatus: {
    act_tech_talk_20260112: "checked_in",
    act_meetup_20260114: "checked_out",
    act_open_day_20260128: "checked_in",
    act_ui_salon_20260201: "none",
    act_product_forum_20260208: "none",
    act_ai_workshop_20260210: "checked_in",
    act_hackathon_20260215: "none",
    act_research_roadshow_20260220: "none",
    act_safety_training_20260207: "checked_out",
    act_ops_review_20251230: "none"
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
  consumeReplayGuard: {},
  consumeRateWindow: {},
  sessions: {},
  studentBindingIndex: {},
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

const normalizeTextValue = (value) => {
  return `${value || ""}`.trim();
};

const SESSION_EXPIRED_ERROR_CODES = [
  "session_expired",
  "token_expired",
  "invalid_session",
  "invalid_session_token",
  "session_invalid"
];

const SESSION_EXPIRED_MESSAGE_KEYWORDS = [
  "会话失效",
  "重新登录",
  "session expired",
  "token expired",
  "invalid session"
];

let sessionExpiredRedirecting = false;

const shouldCheckSessionExpiryForUrl = (url) => {
  return normalizeTextValue(url) !== "/api/auth/wx-login";
};

const isSessionExpiredResponse = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const errorCode = normalizeTextValue(payload.error_code || payload.code).toLowerCase();
  if (SESSION_EXPIRED_ERROR_CODES.includes(errorCode)) {
    return true;
  }

  const status = normalizeTextValue(payload.status).toLowerCase();
  if (status !== "forbidden" && status !== "unauthorized") {
    return false;
  }
  const message = normalizeTextValue(payload.message).toLowerCase();
  if (!message) {
    return false;
  }
  return SESSION_EXPIRED_MESSAGE_KEYWORDS.some((keyword) => message.includes(keyword.toLowerCase()));
};

const redirectToLoginForExpiredSession = (payload = {}) => {
  if (sessionExpiredRedirecting) {
    return;
  }
  sessionExpiredRedirecting = true;
  storage.clearAuthState();

  const tip = normalizeTextValue(payload.message) || "登录状态已失效，请重新登录";
  if (typeof wx !== "undefined" && wx && typeof wx.showToast === "function") {
    wx.showToast({
      title: tip,
      icon: "none",
      duration: 1800
    });
  }

  if (typeof wx !== "undefined" && wx && typeof wx.reLaunch === "function") {
    wx.reLaunch({
      url: "/pages/login/login",
      complete: () => {
        setTimeout(() => {
          sessionExpiredRedirecting = false;
        }, 300);
      }
    });
    return;
  }
  sessionExpiredRedirecting = false;
};

const isExplicitMockExpiredToken = (sessionToken) => {
  const token = normalizeTextValue(sessionToken).toLowerCase();
  if (!token) {
    return false;
  }
  return token === "expired_token"
    || token === "token_expired"
    || token === "session_expired"
    || token.includes("expired");
};

const shouldMockReturnSessionExpired = (url, data) => {
  const protectedEndpoint = url === "/api/register"
    || url === "/api/checkin/verify"
    || url === "/api/checkin/consume"
    || url === "/api/checkin/records"
    || url.startsWith("/api/checkin/records/")
    || url === "/api/staff/activities"
    || url.startsWith("/api/staff/activities/")
    || url === "/api/staff/activity-action";

  if (!protectedEndpoint) {
    return false;
  }
  return isExplicitMockExpiredToken(data && data.session_token);
};

const normalizeStudentId = (value) => {
  return normalizeTextValue(value);
};

const normalizeName = (value) => {
  return normalizeTextValue(value);
};

const normalizeScoreValue = (value) => {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return 0;
  }
  return num;
};

const copyUserProfile = (profile) => {
  return {
    student_id: normalizeStudentId(profile && profile.student_id),
    name: normalizeName(profile && profile.name),
    department: normalizeTextValue(profile && profile.department),
    club: normalizeTextValue(profile && profile.club),
    avatar_url: normalizeTextValue(profile && profile.avatar_url),
    social_score: normalizeScoreValue(profile && profile.social_score),
    lecture_score: normalizeScoreValue(profile && profile.lecture_score)
  };
};

const isRegisteredProfile = (profile) => {
  if (!profile) {
    return false;
  }
  return !!(normalizeStudentId(profile.student_id) && normalizeName(profile.name));
};

const buildStudentBindingKey = (studentId, name) => {
  const normalizedStudentId = normalizeStudentId(studentId).toLowerCase();
  const normalizedName = normalizeName(name).toLowerCase();
  if (!normalizedStudentId || !normalizedName) {
    return "";
  }
  return `${normalizedStudentId}::${normalizedName}`;
};

const resolveRoleByDirectory = (studentId, name) => {
  const bindingKey = buildStudentBindingKey(studentId, name);
  const hasAdminRecord = mockAdminDirectory.some((item) => {
    return buildStudentBindingKey(item.student_id, item.name) === bindingKey;
  });

  if (hasAdminRecord) {
    return {
      role: "staff",
      permissions: STAFF_PERMISSIONS.slice(),
      admin_verified: true
    };
  }

  return {
    role: "normal",
    permissions: [],
    admin_verified: false
  };
};

const isValidStudentId = (studentId) => {
  return /^[0-9A-Za-z_-]{4,32}$/.test(normalizeStudentId(studentId));
};

const isValidName = (name) => {
  const normalized = normalizeName(name);
  return normalized.length >= 1 && normalized.length <= 64;
};

const syncBindingIndexForUser = (user) => {
  if (!user || !isRegisteredProfile(user.profile)) {
    return;
  }
  const key = buildStudentBindingKey(user.profile.student_id, user.profile.name);
  if (key) {
    mockStore.studentBindingIndex[key] = user.wx_identity;
  }
};

const resolveMockUserByWxIdentity = (wxIdentity) => {
  const normalizedIdentity = normalizeTextValue(wxIdentity);
  if (!normalizedIdentity) {
    return null;
  }
  const users = Object.values(mockUsers);
  return users.find((item) => item.wx_identity === normalizedIdentity) || null;
};

const issueMockSessionToken = (user) => {
  const token = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  mockStore.sessions[token] = {
    wx_identity: user.wx_identity,
    role: user.role,
    issued_at: Date.now()
  };
  return token;
};

const resolveSessionUser = (sessionToken, options = {}) => {
  const { allowFallback = true } = options;
  const token = normalizeTextValue(sessionToken);
  if (token && mockStore.sessions[token]) {
    const user = resolveMockUserByWxIdentity(mockStore.sessions[token].wx_identity);
    if (user) {
      return user;
    }
  }
  return allowFallback ? getCurrentMockUser() : null;
};

const buildLoginProfile = (user) => {
  const profile = copyUserProfile(user && user.profile);
  if (!isRegisteredProfile(profile)) {
    return {
      ...profile,
      student_id: "",
      name: ""
    };
  }
  return profile;
};

const getMockUserUniqueKey = (user) => {
  return normalizeStudentId(user && user.profile && user.profile.student_id)
    || normalizeTextValue(user && user.wx_identity)
    || "unknown";
};

Object.values(mockUsers).forEach((user) => {
  syncBindingIndexForUser(user);
});

const normalizeCounterValue = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const ensureActivityCounters = (activity) => {
  if (!activity) {
    return activity;
  }
  activity.checkin_count = normalizeCounterValue(activity.checkin_count);
  activity.checkout_count = normalizeCounterValue(activity.checkout_count);
  return activity;
};

const normalizeActivityCounters = (activity) => {
  if (!activity) {
    return {};
  }
  return {
    ...activity,
    checkin_count: normalizeCounterValue(activity.checkin_count),
    checkout_count: normalizeCounterValue(activity.checkout_count)
  };
};

const getNormalAttendanceState = (activityId) => {
  const state = mockStore.normalAttendanceStatus[activityId];
  if (state === "checked_in" || state === "checked_out") {
    return state;
  }
  return "none";
};

const isNormalParticipated = (activityId) => {
  const state = getNormalAttendanceState(activityId);
  return state === "checked_in" || state === "checked_out";
};

const getNormalActivityRelation = (activityId) => {
  const attendanceState = getNormalAttendanceState(activityId);
  return {
    my_registered: !!mockStore.normalRegistrationStatus[activityId],
    my_checked_in: attendanceState === "checked_in",
    my_checked_out: attendanceState === "checked_out",
    my_attendance_status: attendanceState
  };
};

const normalizeActivityForNormal = (activity) => {
  if (!activity) {
    return {};
  }
  return {
    ...normalizeActivityCounters(activity),
    ...getNormalActivityRelation(activity.activity_id)
  };
};

const canNormalViewActivity = (activityId) => {
  const relation = getNormalActivityRelation(activityId);
  return relation.my_registered || isNormalParticipated(activityId);
};

const clampWindowSeconds = (value, fallbackValue, minValue, maxValue) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallbackValue;
  }
  return Math.max(minValue, Math.min(maxValue, Math.floor(parsed)));
};

const createBackendNonce = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `n${randomPart || Date.now().toString(36)}`;
};

const resolveConsumeContext = (data) => {
  const rawPayload = `${data.qr_payload || data.path || data.raw_result || ""}`.trim();
  const parsedPayload = qrPayload.parseQrPayload(rawPayload);
  const activityId = `${data.activity_id || (parsedPayload && parsedPayload.activity_id) || ""}`.trim();
  const actionTypeRaw = `${data.action_type || (parsedPayload && parsedPayload.action_type) || ""}`.trim();
  const actionType = actionTypeRaw === "checkout" ? "checkout" : actionTypeRaw === "checkin" ? "checkin" : "";
  const slotRaw = data.slot !== undefined && data.slot !== null && data.slot !== ""
    ? data.slot
    : (parsedPayload && parsedPayload.slot);
  const slot = Number(slotRaw);
  const nonce = `${data.nonce || (parsedPayload && parsedPayload.nonce) || ""}`.trim();

  return {
    rawPayload,
    parsedPayload,
    activityId,
    actionType,
    slot: Number.isInteger(slot) ? slot : -1,
    nonce
  };
};

const checkConsumeRateLimit = (studentId, now) => {
  const key = `${studentId || "unknown"}`;
  const windowMs = 5000;
  const maxHits = 6;
  const history = Array.isArray(mockStore.consumeRateWindow[key]) ? mockStore.consumeRateWindow[key] : [];
  const recentHistory = history.filter((item) => now - item < windowMs);
  recentHistory.push(now);
  mockStore.consumeRateWindow[key] = recentHistory;
  return recentHistory.length > maxHits;
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
      if (shouldMockReturnSessionExpired(url, data)) {
        resolve({
          status: "forbidden",
          message: "会话失效，请重新登录",
          error_code: "session_expired"
        });
        return;
      }

      if (url === "/api/auth/wx-login") {
        const wxLoginCode = normalizeTextValue(data.wx_login_code);
        if (!wxLoginCode) {
          resolve({ status: "invalid_param", message: "wx_login_code 不能为空" });
          return;
        }

        const user = getCurrentMockUser();
        const sessionToken = issueMockSessionToken(user);
        const loginProfile = buildLoginProfile(user);
        resolve({
          status: "success",
          message: "登录成功",
          wx_identity: user.wx_identity,
          session_token: sessionToken,
          role: user.role,
          permissions: user.permissions,
          is_registered: isRegisteredProfile(loginProfile),
          user_profile: loginProfile
        });
        return;
      }

      if (url === "/api/register") {
        const user = resolveSessionUser(data.session_token, { allowFallback: false });
        if (!user) {
          resolve({ status: "forbidden", message: "会话失效，请重新登录" });
          return;
        }

        const studentId = normalizeStudentId(data.student_id);
        const name = normalizeName(data.name);
        const department = normalizeTextValue(data.department);
        const club = normalizeTextValue(data.club);

        if (!isValidStudentId(studentId) || !isValidName(name)) {
          resolve({ status: "invalid_param", message: "学号或姓名不合法" });
          return;
        }

        const currentBound = isRegisteredProfile(user.profile);
        const currentBindingKey = currentBound
          ? buildStudentBindingKey(user.profile.student_id, user.profile.name)
          : "";
        const incomingBindingKey = buildStudentBindingKey(studentId, name);

        if (currentBound && currentBindingKey !== incomingBindingKey) {
          resolve({ status: "wx_already_bound", message: "当前微信已绑定其他学号姓名，请勿重复绑定" });
          return;
        }

        const boundWxIdentity = mockStore.studentBindingIndex[incomingBindingKey];
        if (boundWxIdentity && boundWxIdentity !== user.wx_identity) {
          resolve({ status: "student_already_bound", message: "该学号姓名已绑定其他微信，禁止重复绑定" });
          return;
        }

        user.profile.student_id = studentId;
        user.profile.name = name;
        user.profile.department = department || user.profile.department;
        user.profile.club = club || user.profile.club;
        const roleResult = resolveRoleByDirectory(studentId, name);
        user.role = roleResult.role;
        user.permissions = roleResult.permissions;

        if (currentBindingKey && currentBindingKey !== incomingBindingKey && mockStore.studentBindingIndex[currentBindingKey] === user.wx_identity) {
          delete mockStore.studentBindingIndex[currentBindingKey];
        }
        mockStore.studentBindingIndex[incomingBindingKey] = user.wx_identity;
        const normalizedSessionToken = normalizeTextValue(data.session_token);
        if (normalizedSessionToken && mockStore.sessions[normalizedSessionToken]) {
          mockStore.sessions[normalizedSessionToken].role = user.role;
        }

        resolve({
          status: "success",
          message: "绑定成功",
          role: user.role,
          permissions: user.permissions,
          admin_verified: roleResult.admin_verified,
          is_registered: true,
          user_profile: buildLoginProfile(user)
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

      if (url === "/api/checkin/consume") {
        const currentUser = resolveSessionUser(data.session_token);
        const role = currentUser.role;
        const now = Date.now();
        const context = resolveConsumeContext(data);

        if (role !== "normal") {
          resolve({ status: "forbidden", message: "仅普通用户可扫码签到/签退" });
          return;
        }

        if (checkConsumeRateLimit(getMockUserUniqueKey(currentUser), now)) {
          resolve({ status: "forbidden", message: "提交过于频繁，请稍后再试" });
          return;
        }

        if (!context.activityId || !context.actionType || context.slot < 0) {
          resolve({ status: "invalid_qr", message: "二维码无法识别，请重新扫码" });
          return;
        }
        if (
          context.parsedPayload
          && (
            (data.activity_id && `${data.activity_id}` !== context.parsedPayload.activity_id)
            || (data.action_type && `${data.action_type}` !== context.parsedPayload.action_type)
            || (data.slot !== undefined && data.slot !== null && data.slot !== "" && Number(data.slot) !== context.parsedPayload.slot)
            || (data.nonce && `${data.nonce}` !== context.parsedPayload.nonce)
          )
        ) {
          resolve({ status: "invalid_qr", message: "二维码数据不一致，请重新扫码" });
          return;
        }

        const activity = mockStore.staffActivities.find((item) => item.activity_id === context.activityId);
        if (!activity) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }
        ensureActivityCounters(activity);

        if (!canNormalViewActivity(context.activityId)) {
          resolve({ status: "forbidden", message: "你未报名该活动，无法签到/签退" });
          return;
        }

        if (activity.progress_status === "completed") {
          resolve({ status: "forbidden", message: "活动已结束，无法再签到/签退" });
          return;
        }

        if (context.actionType === "checkout" && !activity.support_checkout) {
          resolve({ status: "forbidden", message: "该活动暂不支持签退" });
          return;
        }

        const slotState = qrPayload.resolveSlotState({
          slot: context.slot,
          nowMs: now,
          rotateSeconds: DEFAULT_ROTATE_SECONDS,
          graceSeconds: DEFAULT_GRACE_SECONDS
        });
        if (slotState.is_future) {
          resolve({ status: "invalid_qr", message: "二维码时间异常，请重新扫码" });
          return;
        }
        if (slotState.is_expired) {
          resolve({ status: "expired", message: "二维码已过期，请重新获取" });
          return;
        }

        const replayKey = `${getMockUserUniqueKey(currentUser)}:${context.activityId}:${context.actionType}:${context.slot}`;
        if (mockStore.consumeReplayGuard[replayKey]) {
          resolve({ status: "duplicate", message: "当前时段已提交，请勿重复扫码" });
          return;
        }

        const inGraceWindow = slotState.in_grace_window;
        const previousState = getNormalAttendanceState(context.activityId);
        const actionType = context.actionType;

        if (actionType === "checkin" && previousState === "checked_in") {
          resolve({ status: "duplicate", message: "你已签到，请勿重复提交" });
          return;
        }

        if (actionType === "checkout" && previousState !== "checked_in") {
          resolve({ status: "forbidden", message: "请先完成签到再签退" });
          return;
        }

        if (actionType === "checkout") {
          activity.checkin_count = Math.max(0, activity.checkin_count - 1);
          activity.checkout_count += 1;
          mockStore.normalAttendanceStatus[context.activityId] = "checked_out";
        } else {
          activity.checkin_count += 1;
          mockStore.normalAttendanceStatus[context.activityId] = "checked_in";
        }

        mockStore.consumeReplayGuard[replayKey] = now;
        const recordId = createRecord(activity, actionType);

        resolve({
          status: "success",
          message: actionType === "checkout" ? "签退成功" : "签到成功",
          action_type: actionType,
          activity_id: context.activityId,
          activity_title: activity.activity_title,
          checkin_record_id: recordId,
          in_grace_window: inGraceWindow,
          slot: context.slot
        });
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
        const role = resolveSessionUser(data.session_token).role;
        const activities = mockStore.staffActivities
          .map((item) => normalizeActivityForNormal(item))
          .filter((item) => item.my_registered || item.my_checked_in || item.my_checked_out);
        resolve({
          activities: role === "normal"
            ? activities
            : mockStore.staffActivities.map((item) => normalizeActivityCounters(item))
        });
        return;
      }

      const qrSessionMatch = url.match(/^\/api\/staff\/activities\/([^/]+)\/qr-session$/);
      if (qrSessionMatch) {
        const role = resolveSessionUser(data.session_token).role;
        const activityId = qrSessionMatch[1];
        const actionType = normalizeTextValue(data.action_type);
        const rotateSeconds = DEFAULT_ROTATE_SECONDS;
        const graceSeconds = DEFAULT_GRACE_SECONDS;
        const activity = mockStore.staffActivities.find((item) => item.activity_id === activityId);

        if (role !== "staff") {
          resolve({ status: "forbidden", message: "仅工作人员可获取二维码配置" });
          return;
        }

        if (!activity) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }

        if (actionType !== "checkin" && actionType !== "checkout") {
          resolve({ status: "invalid_param", message: "action_type 参数不合法" });
          return;
        }

        if (activity.progress_status === "completed") {
          resolve({ status: "forbidden", message: "已完成活动仅支持查看详情" });
          return;
        }

        if (actionType === "checkout" && !activity.support_checkout) {
          resolve({ status: "forbidden", message: "该活动暂不支持签退二维码" });
          return;
        }

        const serverTime = Date.now();
        const slot = qrPayload.getCurrentSlot(serverTime, rotateSeconds);
        const nonce = createBackendNonce();
        const qrPayloadText = qrPayload.buildQrPayload({
          activityId,
          actionType,
          slot,
          nonce
        });
        const slotWindow = qrPayload.getSlotWindow({
          slot,
          rotateSeconds,
          graceSeconds
        });

        resolve({
          status: "success",
          message: "二维码签发成功",
          activity_id: activityId,
          action_type: actionType,
          qr_payload: qrPayloadText,
          slot,
          rotate_seconds: rotateSeconds,
          grace_seconds: graceSeconds,
          display_expire_at: slotWindow.display_expire_at,
          accept_expire_at: slotWindow.accept_expire_at,
          server_time: serverTime
        });
        return;
      }

      if (url.startsWith("/api/staff/activities/")) {
        const role = resolveSessionUser(data.session_token).role;
        const activityId = url.split("/").pop();
        const detail = mockStore.staffActivities.find((item) => item.activity_id === activityId);
        if (!detail) {
          resolve({ status: "invalid_activity", message: "活动不存在或已下线" });
          return;
        }
        ensureActivityCounters(detail);

        if (role === "normal" && !canNormalViewActivity(activityId)) {
          resolve({ status: "forbidden", message: "你未报名或参加该活动，无法查看详情" });
          return;
        }

        const normalized = role === "normal" ? normalizeActivityForNormal(detail) : normalizeActivityCounters(detail);
        resolve({
          ...normalized,
          rotate_seconds: DEFAULT_ROTATE_SECONDS,
          grace_seconds: DEFAULT_GRACE_SECONDS,
          server_time: Date.now()
        });
        return;
      }

      if (url === "/api/staff/activity-action") {
        const role = resolveSessionUser(data.session_token).role;
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
        ensureActivityCounters(activity);

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
          activity.checkout_count += 1;
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
  const requestUrl = normalizeTextValue(options && options.url);
  const shouldCheckSessionExpiry = shouldCheckSessionExpiryForUrl(requestUrl);

  if (config.mock) {
    return mockRequest(requestUrl, options.data || {}).then((data) => {
      if (shouldCheckSessionExpiry && isSessionExpiredResponse(data)) {
        redirectToLoginForExpiredSession(data);
      }
      return data;
    });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.baseUrl}${requestUrl}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json"
      },
      success: (res) => {
        const payload = res ? res.data : {};
        const httpUnauthorized = res && (res.statusCode === 401 || res.statusCode === 403);
        if (shouldCheckSessionExpiry && (isSessionExpiredResponse(payload) || httpUnauthorized)) {
          redirectToLoginForExpiredSession(payload);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
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

const consumeCheckinAction = ({
  sessionToken,
  qrPayload: qrPayloadText,
  scanType,
  rawResult,
  path,
  activityId,
  actionType,
  slot,
  nonce
}) => {
  const requestData = {
    session_token: sessionToken || storage.getSessionToken(),
    qr_payload: qrPayloadText || "",
    scan_type: scanType || "",
    raw_result: rawResult || "",
    path: path || ""
  };

  const activityIdValue = `${activityId || ""}`.trim();
  if (activityIdValue) {
    requestData.activity_id = activityIdValue;
  }

  const actionTypeValue = `${actionType || ""}`.trim();
  if (actionTypeValue) {
    requestData.action_type = actionTypeValue;
  }

  const slotValue = Number(slot);
  if (slot !== undefined && slot !== null && slot !== "" && Number.isInteger(slotValue) && slotValue >= 0) {
    requestData.slot = slotValue;
  }

  const nonceValue = `${nonce || ""}`.trim();
  if (nonceValue) {
    requestData.nonce = nonceValue;
  }

  return request({
    url: "/api/checkin/consume",
    method: "POST",
    data: requestData
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

const createStaffQrSession = ({
  sessionToken,
  activityId,
  actionType,
  rotateSeconds,
  graceSeconds
}) => {
  const requestData = {
    session_token: sessionToken || storage.getSessionToken(),
    action_type: actionType === "checkout" ? "checkout" : "checkin"
  };

  const rotateValue = Number(rotateSeconds);
  if (Number.isInteger(rotateValue) && rotateValue > 0) {
    requestData.rotate_seconds = rotateValue;
  }

  const graceValue = Number(graceSeconds);
  if (Number.isInteger(graceValue) && graceValue > 0) {
    requestData.grace_seconds = graceValue;
  }

  return request({
    url: `/api/staff/activities/${activityId}/qr-session`,
    method: "POST",
    data: requestData
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
  consumeCheckinAction,
  getRecords,
  getRecordDetail,
  getActivityCurrent,
  getStaffActivities,
  getStaffActivityDetail,
  createStaffQrSession,
  staffActivityAction
};
