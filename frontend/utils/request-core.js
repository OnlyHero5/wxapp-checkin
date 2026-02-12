const REQUEST_TIMEOUT_MS = 10000;
const NETWORK_RETRY_MAX_ATTEMPTS = 2;
const NETWORK_RETRY_BASE_DELAY_MS = 160;
const NETWORK_RETRY_JITTER_MS = 80;
const RETRYABLE_HTTP_METHODS = ["GET", "HEAD", "OPTIONS"];

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

const normalizeTextValue = (value) => {
  return `${value || ""}`.trim();
};

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

const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const stableSerialize = (value) => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = keys.map((key) => {
      return `"${key}":${stableSerialize(value[key])}`;
    });
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
};

const buildGetRequestKey = (method, requestUrl, data) => {
  return `${method}|${requestUrl}|${stableSerialize(data)}`;
};

const resolveRequestMethod = (method) => {
  return `${method || "GET"}`.trim().toUpperCase() || "GET";
};

const isRetryableNetworkFailure = (error) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  if (typeof error.statusCode === "number") {
    return false;
  }
  const message = normalizeTextValue(error.errMsg || error.message).toLowerCase();
  if (!message) {
    return false;
  }
  return message.includes("timeout")
    || message.includes("network")
    || message.includes("request:fail")
    || message.includes("request fail");
};

const shouldRetryByMethod = (method) => {
  return RETRYABLE_HTTP_METHODS.includes(method);
};

const createRequestClient = ({ config, storage, mockRequest }) => {
  let sessionExpiredRedirecting = false;
  const inflightGetRequests = new Map();

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

  const sendRealRequest = (requestUrl, method, data, shouldCheckSessionExpiry) => {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.baseUrl}${requestUrl}`,
        method,
        data,
        timeout: REQUEST_TIMEOUT_MS,
        header: {
          "content-type": "application/json"
        },
        success: (res) => {
          const payload = res ? res.data : {};
          const httpUnauthorized = res && (res.statusCode === 401 || res.statusCode === 403);
          if (shouldCheckSessionExpiry && (isSessionExpiredResponse(payload) || httpUnauthorized)) {
            redirectToLoginForExpiredSession(payload);
          }

          if (res && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(payload);
          } else {
            reject(res || { statusCode: 500, data: payload });
          }
        },
        fail: (err) => reject(err)
      });
    });
  };

  const requestWithRetry = async ({
    requestUrl,
    method,
    data,
    shouldCheckSessionExpiry
  }) => {
    let attempt = 0;
    const retryEnabled = shouldRetryByMethod(method);
    const maxAttempts = retryEnabled ? NETWORK_RETRY_MAX_ATTEMPTS : 1;
    let lastError;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await sendRealRequest(requestUrl, method, data, shouldCheckSessionExpiry);
      } catch (error) {
        lastError = error;
        const canRetry = retryEnabled
          && attempt < maxAttempts
          && isRetryableNetworkFailure(error);
        if (!canRetry) {
          throw error;
        }
        const jitter = Math.floor(Math.random() * NETWORK_RETRY_JITTER_MS);
        const waitMs = NETWORK_RETRY_BASE_DELAY_MS * attempt + jitter;
        await delay(waitMs);
      }
    }

    throw lastError;
  };

  return (options) => {
    const requestUrl = normalizeTextValue(options && options.url);
    const method = resolveRequestMethod(options && options.method);
    const requestData = (options && options.data) || {};
    const shouldCheckSessionExpiry = shouldCheckSessionExpiryForUrl(requestUrl);

    if (config.mock) {
      return mockRequest(requestUrl, requestData).then((data) => {
        if (shouldCheckSessionExpiry && isSessionExpiredResponse(data)) {
          redirectToLoginForExpiredSession(data);
        }
        return data;
      });
    }

    if (method === "GET") {
      const dedupeKey = buildGetRequestKey(method, requestUrl, requestData);
      if (inflightGetRequests.has(dedupeKey)) {
        return inflightGetRequests.get(dedupeKey);
      }
      const inflightPromise = requestWithRetry({
        requestUrl,
        method,
        data: requestData,
        shouldCheckSessionExpiry
      }).finally(() => {
        inflightGetRequests.delete(dedupeKey);
      });
      inflightGetRequests.set(dedupeKey, inflightPromise);
      return inflightPromise;
    }

    return requestWithRetry({
      requestUrl,
      method,
      data: requestData,
      shouldCheckSessionExpiry
    });
  };
};

module.exports = {
  createRequestClient,
  normalizeTextValue,
  isSessionExpiredResponse,
  shouldCheckSessionExpiryForUrl
};
