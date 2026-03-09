/**
 * WebAuthn 的浏览器原生结构里混有大量二进制字段，
 * 但后端 API 以 JSON 为主，因此这里集中做：
 * 1. base64url <-> ArrayBuffer 转换
 * 2. 运行时 options 结构的标准化
 * 3. attestation / assertion 的序列化
 *
 * 页面层不应该直接碰这些细节，否则登录与注册代码会非常难维护。
 */
function toBase64Url(value: ArrayBuffer | null | undefined) {
  if (!value) {
    return "";
  }

  // WebAuthn 的原生二进制数据需要先转成二进制字符串，再喂给 `btoa`。
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toArrayBuffer(value: unknown) {
  // 已经是 ArrayBuffer 的场景直接透传，避免重复拷贝。
  if (value instanceof ArrayBuffer) {
    return value;
  }
  // TypedArray 需要切出精确窗口，避免把无关缓冲区一起带进去。
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  // 只有字符串才按 base64url 反解，其他类型原样返回给上游做兼容判断。
  if (typeof value !== "string") {
    return value;
  }

  // 后端传的是 base64url，浏览器需要标准 base64 再解码。
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
}

/**
 * 注册 challenge 里最容易出错的是这几个字段：
 * - `challenge`
 * - `user.id`
 * - `excludeCredentials[].id`
 *
 * 它们必须是二进制，而不是 JSON 字符串。
 */
function normalizeCreationOptions(options: Record<string, unknown>) {
  const publicKey = { ...options } as Record<string, unknown>;
  publicKey.challenge = toArrayBuffer(publicKey.challenge);

  if (publicKey.user && typeof publicKey.user === "object") {
    const user = { ...(publicKey.user as Record<string, unknown>) };
    user.id = toArrayBuffer(user.id);
    publicKey.user = user;
  }

  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      return {
        ...item,
        id: toArrayBuffer((item as Record<string, unknown>).id)
      };
    });
  }

  return publicKey as unknown as PublicKeyCredentialCreationOptions;
}

/**
 * 登录 challenge 需要转换的核心字段比注册少，
 * 主要是 `challenge` 和 `allowCredentials[].id`。
 */
function normalizeRequestOptions(options: Record<string, unknown>) {
  const publicKey = { ...options } as Record<string, unknown>;
  publicKey.challenge = toArrayBuffer(publicKey.challenge);

  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      return {
        ...item,
        id: toArrayBuffer((item as Record<string, unknown>).id)
      };
    });
  }

  return publicKey as unknown as PublicKeyCredentialRequestOptions;
}

/**
 * 发起 Passkey 注册。
 *
 * 返回值不是浏览器原始对象，而是已经适配后端接口的 JSON 结构，
 * 这样页面层可以直接提交给 `register/complete`。
 */
export async function createPasskeyCredential(publicKeyOptions: Record<string, unknown>) {
  const credential = await navigator.credentials.create({
    publicKey: normalizeCreationOptions(publicKeyOptions)
  });

  // 这里强校验 `PublicKeyCredential`，是为了尽早暴露宿主环境异常。
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey 注册未返回有效凭据");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    raw_id: toBase64Url(credential.rawId),
    response: {
      // 这两个字段是后端验签和回放保护最关键的材料。
      attestation_object: toBase64Url(response.attestationObject),
      client_data_json: toBase64Url(response.clientDataJSON)
    },
    type: credential.type
  };
}

/**
 * 发起 Passkey 登录。
 *
 * 与注册类似，页面层拿到的是一个“可直接提交给后端”的断言对象。
 */
export async function getPasskeyAssertion(publicKeyOptions: Record<string, unknown>) {
  const credential = await navigator.credentials.get({
    publicKey: normalizeRequestOptions(publicKeyOptions)
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey 登录未返回有效凭据");
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    raw_id: toBase64Url(credential.rawId),
    response: {
      // 这些字段共同构成 assertion，缺任何一项都无法完整完成后端验证。
      authenticator_data: toBase64Url(response.authenticatorData),
      client_data_json: toBase64Url(response.clientDataJSON),
      signature: toBase64Url(response.signature),
      user_handle: toBase64Url(response.userHandle)
    },
    type: credential.type
  };
}
