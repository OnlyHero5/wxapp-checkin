const toArrayBuffer = (str) => {
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
  const buffer = new ArrayBuffer(utf8.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < utf8.length; i += 1) {
    view[i] = utf8.charCodeAt(i);
  }
  return buffer;
};

const encryptPayload = (payload) => {
  const json = JSON.stringify(payload || {});
  const buffer = toArrayBuffer(json);
  return wx.arrayBufferToBase64(buffer);
};

module.exports = {
  encryptPayload
};
