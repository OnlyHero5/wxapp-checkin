const assert = require("assert");

const config = require("../utils/config");
const api = require("../utils/api");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const originalMock = config.mock;
  const originalRole = config.mockUserRole;

  config.mock = true;

  try {
    config.mockUserRole = "staff";
    const staffSession = "staff-session-token";
    const targetActivityId = "act_hackathon_20260215";

    const detailBefore = await api.getStaffActivityDetail(targetActivityId, staffSession);
    assert(detailBefore && detailBefore.activity_id === targetActivityId, "管理员应可获取活动详情");
    const beforeCount = Number(detailBefore.checkin_count || 0);
    const beforeCheckoutCount = Number(detailBefore.checkout_count || 0);

    const sessionRes = await api.createStaffQrSession({
      sessionToken: staffSession,
      activityId: targetActivityId,
      actionType: "checkin",
      rotateSeconds: 10,
      graceSeconds: 20
    });
    assert.strictEqual(sessionRes && sessionRes.status, "success", "管理员应可创建二维码会话");
    assert(sessionRes.qr_payload, "二维码会话应返回 qr_payload");
    assert.strictEqual(sessionRes.rotate_seconds, 10, "二维码会话应返回 10 秒轮换");
    assert.strictEqual(sessionRes.grace_seconds, 20, "二维码会话应返回 20 秒宽限");

    config.mockUserRole = "normal";
    const normalSession = "normal-session-token";
    const consumeRes = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: sessionRes.qr_payload,
      scanType: "QR_CODE",
      rawResult: sessionRes.qr_payload,
      path: ""
    });
    assert.strictEqual(consumeRes && consumeRes.status, "success", "普通用户扫码应成功消费二维码");
    assert.strictEqual(consumeRes.action_type, "checkin", "消费结果应返回签到动作");
    assert.strictEqual(consumeRes.activity_id, targetActivityId, "消费结果应返回目标活动");

    const normalList = await api.getStaffActivities(normalSession);
    const normalTarget = ((normalList && normalList.activities) || []).find((item) => item.activity_id === targetActivityId);
    assert(normalTarget, "普通用户活动列表应包含已处理活动");
    assert.strictEqual(normalTarget.my_checked_in, true, "普通用户扫码成功后活动状态应更新为已签到");

    config.mockUserRole = "staff";
    const detailAfter = await api.getStaffActivityDetail(targetActivityId, staffSession);
    assert.strictEqual(
      Number(detailAfter.checkin_count || 0),
      beforeCount + 1,
      "普通用户扫码成功后管理员侧签到人数应实时增加"
    );

    const graceSession = await api.createStaffQrSession({
      sessionToken: staffSession,
      activityId: targetActivityId,
      actionType: "checkout",
      rotateSeconds: 5,
      graceSeconds: 2
    });
    assert.strictEqual(graceSession.status, "success", "应可创建短时会话用于宽限验证");

    await sleep(5300);

    config.mockUserRole = "normal";
    const graceConsume = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: graceSession.qr_payload,
      scanType: "QR_CODE",
      rawResult: graceSession.qr_payload,
      path: ""
    });
    assert.strictEqual(graceConsume.status, "success", "展示窗口结束后，宽限期内仍应可提交成功");
    assert.strictEqual(graceConsume.in_grace_window, true, "宽限期消费应标识 in_grace_window");

    const normalListAfterCheckout = await api.getStaffActivities(normalSession);
    const normalTargetAfterCheckout = ((normalListAfterCheckout && normalListAfterCheckout.activities) || []).find(
      (item) => item.activity_id === targetActivityId
    );
    assert(normalTargetAfterCheckout, "签退成功后活动仍应保留在普通用户可见列表");
    assert.strictEqual(normalTargetAfterCheckout.my_checked_out, true, "签退后普通用户状态应更新为已签退");

    config.mockUserRole = "staff";
    const detailAfterCheckout = await api.getStaffActivityDetail(targetActivityId, staffSession);
    assert.strictEqual(
      Number(detailAfterCheckout.checkin_count || 0),
      beforeCount,
      "签退后在场签到人数应回到操作前数量"
    );
    assert.strictEqual(
      Number(detailAfterCheckout.checkout_count || 0),
      beforeCheckoutCount + 1,
      "签退成功后管理员侧签退人数应实时增加"
    );

    const expiredSession = await api.createStaffQrSession({
      sessionToken: staffSession,
      activityId: targetActivityId,
      actionType: "checkin",
      rotateSeconds: 5,
      graceSeconds: 1
    });
    assert.strictEqual(expiredSession.status, "success", "应可创建用于过期验证的会话");

    await sleep(6500);

    config.mockUserRole = "normal";
    const expiredConsume = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: expiredSession.qr_payload,
      scanType: "QR_CODE",
      rawResult: expiredSession.qr_payload,
      path: ""
    });
    assert.strictEqual(expiredConsume.status, "expired", "超过宽限期后应返回 expired");
  } finally {
    config.mock = originalMock;
    config.mockUserRole = originalRole;
  }
};

run()
  .then(() => {
    console.log("qr-checkin-flow.test.js: PASS");
  })
  .catch((err) => {
    console.error("qr-checkin-flow.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
