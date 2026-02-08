const assert = require("assert");

const config = require("../utils/config");
const api = require("../utils/api");

const run = async () => {
  const originalMock = config.mock;
  const originalRole = config.mockUserRole;

  config.mock = true;
  config.mockUserRole = "normal";

  try {
    const listRes = await api.getStaffActivities("test-session-token");
    const activities = (listRes && listRes.activities) || [];

    assert(activities.length > 0, "普通用户活动列表应有至少一条可见活动");

    const hasInvisibleItem = activities.some((item) => !item.my_registered && !item.my_checked_in && !item.my_checked_out);
    assert.strictEqual(
      hasInvisibleItem,
      false,
      "普通用户活动列表不应包含未报名且未参加活动"
    );

    const hiddenActivityId = "act_research_roadshow_20260220";
    const hiddenInList = activities.some((item) => item.activity_id === hiddenActivityId);
    assert.strictEqual(
      hiddenInList,
      false,
      "普通用户活动列表不应暴露未报名未参加活动"
    );

    const hiddenDetail = await api.getStaffActivityDetail(hiddenActivityId, "test-session-token");
    assert.strictEqual(hiddenDetail && hiddenDetail.status, "forbidden", "普通用户不应查看未报名未参加活动详情");

    const visibleActivityId = "act_tech_talk_20260112";
    const visibleDetail = await api.getStaffActivityDetail(visibleActivityId, "test-session-token");
    assert.strictEqual(visibleDetail && visibleDetail.activity_id, visibleActivityId, "普通用户应可查看已参加活动详情");
  } finally {
    config.mock = originalMock;
    config.mockUserRole = originalRole;
  }
};

run()
  .then(() => {
    console.log("activity-visibility.test.js: PASS");
  })
  .catch((err) => {
    console.error("activity-visibility.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
