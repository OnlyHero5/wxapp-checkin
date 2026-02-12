const { sha256 } = require("js-sha256");

const SIGN_ALGORITHM = "HMAC-SHA256";
const SIGN_VERSION = 1;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;

const normalizeText = (value) => {
  return `${value || ""}`
    .replace(CONTROL_CHAR_PATTERN, "")
    .trim();
};

const stableStringify = (value) => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = keys.map((key) => {
      return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
    });
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
};

const utf8ToArrayBuffer = (text) => {
  const utf8 = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
  const buffer = new ArrayBuffer(utf8.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < utf8.length; i += 1) {
    view[i] = utf8.charCodeAt(i);
  }
  return buffer;
};

const toBase64 = (text) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }
  if (typeof wx !== "undefined" && wx && typeof wx.arrayBufferToBase64 === "function") {
    return wx.arrayBufferToBase64(utf8ToArrayBuffer(text));
  }
  throw new Error("No base64 encoder available");
};

const fromBase64 = (encoded) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encoded, "base64").toString("utf8");
  }
  if (typeof wx !== "undefined" && wx && typeof wx.base64ToArrayBuffer === "function") {
    const buffer = wx.base64ToArrayBuffer(encoded);
    const view = new Uint8Array(buffer);
    let text = "";
    for (let i = 0; i < view.length; i += 1) {
      text += String.fromCharCode(view[i]);
    }
    return decodeURIComponent(escape(text));
  }
  throw new Error("No base64 decoder available");
};

const bytesToBase64 = (bytes) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  if (typeof wx !== "undefined" && wx && typeof wx.arrayBufferToBase64 === "function") {
    return wx.arrayBufferToBase64(bytes.buffer);
  }
  throw new Error("No byte-base64 encoder available");
};

const fillRandomBytes = (target) => {
  if (typeof wx !== "undefined" && wx && typeof wx.getRandomValues === "function") {
    wx.getRandomValues(target);
    return true;
  }
  if (typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(target);
    return true;
  }
  return false;
};

const generateNonce = () => {
  const bytes = new Uint8Array(18);
  const secureFilled = fillRandomBytes(bytes);
  if (!secureFilled) {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const buildRegisterPayloadEnvelope = ({
  sessionToken,
  payload,
  timestampMs = Date.now(),
  nonce
}) => {
  const token = normalizeText(sessionToken);
  if (!token) {
    return "";
  }

  const payloadBody = stableStringify(payload || {});
  const payloadBodyBase64 = toBase64(payloadBody);
  const requestNonce = normalizeText(nonce) || generateNonce();
  const signText = `v1.${timestampMs}.${requestNonce}.${payloadBodyBase64}`;
  const signature = sha256.hmac(token, signText);
  const envelope = {
    v: SIGN_VERSION,
    alg: SIGN_ALGORITHM,
    ts: timestampMs,
    nonce: requestNonce,
    body: payloadBodyBase64,
    sig: signature
  };
  return toBase64(stableStringify(envelope));
};

const decodeRegisterPayloadEnvelope = (payloadEncrypted) => {
  const text = fromBase64(normalizeText(payloadEncrypted));
  return JSON.parse(text);
};

module.exports = {
  buildRegisterPayloadEnvelope,
  decodeRegisterPayloadEnvelope
};
