const assert = require("assert");

const config = require("../utils/config");
const storage = require("../utils/storage");
const api = require("../utils/api");

const createWxMock = () => {
  return {
    getStorageSync() {
      return "";
    },
    setStorageSync() {},
    showToast() {},
    reLaunch() {},
    request() {}
  };
};

const run = async () => {
  const originalMock = config.mock;
  const originalBaseUrl = config.baseUrl;
  const originalWx = global.wx;

  config.mock = false;
  config.baseUrl = "http://127.0.0.1:9989";
  global.wx = createWxMock();
  storage.setRole("normal");

  try {
    let retryRequestCount = 0;
    global.wx.request = (options = {}) => {
      retryRequestCount += 1;
      if (retryRequestCount === 1) {
        if (typeof options.fail === "function") {
          options.fail({ errMsg: "request:fail timeout" });
        }
        return;
      }
      if (typeof options.success === "function") {
        options.success({
          statusCode: 200,
          data: {
            status: "success",
            activity_title: "测试活动"
          }
        });
      }
    };

    const activityCurrent = await api.getActivityCurrent();
    assert.strictEqual(activityCurrent && activityCurrent.status, "success", "GET 请求在瞬时网络错误后应自动重试并成功");
    assert.strictEqual(retryRequestCount, 2, "GET 请求应重试 1 次");

    let dedupeRequestCount = 0;
    global.wx.request = (options = {}) => {
      dedupeRequestCount += 1;
      setTimeout(() => {
        if (typeof options.success === "function") {
          options.success({
            statusCode: 200,
            data: {
              status: "success",
              activities: []
            }
          });
        }
      }, 20);
    };

    const [first, second] = await Promise.all([
      api.getStaffActivities("session_same"),
      api.getStaffActivities("session_same")
    ]);

    assert.strictEqual(first && first.status, "success", "并发请求去重后首个请求结果应成功");
    assert.strictEqual(second && second.status, "success", "并发请求去重后复用结果应成功");
    assert.strictEqual(dedupeRequestCount, 1, "同参数并发 GET 请求应只发出 1 次网络请求");
  } finally {
    config.mock = originalMock;
    config.baseUrl = originalBaseUrl;
    global.wx = originalWx;
  }
};

run()
  .then(() => {
    console.log("api-request-resilience.test.js: PASS");
  })
  .catch((err) => {
    console.error("api-request-resilience.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
