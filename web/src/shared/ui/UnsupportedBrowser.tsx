import { MobilePage } from "./MobilePage";

/**
 * 不支持 Passkey 的浏览器统一走这个结果页。
 *
 * 这样登录页和绑定页就不会各自维护一份相似提示文案。
 */
export function UnsupportedBrowser() {
  return (
    <MobilePage eyebrow="Passkey 不可用" title="当前浏览器暂不支持登录">
      <p>请使用支持 Passkey 的手机浏览器重新打开本页面。</p>
    </MobilePage>
  );
}
