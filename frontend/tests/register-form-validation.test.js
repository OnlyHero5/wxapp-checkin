const assert = require("assert");

const validators = require("../utils/validators");

const run = async () => {
  const invalidStudentId = validators.validateRegisterForm({
    studentId: "12",
    name: "张三",
    department: "",
    club: ""
  });
  assert.strictEqual(invalidStudentId.ok, false, "非法学号应被拒绝");
  assert.strictEqual(invalidStudentId.firstError, "学号格式不正确（4-32位，仅支持字母、数字、_、-）");

  const invalidName = validators.validateRegisterForm({
    studentId: "2025000007",
    name: "   ",
    department: "",
    club: ""
  });
  assert.strictEqual(invalidName.ok, false, "空姓名应被拒绝");
  assert.strictEqual(invalidName.firstError, "姓名不能为空");

  const invalidDepartmentLength = validators.validateRegisterForm({
    studentId: "2025000007",
    name: "张三",
    department: "a".repeat(129),
    club: ""
  });
  assert.strictEqual(invalidDepartmentLength.ok, false, "超长部门字段应被拒绝");
  assert.strictEqual(invalidDepartmentLength.firstError, "学院/部门长度不能超过 128");

  const valid = validators.validateRegisterForm({
    studentId: " 2025_ABC-09 ",
    name: "  张三\t",
    department: " 信息工程学院\n",
    club: " 开源社 "
  });
  assert.strictEqual(valid.ok, true, "合法输入应通过校验");
  assert.deepStrictEqual(valid.normalized, {
    studentId: "2025_ABC-09",
    name: "张三",
    department: "信息工程学院",
    club: "开源社"
  });
};

run()
  .then(() => {
    console.log("register-form-validation.test.js: PASS");
  })
  .catch((err) => {
    console.error("register-form-validation.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
