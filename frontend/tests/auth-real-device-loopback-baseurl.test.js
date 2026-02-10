const assert = require("assert");

const config = require("../utils/config");

const createWxMock = () => {
  const state = {};
  const toastCalls = [];

  return {
    login({ success }) {
      success({ code: "wx-code-real-device" });
    },
    request(options = {}) {
      if (typeof options.fail === "function") {
        options.fail({ errMsg: "request:fail" });
      }
    },
    showToast(options = {}) {
      toastCalls.push(options);
    },
    getStorageSync(key) {
      return state[key] || "";
    },
    setStorageSync(key, value) {
      state[key] = value;
    },
    __state: state,
    __toastCalls: toastCalls
  };
};

const run = async () => {
  const originalMock = config.mock;
  const originalBaseUrl = config.baseUrl;
  const originalWx = global.wx;

  config.mock = false;
  config.baseUrl = "http://127.0.0.1:1455";
  global.wx = createWxMock();

  const storage = require("../utils/storage");
  const auth = require("../utils/auth");

  try {
    storage.setSessionToken("");
    storage.setWxIdentity("");

    const token = await auth.ensureSession();

    assert.strictEqual(token, "", "登录失败时不应返回 session token");
    assert(global.wx.__toastCalls.length > 0, "登录失败时应提示用户");
    const message = `${global.wx.__toastCalls[0].title || ""}`;
    assert(
      message.includes("127.0.0.1"),
      "当 baseUrl 为环回地址时，提示应明确指出真机无法访问 127.0.0.1"
    );
  } finally {
    config.mock = originalMock;
    config.baseUrl = originalBaseUrl;
    global.wx = originalWx;
  }
};

run()
  .then(() => {
    console.log("auth-real-device-loopback-baseurl.test.js: PASS");
  })
  .catch((err) => {
    console.error("auth-real-device-loopback-baseurl.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
