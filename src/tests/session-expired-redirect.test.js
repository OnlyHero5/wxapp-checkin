const assert = require("assert");

const config = require("../utils/config");

const createWxMock = () => {
  const state = {};
  const reLaunchCalls = [];
  const toastCalls = [];

  return {
    getStorageSync(key) {
      return state[key] || "";
    },
    setStorageSync(key, value) {
      state[key] = value;
    },
    reLaunch(options = {}) {
      reLaunchCalls.push(options);
      if (typeof options.complete === "function") {
        options.complete();
      }
    },
    showToast(options = {}) {
      toastCalls.push(options);
    },
    __state: state,
    __reLaunchCalls: reLaunchCalls,
    __toastCalls: toastCalls
  };
};

const run = async () => {
  const originalMock = config.mock;
  const originalRole = config.mockUserRole;
  const originalWx = global.wx;

  config.mock = true;
  config.mockUserRole = "normal";
  global.wx = createWxMock();

  const storage = require("../utils/storage");
  const api = require("../utils/api");

  try {
    storage.setSessionToken("expired_token");
    storage.setWxIdentity("wx_demo");
    storage.setRole("staff");
    storage.setPermissions(["activity:checkin"]);
    storage.setStudentId("2025000007");
    storage.setName("测试用户");
    storage.setBound(true);

    const result = await api.register({
      sessionToken: "expired_token",
      studentId: "2025000007",
      name: "测试用户"
    });

    assert.strictEqual(result && result.status, "forbidden", "过期会话应返回 forbidden");
    assert.strictEqual(result && result.error_code, "session_expired", "应带 session_expired 标识");
    assert.strictEqual(storage.getSessionToken() || "", "", "会话失效后应清空本地 session_token");
    assert.strictEqual(storage.getWxIdentity() || "", "", "会话失效后应清空 wx_identity");
    assert.strictEqual(storage.getRole(), "normal", "会话失效后应重置角色");
    assert.strictEqual(storage.isBound(), false, "会话失效后应重置绑定状态");
    assert.strictEqual(global.wx.__reLaunchCalls.length, 1, "会话失效后应触发登录页跳转");
    assert.strictEqual(
      global.wx.__reLaunchCalls[0].url,
      "/pages/login/login",
      "会话失效后应跳转到登录页"
    );
  } finally {
    config.mock = originalMock;
    config.mockUserRole = originalRole;
    global.wx = originalWx;
  }
};

run()
  .then(() => {
    console.log("session-expired-redirect.test.js: PASS");
  })
  .catch((err) => {
    console.error("session-expired-redirect.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
