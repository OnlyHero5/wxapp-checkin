const assert = require("assert");

const payloadSeal = require("../utils/payload-seal");

const run = async () => {
  const encrypted = payloadSeal.buildRegisterPayloadEnvelope({
    sessionToken: "session_token_demo",
    timestampMs: 1735689600000,
    nonce: "nonce_fixed_demo_001",
    payload: {
      student_id: "2025000007",
      name: "刘洋",
      department: "学生工作部",
      club: "活动执行组"
    }
  });

  assert(encrypted && encrypted.length > 30, "签名载荷应被正确生成");

  const decoded = payloadSeal.decodeRegisterPayloadEnvelope(encrypted);
  assert.strictEqual(decoded.v, 1, "签名版本应为 1");
  assert.strictEqual(decoded.alg, "HMAC-SHA256", "签名算法应为 HMAC-SHA256");
  assert.strictEqual(decoded.ts, 1735689600000, "签名时间戳应保留");
  assert.strictEqual(decoded.nonce, "nonce_fixed_demo_001", "签名 nonce 应保留");
  assert(typeof decoded.sig === "string" && decoded.sig.length === 64, "签名摘要应为 64 位 hex");

  const encryptedChanged = payloadSeal.buildRegisterPayloadEnvelope({
    sessionToken: "session_token_demo",
    timestampMs: 1735689600000,
    nonce: "nonce_fixed_demo_001",
    payload: {
      student_id: "2025000008",
      name: "刘洋",
      department: "学生工作部",
      club: "活动执行组"
    }
  });
  const decodedChanged = payloadSeal.decodeRegisterPayloadEnvelope(encryptedChanged);
  assert.notStrictEqual(decodedChanged.sig, decoded.sig, "载荷变化后签名应变化");
};

run()
  .then(() => {
    console.log("payload-seal.test.js: PASS");
  })
  .catch((err) => {
    console.error("payload-seal.test.js: FAIL");
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
