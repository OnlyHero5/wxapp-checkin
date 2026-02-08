const assert = require("assert");

const config = require("../utils/config");
const api = require("../utils/api");

const run = async () => {
  const originalMock = config.mock;
  const originalRole = config.mockUserRole;

  config.mock = true;

  try {
    config.mockUserRole = "normal";
    const firstLogin = await api.login("wx-code-normal-first");

    assert.strictEqual(firstLogin && firstLogin.status, "success", "首次登录应成功返回会话");
    assert.strictEqual(firstLogin && firstLogin.is_registered, false, "首次登录未绑定用户应标记为未注册");
    assert.strictEqual(
      ((firstLogin && firstLogin.user_profile) || {}).student_id || "",
      "",
      "未注册用户首次登录不应返回学号"
    );
    assert.strictEqual(
      ((firstLogin && firstLogin.user_profile) || {}).name || "",
      "",
      "未注册用户首次登录不应返回姓名"
    );

    const normalAdminBind = await api.register({
      sessionToken: firstLogin.session_token,
      studentId: "2025000007",
      name: "刘洋",
      department: "学生工作部",
      club: "活动执行组"
    });
    assert.strictEqual(normalAdminBind && normalAdminBind.status, "success", "未绑定用户应可完成首次注册绑定");
    assert.strictEqual(
      normalAdminBind && normalAdminBind.role,
      "staff",
      "命中管理员库时，注册响应应返回 staff 角色"
    );
    assert.strictEqual(
      Array.isArray(normalAdminBind && normalAdminBind.permissions),
      true,
      "管理员注册响应应返回权限列表"
    );
    assert.strictEqual(
      (normalAdminBind && normalAdminBind.permissions || []).includes("activity:checkin"),
      true,
      "管理员注册响应权限应包含 activity:checkin"
    );

    const secondLogin = await api.login("wx-code-normal-second");
    assert.strictEqual(secondLogin && secondLogin.is_registered, true, "绑定成功后再次登录应标记为已注册");
    assert.strictEqual(secondLogin.user_profile.student_id, "2025000007", "再次登录应返回绑定后的学号");
    assert.strictEqual(secondLogin.user_profile.name, "刘洋", "再次登录应返回绑定后的姓名");
    assert.strictEqual(secondLogin.role, "staff", "再次登录应延续管理员角色");

    const normalRebind = await api.register({
      sessionToken: firstLogin.session_token,
      studentId: "2026N0099",
      name: "其他同学"
    });
    assert.strictEqual(
      normalRebind && normalRebind.status,
      "wx_already_bound",
      "同一微信再次绑定其他学号姓名应被拒绝"
    );

    config.mockUserRole = "staff";
    const staffLogin = await api.login("wx-code-staff-first");
    assert.strictEqual(staffLogin && staffLogin.status, "success", "工作人员登录应成功返回会话");
    assert.strictEqual(staffLogin && staffLogin.is_registered, false, "未绑定工作人员首次登录也应标记未注册");

    const conflictBind = await api.register({
      sessionToken: staffLogin.session_token,
      studentId: "2025000007",
      name: "刘洋"
    });
    assert.strictEqual(
      conflictBind && conflictBind.status,
      "student_already_bound",
      "同一学号姓名被其他微信绑定时应明确拒绝"
    );

    const staffFirstBind = await api.register({
      sessionToken: staffLogin.session_token,
      studentId: "2026S0001",
      name: "工作人员甲"
    });
    assert.strictEqual(staffFirstBind && staffFirstBind.status, "success", "工作人员应可完成首次绑定");
    assert.strictEqual(
      staffFirstBind && staffFirstBind.role,
      "normal",
      "未命中管理员库时，注册响应应返回 normal 角色"
    );
    assert.strictEqual(
      (staffFirstBind && staffFirstBind.permissions || []).length,
      0,
      "普通用户注册后权限列表应为空"
    );

    const staffSecondBind = await api.register({
      sessionToken: staffLogin.session_token,
      studentId: "2026S0002",
      name: "工作人员乙"
    });
    assert.strictEqual(
      staffSecondBind && staffSecondBind.status,
      "wx_already_bound",
      "同一微信再次绑定其他学号姓名应被拒绝"
    );
  } finally {
    config.mock = originalMock;
    config.mockUserRole = originalRole;
  }
};

run()
  .then(() => {
    console.log("auth-register-binding.test.js: PASS");
  })
  .catch((err) => {
    console.error("auth-register-binding.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
