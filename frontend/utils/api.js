const config = require("./config");
const storage = require("./storage");
const { createRequestClient } = require("./request-core");
const { mockRequest } = require("./mock-api");

const request = createRequestClient({
  config,
  storage,
  mockRequest
});

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
