const QR_PREFIX = "wxcheckin";
const QR_VERSION = "v1";
const DEFAULT_ROTATE_SECONDS = 10;
const DEFAULT_GRACE_SECONDS = 20;

const normalizeActionType = (value) => {
  if (value === "checkin" || value === "checkout") {
    return value;
  }
  return "";
};

const normalizeWindowSeconds = (value, fallbackValue) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return Math.floor(parsed);
};

const normalizeSlot = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return -1;
  }
  return parsed;
};

const getCurrentSlot = (nowMs, rotateSeconds = DEFAULT_ROTATE_SECONDS) => {
  const rotateMs = normalizeWindowSeconds(rotateSeconds, DEFAULT_ROTATE_SECONDS) * 1000;
  const now = Number(nowMs);
  if (Number.isNaN(now) || now < 0) {
    return 0;
  }
  return Math.floor(now / rotateMs);
};

const getSlotWindow = ({
  slot,
  rotateSeconds = DEFAULT_ROTATE_SECONDS,
  graceSeconds = DEFAULT_GRACE_SECONDS
}) => {
  const normalizedSlot = normalizeSlot(slot);
  const rotate = normalizeWindowSeconds(rotateSeconds, DEFAULT_ROTATE_SECONDS);
  const grace = normalizeWindowSeconds(graceSeconds, DEFAULT_GRACE_SECONDS);

  if (normalizedSlot < 0) {
    return {
      display_start_at: 0,
      display_expire_at: 0,
      accept_expire_at: 0
    };
  }

  const displayStartAt = normalizedSlot * rotate * 1000;
  const displayExpireAt = displayStartAt + rotate * 1000;
  const acceptExpireAt = displayExpireAt + grace * 1000;

  return {
    display_start_at: displayStartAt,
    display_expire_at: displayExpireAt,
    accept_expire_at: acceptExpireAt
  };
};

const resolveSlotState = ({
  slot,
  nowMs,
  rotateSeconds = DEFAULT_ROTATE_SECONDS,
  graceSeconds = DEFAULT_GRACE_SECONDS
}) => {
  const now = Number(nowMs);
  const window = getSlotWindow({ slot, rotateSeconds, graceSeconds });
  if (window.display_expire_at <= 0 || Number.isNaN(now)) {
    return {
      in_display_window: false,
      in_grace_window: false,
      is_expired: true,
      is_future: false,
      display_remaining_seconds: 0,
      accept_remaining_seconds: 0,
      ...window
    };
  }

  const inDisplayWindow = now >= window.display_start_at && now <= window.display_expire_at;
  const inGraceWindow = now > window.display_expire_at && now <= window.accept_expire_at;
  const isExpired = now > window.accept_expire_at;
  const isFuture = now < window.display_start_at;

  return {
    in_display_window: inDisplayWindow,
    in_grace_window: inGraceWindow,
    is_expired: isExpired,
    is_future: isFuture,
    display_remaining_seconds: Math.max(0, Math.ceil((window.display_expire_at - now) / 1000)),
    accept_remaining_seconds: Math.max(0, Math.ceil((window.accept_expire_at - now) / 1000)),
    ...window
  };
};

const buildQrPayload = ({ activityId, actionType, slot, nonce }) => {
  const normalizedActivityId = `${activityId || ""}`.trim();
  const normalizedActionType = normalizeActionType(actionType);
  const normalizedSlot = normalizeSlot(slot);
  const normalizedNonce = `${nonce || ""}`.trim();

  if (!normalizedActivityId || !normalizedActionType || normalizedSlot < 0 || !normalizedNonce) {
    return "";
  }

  return `${QR_PREFIX}:${QR_VERSION}:${normalizedActivityId}:${normalizedActionType}:${normalizedSlot}:${normalizedNonce}`;
};

const parseQrPayload = (input) => {
  const value = `${input || ""}`.trim();
  if (!value) {
    return null;
  }

  const parts = value.split(":");
  if (parts.length !== 6) {
    return null;
  }

  if (parts[0] !== QR_PREFIX || parts[1] !== QR_VERSION) {
    return null;
  }

  const activityId = `${parts[2] || ""}`.trim();
  const actionType = normalizeActionType(parts[3]);
  const slot = normalizeSlot(parts[4]);
  const nonce = `${parts[5] || ""}`.trim();

  if (!activityId || !actionType || slot < 0 || !nonce) {
    return null;
  }

  return {
    version: QR_VERSION,
    activity_id: activityId,
    action_type: actionType,
    slot,
    nonce,
    raw: value
  };
};

module.exports = {
  QR_PREFIX,
  QR_VERSION,
  DEFAULT_ROTATE_SECONDS,
  DEFAULT_GRACE_SECONDS,
  getCurrentSlot,
  getSlotWindow,
  resolveSlotState,
  buildQrPayload,
  parseQrPayload
};
