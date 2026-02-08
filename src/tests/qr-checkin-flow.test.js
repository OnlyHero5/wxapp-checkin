const assert = require("assert");

const config = require("../utils/config");
const api = require("../utils/api");
const qrPayload = require("../utils/qr-payload");

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
    assert.strictEqual(sessionRes && sessionRes.status, "success", "管理员应可获取前端换码配置");
    assert.strictEqual(sessionRes.qr_payload, undefined, "后端不应再返回二维码内容");
    assert.strictEqual(sessionRes.rotate_seconds, 10, "换码配置应返回 10 秒轮换");
    assert.strictEqual(sessionRes.grace_seconds, 20, "换码配置应返回 20 秒宽限");
    assert(typeof sessionRes.server_time === "number", "换码配置应包含服务端时间");

    const checkinSlot = qrPayload.getCurrentSlot(sessionRes.server_time, sessionRes.rotate_seconds);
    const checkinPayload = qrPayload.buildQrPayload({
      activityId: targetActivityId,
      actionType: "checkin",
      slot: checkinSlot,
      nonce: "n100001"
    });

    config.mockUserRole = "normal";
    const normalSession = "normal-session-token";
    const consumeRes = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: checkinPayload,
      scanType: "QR_CODE",
      rawResult: checkinPayload,
      path: ""
    });
    assert.strictEqual(consumeRes && consumeRes.status, "success", "普通用户扫码应成功消费二维码");
    assert.strictEqual(consumeRes.action_type, "checkin", "消费结果应返回签到动作");
    assert.strictEqual(consumeRes.activity_id, targetActivityId, "消费结果应返回目标活动");

    const duplicateRes = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: checkinPayload,
      scanType: "QR_CODE",
      rawResult: checkinPayload,
      path: ""
    });
    assert.strictEqual(duplicateRes.status, "duplicate", "同动作重复提交应返回 duplicate");

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

    const graceSlot = qrPayload.getCurrentSlot(Date.now(), sessionRes.rotate_seconds) - 1;
    const checkoutGracePayload = qrPayload.buildQrPayload({
      activityId: targetActivityId,
      actionType: "checkout",
      slot: graceSlot,
      nonce: "n100002"
    });

    config.mockUserRole = "normal";
    const graceConsume = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: checkoutGracePayload,
      scanType: "QR_CODE",
      rawResult: checkoutGracePayload,
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

    const expiredSlot = qrPayload.getCurrentSlot(Date.now(), sessionRes.rotate_seconds) - 4;
    const expiredPayload = qrPayload.buildQrPayload({
      activityId: targetActivityId,
      actionType: "checkin",
      slot: expiredSlot,
      nonce: "n100003"
    });

    config.mockUserRole = "normal";
    const expiredConsume = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: expiredPayload,
      scanType: "QR_CODE",
      rawResult: expiredPayload,
      path: ""
    });
    assert.strictEqual(expiredConsume.status, "expired", "超过宽限期后应返回 expired");

    const invalidConsume = await api.consumeCheckinAction({
      sessionToken: normalSession,
      qrPayload: "hello-world",
      scanType: "QR_CODE",
      rawResult: "hello-world",
      path: ""
    });
    assert.strictEqual(invalidConsume.status, "invalid_qr", "无效二维码文本应返回 invalid_qr");
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
