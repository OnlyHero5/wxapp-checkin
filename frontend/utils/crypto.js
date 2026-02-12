const payloadSeal = require("./payload-seal");

const encryptPayload = (payload, sessionToken) => {
  return payloadSeal.buildRegisterPayloadEnvelope({
    sessionToken,
    payload
  });
};

module.exports = {
  encryptPayload
};
