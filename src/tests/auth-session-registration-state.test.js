const assert = require("assert");

const config = require("../utils/config");

const createWxStorageMock = () => {
  const state = {};
  return {
    login({ success }) {
      success({ code: "wx-code-session-test" });
    },
    getStorageSync(key) {
      return state[key] || "";
    },
    setStorageSync(key, value) {
      state[key] = value;
    },
    __state: state
  };
};

const run = async () => {
  const originalMock = config.mock;
  const originalRole = config.mockUserRole;
  const originalWx = global.wx;

  config.mock = true;
  config.mockUserRole = "normal";
  global.wx = createWxStorageMock();

  const storage = require("../utils/storage");
  const auth = require("../utils/auth");

  try {
    storage.setSessionToken("");
    storage.setBound(false);
    storage.setStudentId("");
    storage.setName("");
    storage.setDepartment("");
    storage.setClub("");
    storage.setRole("normal");

    const token = await auth.ensureSession();

    assert(token, "ensureSession 应返回有效会话 token");
    assert.strictEqual(storage.isBound(), false, "未注册用户登录后应保持未绑定状态");
    assert.strictEqual(storage.getStudentId() || "", "", "未注册用户登录后不应写入学号");
    assert.strictEqual(storage.getName() || "", "", "未注册用户登录后不应写入姓名");
  } finally {
    config.mock = originalMock;
    config.mockUserRole = originalRole;
    global.wx = originalWx;
  }
};

run()
  .then(() => {
    console.log("auth-session-registration-state.test.js: PASS");
  })
  .catch((err) => {
    console.error("auth-session-registration-state.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
